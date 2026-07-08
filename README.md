# AHS Icons

Локальная галерея кастомных AHS-иконок.

Поддерживает SVG, PNG и ICO, drag&drop-загрузку, редактирование карточек, выбор логотипа и прямые ссылки на файлы.

## Быстрая установка

На новом сервере достаточно выполнить одну команду:

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/akinin/icons/main/docker-install.sh)"
```

Скрипт установит Docker, если его нет, создаст каталог `/opt/ahs-icons`, скачает образ `akininav/icons:latest` из Docker Hub и запустит контейнер через Docker Compose.

Открыть:

```text
http://SERVER_IP:4051/
```

## Установка с NFS или своим путем хранения

Если иконки нужно хранить в примонтированной NFS-папке, сначала примонтируйте ее на сервере, затем укажите путь при запуске:

```bash
sudo AHS_ICONS_DATA_PATH=/mnt/nfs/ahs-icons bash -c "$(curl -fsSL https://raw.githubusercontent.com/akinin/icons/main/docker-install.sh)"
```

Можно сразу поменять порт:

```bash
sudo AHS_ICONS_PORT=8080 AHS_ICONS_DATA_PATH=/mnt/nfs/ahs-icons bash -c "$(curl -fsSL https://raw.githubusercontent.com/akinin/icons/main/docker-install.sh)"
```

Контейнер пишет данные в `/data`, а на хосте эта папка монтируется из `AHS_ICONS_DATA_PATH`.

Внутри папки хранения будут:

```text
icons.json
settings.json
icons/<icon-id>/
```

## Установка в Proxmox LXC

На Proxmox-хосте можно запустить мастер создания LXC-контейнера:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/akinin/icons/main/proxmox-lxc-install.sh)"
```

Скрипт спросит:

- CTID или возьмет следующий свободный автоматически;
- шаблон Debian, storage, CPU, RAM, swap и размер диска;
- IP контейнера: `dhcp` или статический адрес с gateway;
- NFS-путь, например `10.10.100.11:/volume1/icons`;
- локальный путь монтирования NFS на Proxmox, например `/mnt/icons`;
- путь внутри LXC, например `/mnt/icons`;
- порт веб-интерфейса.

После этого он создаст unprivileged LXC с `nesting=1,keyctl=1`, добавит mount point, установит Docker внутри контейнера и запустит AHS Icons.

## Где лежит установка

По умолчанию скрипт создает:

```text
/opt/ahs-icons/.env
/opt/ahs-icons/docker-compose.yml
/opt/ahs-icons/data/
```

Посмотреть настройки:

```bash
cat /opt/ahs-icons/.env
```

Перезапустить:

```bash
cd /opt/ahs-icons
docker compose up -d
```

Обновить контейнер:

```bash
cd /opt/ahs-icons
docker compose pull
docker compose up -d
```

Остановить:

```bash
cd /opt/ahs-icons
docker compose down
```

## Docker Compose вручную

Если проект уже скачан локально:

```bash
cp .env.example .env
nano .env
docker compose up -d
```

Пример `.env`:

```dotenv
AHS_ICONS_IMAGE=akininav/icons:latest
AHS_ICONS_PORT=4051
AHS_ICONS_DATA_PATH=/mnt/nfs/ahs-icons
```

## Docker Hub

Готовый образ публикуется в Docker Hub:

```text
akininav/icons:latest
akininav/icons:sha-<commit-sha>
```

Локальная сборка:

```bash
docker build -t akininav/icons:latest .
```

Запуск без compose:

```bash
docker run -d \
  --name ahs-icons \
  --restart unless-stopped \
  -p 4051:4051 \
  -e AHS_ICONS_DATA=/data \
  -v /mnt/nfs/ahs-icons:/data \
  akininav/icons:latest
```

## GitHub Actions

Workflow находится в `.github/workflows/docker.yml`.

Чтобы GitHub сам собирал и публиковал контейнер в Docker Hub, добавьте в GitHub репозиторий:

`Settings -> Secrets and variables -> Actions -> New repository secret`

Нужны secrets:

```text
DOCKERHUB_USERNAME=akininav
DOCKERHUB_TOKEN=<Docker Hub access token>
```

После push в `main` workflow соберет Docker image и отправит его в `akininav/icons`.

## Ручной запуск без Docker

```bash
python3 server.py --host 0.0.0.0 --port 4051 --data-dir ./data
```
