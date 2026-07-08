# AHS Icons

Локальная галерея кастомных AHS-иконок.

Поддерживает SVG, PNG и ICO, drag&drop-загрузку, редактирование карточек, выбор логотипа и прямые ссылки на файлы.

## Docker Compose

Быстрый запуск:

```bash
cp .env.example .env
nano .env
docker compose up -d
```

Открыть:

```text
http://SERVER_IP:4051/
```

Пример `.env` для NFS:

```dotenv
AHS_ICONS_IMAGE=akininav/icons:latest
AHS_ICONS_PORT=4051
AHS_ICONS_DATA_PATH=/mnt/nfs/ahs-icons
```

Контейнер пишет данные в `/data`, а на хосте эта папка монтируется из `AHS_ICONS_DATA_PATH`.

Внутри будут храниться:

```text
icons.json
settings.json
icons/<icon-id>/
```

## Docker Hub

Образ публикуется в Docker Hub:

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

## Установка Без Docker

На сервере с `python3`, `git` и `systemd`:

```bash
export GITLAB_TOKEN='PASTE_GITLAB_TOKEN_HERE'
curl -fsSL -H "PRIVATE-TOKEN: $GITLAB_TOKEN" https://git.akinin.su/akininav/ahs-icons/-/raw/main/install.sh | sudo -E bash
```

Этот способ оставлен для старой установки. Для нового развертывания лучше использовать Docker Compose.

## Ручной Запуск

```bash
python3 server.py --host 0.0.0.0 --port 4051 --data-dir ./data
```
