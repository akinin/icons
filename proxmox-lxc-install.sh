#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="AHS Icons"
DEFAULT_HOSTNAME="icons"
DEFAULT_CORES="1"
DEFAULT_MEMORY="1024"
DEFAULT_SWAP="512"
DEFAULT_DISK="20"
DEFAULT_STORAGE="local-lvm"
DEFAULT_TEMPLATE_STORAGE="local"
DEFAULT_BRIDGE="vmbr0"
DEFAULT_CT_MOUNT="/mnt/icons"
DEFAULT_NFS_MOUNT="/mnt/icons"
DEFAULT_APP_PORT="4051"
DOCKER_INSTALL_URL="https://raw.githubusercontent.com/akinin/icons/main/docker-install.sh"

require_root() {
    if [ "$(id -u)" -ne 0 ]; then
        echo "Run this script as root on the Proxmox host."
        exit 1
    fi
}

require_pve() {
    if ! command -v pct >/dev/null 2>&1; then
        echo "pct not found. Run this script on a Proxmox VE host."
        exit 1
    fi
}

ask() {
    local prompt="$1"
    local default="$2"
    local value

    read -r -p "$prompt [$default]: " value
    printf '%s' "${value:-$default}"
}

ask_required() {
    local prompt="$1"
    local value

    while true; do
        read -r -p "$prompt: " value
        if [ -n "$value" ]; then
            printf '%s' "$value"
            return
        fi
        echo "Value is required."
    done
}

detect_template() {
    local storage="$1"
    local template

    template="$(pveam list "$storage" 2>/dev/null | awk '/debian-13.*amd64.*\.tar\.(zst|gz|xz)$/ {print $1}' | sort -V | tail -n 1 || true)"
    if [ -n "$template" ]; then
        printf '%s' "$template"
        return
    fi

    template="$(pveam list "$storage" 2>/dev/null | awk '/debian-.*amd64.*\.tar\.(zst|gz|xz)$/ {print $1}' | sort -V | tail -n 1 || true)"
    printf '%s' "$template"
}

ensure_package() {
    local package="$1"
    local binary="$2"

    if command -v "$binary" >/dev/null 2>&1; then
        return
    fi

    apt-get update
    apt-get install -y "$package"
}

ensure_nfs_mount() {
    local remote="$1"
    local mountpoint="$2"

    ensure_package nfs-common mount.nfs
    if [ -e "$mountpoint" ] && [ ! -d "$mountpoint" ]; then
        echo "$mountpoint exists, but it is not a directory."
        exit 1
    fi

    if [ ! -d "$mountpoint" ]; then
        mkdir -p "$mountpoint"
    fi

    if ! grep -qsE "^[^#][[:space:]]*$remote[[:space:]]+$mountpoint[[:space:]]+nfs" /etc/fstab; then
        printf '%s  %s  nfs4  defaults,_netdev  0  0\n' "$remote" "$mountpoint" >> /etc/fstab
    fi

    if findmnt "$mountpoint" >/dev/null; then
        echo "$mountpoint is already mounted."
        return
    fi

    mount "$mountpoint" || mount -t nfs4 "$remote" "$mountpoint"
    findmnt "$mountpoint" >/dev/null
}

ensure_template() {
    local template="$1"
    local storage
    local file

    if [ "${template#*:vztmpl/}" = "$template" ]; then
        return
    fi

    storage="${template%%:*}"
    file="${template#*:vztmpl/}"

    if pveam list "$storage" 2>/dev/null | awk '{print $1}' | grep -Fxq "$template"; then
        return
    fi

    echo "Template $template is not downloaded. Trying to download it..."
    pveam update
    pveam download "$storage" "$file"
}

next_ctid() {
    local id

    if command -v pvesh >/dev/null 2>&1; then
        id="$(pvesh get /cluster/nextid 2>/dev/null || true)"
        if [ -n "$id" ]; then
            printf '%s' "$id"
            return
        fi
    fi

    for id in $(seq 100 999999); do
        if ! pct status "$id" >/dev/null 2>&1; then
            printf '%s' "$id"
            return
        fi
    done

    echo "Could not find free container ID." >&2
    exit 1
}

confirm() {
    local answer
    read -r -p "Create container and install $APP_NAME? [y/N]: " answer
    case "$answer" in
        y|Y|yes|YES) ;;
        *) echo "Cancelled."; exit 0 ;;
    esac
}

require_root
require_pve

NEXT_ID="$(next_ctid)"

echo
echo "$APP_NAME Proxmox LXC installer"
echo

TEMPLATE_STORAGE="$(ask "Template storage" "$DEFAULT_TEMPLATE_STORAGE")"
DETECTED_TEMPLATE="$(detect_template "$TEMPLATE_STORAGE")"
if [ -z "$DETECTED_TEMPLATE" ]; then
    DETECTED_TEMPLATE="$TEMPLATE_STORAGE:vztmpl/debian-13-standard_13.1-2_amd64.tar.zst"
fi

echo

CTID="$(ask "Container ID" "$NEXT_ID")"
if pct status "$CTID" >/dev/null 2>&1; then
    echo "Container ID $CTID already exists."
    exit 1
fi
HOSTNAME="$(ask "Hostname" "$DEFAULT_HOSTNAME")"
TEMPLATE="$(ask "Container template" "$DETECTED_TEMPLATE")"
STORAGE="$(ask "Rootfs storage" "$DEFAULT_STORAGE")"
DISK_GB="$(ask "Rootfs size in GB" "$DEFAULT_DISK")"
CORES="$(ask "CPU cores" "$DEFAULT_CORES")"
MEMORY="$(ask "Memory in MB" "$DEFAULT_MEMORY")"
SWAP="$(ask "Swap in MB" "$DEFAULT_SWAP")"
BRIDGE="$(ask "Network bridge" "$DEFAULT_BRIDGE")"
IP_CONFIG="$(ask "Container IP, use dhcp or address/cidr" "dhcp")"
GATEWAY=""
if [ "$IP_CONFIG" != "dhcp" ]; then
    GATEWAY="$(ask_required "Gateway")"
fi
NFS_REMOTE="$(ask_required "NFS remote path, example 10.10.100.11:/volume1/icons")"
NFS_MOUNT="$(ask "NFS mount path on Proxmox host" "$DEFAULT_NFS_MOUNT")"
CT_MOUNT="$(ask "Mount path inside LXC" "$DEFAULT_CT_MOUNT")"
APP_PORT="$(ask "AHS Icons web port" "$DEFAULT_APP_PORT")"

NET0="name=eth0,bridge=$BRIDGE,ip=$IP_CONFIG,type=veth"
if [ -n "$GATEWAY" ]; then
    NET0="$NET0,gw=$GATEWAY"
fi

echo
echo "Summary:"
echo "  CTID: $CTID"
echo "  Hostname: $HOSTNAME"
echo "  Template: $TEMPLATE"
echo "  Rootfs: $STORAGE:${DISK_GB}"
echo "  CPU/RAM/Swap: $CORES core(s), ${MEMORY}MB, ${SWAP}MB"
echo "  Network: $NET0"
echo "  NFS: $NFS_REMOTE -> $NFS_MOUNT -> LXC:$CT_MOUNT"
echo "  App port: $APP_PORT"
echo

confirm

echo
echo "Mounting NFS on Proxmox host..."
ensure_template "$TEMPLATE"
ensure_nfs_mount "$NFS_REMOTE" "$NFS_MOUNT"

echo "Testing NFS write access on host..."
touch "$NFS_MOUNT/.ahs-icons-write-test"
rm -f "$NFS_MOUNT/.ahs-icons-write-test"

echo "Creating LXC container..."
pct create "$CTID" "$TEMPLATE" \
    --hostname "$HOSTNAME" \
    --cores "$CORES" \
    --memory "$MEMORY" \
    --swap "$SWAP" \
    --rootfs "$STORAGE:${DISK_GB}" \
    --net0 "$NET0" \
    --features nesting=1,keyctl=1 \
    --unprivileged 1 \
    --onboot 1

pct set "$CTID" -mp0 "$NFS_MOUNT,mp=$CT_MOUNT,backup=0"

echo "Starting LXC container..."
pct start "$CTID"

echo "Installing base packages in LXC..."
pct exec "$CTID" -- bash -lc "apt-get update && apt-get install -y curl wget git nano ca-certificates gnupg openssl"

echo "Testing NFS write access inside LXC..."
if ! pct exec "$CTID" -- bash -lc "touch '$CT_MOUNT/.ahs-icons-write-test' && rm -f '$CT_MOUNT/.ahs-icons-write-test'"; then
    echo
    echo "NFS is mounted, but the unprivileged LXC cannot write to it."
    echo "Fix permissions on the NFS server or Proxmox host, then run:"
    echo "  pct exec $CTID -- bash -lc \"touch '$CT_MOUNT/.ahs-icons-write-test' && rm -f '$CT_MOUNT/.ahs-icons-write-test'\""
    echo "  pct exec $CTID -- bash -lc \"AHS_ICONS_PORT=$APP_PORT AHS_ICONS_DATA_PATH=$CT_MOUNT bash -c \\\"\$(curl -fsSL $DOCKER_INSTALL_URL)\\\"\""
    exit 1
fi

echo "Installing Docker and $APP_NAME in LXC..."
pct exec "$CTID" -- bash -lc "AHS_ICONS_PORT='$APP_PORT' AHS_ICONS_DATA_PATH='$CT_MOUNT' bash -c \"\$(curl -fsSL '$DOCKER_INSTALL_URL')\""

CONTAINER_IP="$(pct exec "$CTID" -- bash -lc "hostname -I | awk '{print \$1}'" 2>/dev/null || true)"
if [ -z "$CONTAINER_IP" ]; then
    CONTAINER_IP="$IP_CONFIG"
fi

echo
echo "$APP_NAME installed."
echo "CTID: $CTID"
echo "Hostname: $HOSTNAME"
echo "Container IP: $CONTAINER_IP"
echo "URL: http://$CONTAINER_IP:$APP_PORT/"
echo "Proxmox NFS mount: $NFS_MOUNT"
echo "LXC data path: $CT_MOUNT"
echo "Compose directory inside LXC: /opt/ahs-icons"
echo
echo "Useful commands:"
echo "  pct enter $CTID"
echo "  pct exec $CTID -- docker ps"
echo "  pct exec $CTID -- bash -lc 'cd /opt/ahs-icons && docker compose logs --tail=100'"
