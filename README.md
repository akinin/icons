# AHS Icons

Локальная галерея только для кастомных AHS-иконок.

Возможности:

- загрузка SVG, PNG и ICO через drag&drop;
- карточка на каждую иконку;
- редактирование названия;
- обновление или добавление форматов изображения;
- удаление карточки;
- хранение всех данных локально без Docker.

## Установка

На сервере с `python3`, `git` и `systemd`:

```bash
export GITLAB_TOKEN='PASTE_GITLAB_TOKEN_HERE'
curl -fsSL -H "PRIVATE-TOKEN: $GITLAB_TOKEN" https://git.akinin.su/akininav/ahs-icons/-/raw/main/install.sh | sudo -E bash
```

По умолчанию приложение ставится в `/opt/ahs-icons` и слушает порт `4051`.

Можно изменить параметры перед запуском:

```bash
export APP_DIR=/home/akininav/ahs-icons
export PORT=4051
export HOST=0.0.0.0
```

## Ручной запуск

```bash
python3 server.py --host 0.0.0.0 --port 4051 --data-dir ./data
```

Данные хранятся в:

```text
data/icons.json
data/icons/<icon-id>/
```

## Обслуживание

```bash
sudo systemctl status ahs-icons
sudo systemctl restart ahs-icons
sudo journalctl -u ahs-icons -f
```
