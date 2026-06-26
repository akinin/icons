#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ahs-icons}"
APP_USER="${APP_USER:-ahs-icons}"
PORT="${PORT:-4051}"
HOST="${HOST:-0.0.0.0}"
REPO_URL="${REPO_URL:-https://git.akinin.su/akininav/ahs-icons.git}"
GITLAB_TOKEN="${GITLAB_TOKEN:-}"

if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root, for example: curl ... | sudo -E bash"
    exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required."
    exit 1
fi

if ! command -v git >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update
        apt-get install -y git
    elif command -v apk >/dev/null 2>&1; then
        apk add --no-cache git
    else
        echo "git is required."
        exit 1
    fi
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
    useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi

mkdir -p "$APP_DIR"

clone_url="$REPO_URL"
if [ -n "$GITLAB_TOKEN" ] && [ "${REPO_URL#https://}" != "$REPO_URL" ]; then
    clone_url="https://oauth2:${GITLAB_TOKEN}@${REPO_URL#https://}"
fi

if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" fetch origin main
    git -C "$APP_DIR" reset --hard origin/main
else
    tmp_dir="$(mktemp -d)"
    trap 'rm -rf "$tmp_dir"' EXIT
    git clone "$clone_url" "$tmp_dir"
    find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name data -exec rm -rf {} +
    cp -a "$tmp_dir/." "$APP_DIR/"
fi

mkdir -p "$APP_DIR/data/icons"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

cat >/etc/systemd/system/ahs-icons.service <<EOF
[Unit]
Description=AHS custom icons gallery
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=AHS_ICONS_HOST=$HOST
Environment=AHS_ICONS_PORT=$PORT
Environment=AHS_ICONS_DATA=$APP_DIR/data
ExecStart=/usr/bin/python3 $APP_DIR/server.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now ahs-icons.service

echo "AHS Icons installed."
echo "App dir: $APP_DIR"
echo "URL: http://$(hostname -I | awk '{print $1}'):$PORT/"
