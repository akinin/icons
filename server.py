#!/usr/bin/env python3
import argparse
import json
import mimetypes
import os
import re
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlparse
import cgi


APP_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = APP_DIR / "public"
ALLOWED_FORMATS = {"svg", "png", "ico"}


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def slugify(value):
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9а-яё_-]+", "-", value, flags=re.IGNORECASE)
    value = re.sub(r"-{2,}", "-", value).strip("-_")
    return value or "icon"


class IconStore:
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir)
        self.icons_dir = self.data_dir / "icons"
        self.db_path = self.data_dir / "icons.json"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.icons_dir.mkdir(parents=True, exist_ok=True)
        if not self.db_path.exists():
            self.write([])

    def read(self):
        with self.db_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def write(self, icons):
        temp = self.db_path.with_suffix(".json.tmp")
        with temp.open("w", encoding="utf-8") as handle:
            json.dump(icons, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        temp.replace(self.db_path)

    def list_icons(self):
        return sorted(self.read(), key=lambda item: item["name"].lower())

    def get(self, icon_id):
        for icon in self.read():
            if icon["id"] == icon_id:
                return icon
        return None

    def save_icon(self, name, uploads, icon_id=None):
        icons = self.read()
        now = utc_now()

        if icon_id:
            icon = next((item for item in icons if item["id"] == icon_id), None)
            if icon is None:
                raise KeyError(icon_id)
            icon["name"] = name
            icon["slug"] = slugify(name)
            icon["updatedAt"] = now
        else:
            icon = {
                "id": uuid.uuid4().hex,
                "name": name,
                "slug": slugify(name),
                "formats": {},
                "createdAt": now,
                "updatedAt": now,
            }
            icons.append(icon)

        target_dir = self.icons_dir / icon["id"]
        target_dir.mkdir(parents=True, exist_ok=True)

        for upload in uploads:
            ext = upload["ext"]
            dest_name = f"{icon['slug']}.{ext}"

            old = icon["formats"].get(ext)
            if old:
                old_path = target_dir / old["filename"]
                if old_path.exists() and old_path.name != dest_name:
                    old_path.unlink()

            dest = target_dir / dest_name
            shutil.move(upload["path"], dest)
            icon["formats"][ext] = {
                "filename": dest_name,
                "size": dest.stat().st_size,
                "updatedAt": now,
            }

        self.write(icons)
        return icon

    def delete_icon(self, icon_id):
        icons = self.read()
        next_icons = [item for item in icons if item["id"] != icon_id]
        if len(next_icons) == len(icons):
            raise KeyError(icon_id)
        shutil.rmtree(self.icons_dir / icon_id, ignore_errors=True)
        self.write(next_icons)


class AhsIconsHandler(BaseHTTPRequestHandler):
    store = None

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} - {fmt % args}")

    def send_json(self, payload, status=HTTPStatus.OK):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_error_json(self, status, message):
        self.send_json({"error": message}, status)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/icons":
            self.send_json({"icons": self.store.list_icons()})
            return
        if parsed.path.startswith("/icons/"):
            self.serve_icon(parsed.path)
            return
        self.serve_static(parsed.path)

    def do_POST(self):
        if urlparse(self.path).path != "/api/icons":
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")
            return
        self.handle_upsert()

    def do_PUT(self):
        match = re.fullmatch(r"/api/icons/([a-f0-9]{32})", urlparse(self.path).path)
        if not match:
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")
            return
        self.handle_upsert(match.group(1))

    def do_DELETE(self):
        match = re.fullmatch(r"/api/icons/([a-f0-9]{32})", urlparse(self.path).path)
        if not match:
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")
            return
        try:
            self.store.delete_icon(match.group(1))
        except KeyError:
            self.send_error_json(HTTPStatus.NOT_FOUND, "Icon not found")
            return
        self.send_json({"ok": True})

    def handle_upsert(self, icon_id=None):
        try:
            name, uploads = self.parse_multipart()
            if not name:
                raise ValueError("Name is required")
            if not icon_id and not uploads:
                raise ValueError("Upload at least one SVG, PNG, or ICO file")
            icon = self.store.save_icon(name, uploads, icon_id)
            self.send_json({"icon": icon}, HTTPStatus.OK if icon_id else HTTPStatus.CREATED)
        except KeyError:
            self.send_error_json(HTTPStatus.NOT_FOUND, "Icon not found")
        except ValueError as err:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(err))
        finally:
            for upload in locals().get("uploads", []):
                temp_path = Path(upload["path"])
                if temp_path.exists():
                    temp_path.unlink()

    def parse_multipart(self):
        content_type = self.headers.get("Content-Type", "")
        if not content_type.startswith("multipart/form-data"):
            raise ValueError("Expected multipart/form-data")

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": self.command,
                "CONTENT_TYPE": content_type,
            },
        )

        name = (form.getfirst("name") or "").strip()
        uploads = []
        fields = form["files"] if "files" in form else []
        if not isinstance(fields, list):
            fields = [fields]

        for field in fields:
            if not field.filename:
                continue
            ext = Path(field.filename).suffix.lower().lstrip(".")
            if ext not in ALLOWED_FORMATS:
                raise ValueError(f"Unsupported format: {ext or field.filename}")

            with tempfile.NamedTemporaryFile(delete=False, dir=self.store.data_dir) as tmp:
                shutil.copyfileobj(field.file, tmp)
                uploads.append({"ext": ext, "path": tmp.name})

        return name, uploads

    def serve_icon(self, request_path):
        parts = [unquote(part) for part in request_path.split("/") if part]
        if len(parts) != 3:
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        _, icon_id, filename = parts
        if not re.fullmatch(r"[a-f0-9]{32}", icon_id):
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        path = (self.store.icons_dir / icon_id / filename).resolve()
        if self.store.icons_dir.resolve() not in path.parents or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self.send_file(path)

    def serve_static(self, request_path):
        if request_path in {"", "/"}:
            request_path = "/index.html"
        path = (PUBLIC_DIR / unquote(request_path.lstrip("/"))).resolve()
        if PUBLIC_DIR.resolve() not in path.parents and path != PUBLIC_DIR.resolve():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self.send_file(path)

    def send_file(self, path):
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        data = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)


def main():
    parser = argparse.ArgumentParser(description="AHS custom icons gallery")
    parser.add_argument("--host", default=os.environ.get("AHS_ICONS_HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("AHS_ICONS_PORT", "4051")))
    parser.add_argument("--data-dir", default=os.environ.get("AHS_ICONS_DATA", str(APP_DIR / "data")))
    args = parser.parse_args()

    AhsIconsHandler.store = IconStore(args.data_dir)
    server = ThreadingHTTPServer((args.host, args.port), AhsIconsHandler)
    print(f"AHS icons gallery listening on http://{args.host}:{args.port}")
    print(f"Data directory: {Path(args.data_dir).resolve()}")
    server.serve_forever()


if __name__ == "__main__":
    main()
