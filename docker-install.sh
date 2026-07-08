#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${AHS_ICONS_DIR:-/opt/ahs-icons}"
IMAGE="${AHS_ICONS_IMAGE:-akininav/icons:latest}"
PORT="${AHS_ICONS_PORT:-4051}"
DATA_PATH="${AHS_ICONS_DATA_PATH:-$APP_DIR/data}"

if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root, for example:"
    echo "sudo bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/akinin/icons/main/docker-install.sh)\""
    exit 1
fi

install_docker() {
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        return
    fi

    if command -v apt-get >/dev/null 2>&1; then
        apt-get update
        apt-get install -y ca-certificates curl
        command -v docker >/dev/null 2>&1 || apt-get install -y docker.io
        docker compose version >/dev/null 2>&1 || apt-get install -y docker-compose-plugin || apt-get install -y docker-compose
        if command -v systemctl >/dev/null 2>&1; then
            systemctl enable --now docker
        else
            service docker start || true
        fi
        return
    fi

    if command -v dnf >/dev/null 2>&1; then
        command -v docker >/dev/null 2>&1 || dnf install -y docker
        docker compose version >/dev/null 2>&1 || dnf install -y docker-compose-plugin || dnf install -y docker-compose
        if command -v systemctl >/dev/null 2>&1; then
            systemctl enable --now docker
        else
            service docker start || true
        fi
        return
    fi

    if command -v apk >/dev/null 2>&1; then
        command -v docker >/dev/null 2>&1 || apk add --no-cache docker
        docker compose version >/dev/null 2>&1 || apk add --no-cache docker-cli-compose docker-compose
        rc-update add docker default || true
        service docker start || true
        return
    fi

    echo "Docker is not installed and this OS is not supported by the installer."
    exit 1
}

compose() {
    if docker compose version >/dev/null 2>&1; then
        docker compose "$@"
        return
    fi

    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose "$@"
        return
    fi

    echo "Docker Compose plugin is not available."
    exit 1
}

ensure_dir() {
    local path="$1"

    if [ -e "$path" ] && [ ! -d "$path" ]; then
        echo "$path exists, but it is not a directory."
        exit 1
    fi

    if [ ! -d "$path" ]; then
        mkdir -p "$path"
    fi
}

install_docker

ensure_dir "$APP_DIR"
ensure_dir "$DATA_PATH"

cat >"$APP_DIR/.env" <<EOF
AHS_ICONS_IMAGE=$IMAGE
AHS_ICONS_PORT=$PORT
AHS_ICONS_DATA_PATH=$DATA_PATH
EOF

cat >"$APP_DIR/docker-compose.yml" <<'EOF'
services:
  ahs-icons:
    image: ${AHS_ICONS_IMAGE:-akininav/icons:latest}
    container_name: ahs-icons
    restart: unless-stopped
    ports:
      - "${AHS_ICONS_PORT:-4051}:4051"
    environment:
      AHS_ICONS_HOST: 0.0.0.0
      AHS_ICONS_PORT: 4051
      AHS_ICONS_DATA: /data
    volumes:
      - "${AHS_ICONS_DATA_PATH:-./data}:/data"
EOF

cd "$APP_DIR"
compose pull
compose up -d

echo
echo "AHS Icons is running."
echo "App directory: $APP_DIR"
echo "Data path: $DATA_PATH"
echo "Open: http://SERVER_IP:$PORT/"
