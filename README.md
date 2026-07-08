# AHS Icons

Локальная галерея кастомных AHS-иконок без внешних зависимостей.

Поддерживает SVG, PNG и ICO, drag&drop-загрузку, редактирование карточек, выбор логотипа и прямые ссылки на файлы.

## Docker

Быстрый запуск:

```bash
cp .env.example .env
docker compose up -d --build
```

Открыть:

```text
http://SERVER_IP:4051/
```

В `.env` можно указать путь хранения данных:

```dotenv
AHS_ICONS_PORT=4051
AHS_ICONS_DATA_PATH=/mnt/nfs/ahs-icons
```

В эту папку будут записываться:

```text
icons.json
settings.json
icons/<icon-id>/
```

Если папка находится на NFS, сначала примонтируйте ее на хосте, затем укажите mount point в `AHS_ICONS_DATA_PATH`.

## Сборка Образа

Локально:

```bash
docker build -t ahs-icons:latest .
```

Запуск без compose:

```bash
docker run -d \
  --name ahs-icons \
  --restart unless-stopped \
  -p 4051:4051 \
  -e AHS_ICONS_DATA=/data \
  -v /mnt/nfs/ahs-icons:/data \
  ahs-icons:latest
```

## GitLab CI

В репозитории есть `.gitlab-ci.yml`. При push в `main` GitLab Runner собирает Docker image и публикует его в GitLab Container Registry:

```text
$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
$CI_REGISTRY_IMAGE:latest
```

После первой сборки можно указать готовый образ в `.env`:

```dotenv
AHS_ICONS_IMAGE=registry.git.akinin.su/akininav/ahs-icons:latest
AHS_ICONS_PORT=4051
AHS_ICONS_DATA_PATH=/mnt/nfs/ahs-icons
```

Если адрес registry отличается, возьмите точное имя образа в GitLab: `Packages & Registries -> Container Registry`.

Обновление контейнера из registry:

```bash
docker compose pull
docker compose up -d
```

## Установка Без Docker

На сервере с `python3`, `git` и `systemd`:

```bash
export GITLAB_TOKEN='PASTE_GITLAB_TOKEN_HERE'
curl -fsSL -H "PRIVATE-TOKEN: $GITLAB_TOKEN" https://git.akinin.su/akininav/ahs-icons/-/raw/main/install.sh | sudo -E bash
```

Параметры:

```bash
export APP_DIR=/home/akininav/ahs-icons
export PORT=4051
export HOST=0.0.0.0
```

## Ручной Запуск

```bash
python3 server.py --host 0.0.0.0 --port 4051 --data-dir ./data
```
