FROM python:3.12-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AHS_ICONS_HOST=0.0.0.0 \
    AHS_ICONS_PORT=4051 \
    AHS_ICONS_DATA=/data

WORKDIR /app

COPY server.py /app/server.py
COPY public /app/public

RUN mkdir -p /data

EXPOSE 4051
VOLUME ["/data"]

CMD ["python3", "/app/server.py"]
