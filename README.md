# Telegraph Clone

Минималистичный сервис публикации статей, вдохновлённый Telegraph. Пользователь может создать статью в rich-text редакторе, загрузить изображения и открыть опубликованный материал по уникальной ссылке.

## Возможности

- создание, редактирование и удаление статей;
- автоматическая генерация уникального URL (`slug`);
- публичный просмотр опубликованных статей;
- rich-text редактор TipTap;
- загрузка и хранение изображений в S3-совместимом хранилище;
- API для frontend;
- локальная инфраструктура через Docker Compose.

## Стек

- **Frontend:** React, TypeScript, Vite, React Router, TanStack Query, TanStack Form, TipTap;
- **Backend:** Node.js, TypeScript, встроенный HTTP-сервер, Prisma, Zod;
- **Данные и файлы:** PostgreSQL и MinIO (S3-совместимое хранилище);
- **Production:** Docker Compose, Nginx и Caddy с автоматическим HTTPS.

## Структура

```text
frontend/                     # клиентское приложение
backend/                      # API и бизнес-логика
scripts/backup-production.sh  # резервное копирование production-данных
Caddyfile                     # HTTPS и reverse proxy
docker-compose.yml            # PostgreSQL и MinIO для разработки
docker-compose.production.yml # production-стек
```

Подробности по отдельным частям приложения: [frontend](frontend/README.md) и [backend](backend/README.md).

## Требования

- Node.js и npm;
- Docker и Docker Compose для PostgreSQL и MinIO.

## Локальный запуск

1. Запустить PostgreSQL и MinIO:

   ```bash
   docker compose up -d
   ```

2. В двух отдельных терминалах установить зависимости и запустить приложения:

   ```bash
   cd backend && npm install && npm run dev
   ```

   ```bash
   cd frontend && npm install && npm run dev
   ```

После запуска frontend будет доступен по адресу `http://localhost:5173`, а API — по адресу `http://localhost:3000`.
MinIO Console доступна по адресу `http://localhost:9001`.

## Production

Для production уже подготовлены Docker-образы, миграции базы данных, MinIO bucket, reverse proxy и автоматическое получение TLS-сертификата.

Перед первым запуском на сервере нужно создать `.env.production` из шаблона `.env.production.example`, указать домен и email для TLS-сертификатов, а также заменить все пароли. После этого стек запускается командой:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

Публичный доступ получает только Caddy на портах `80` и `443`. PostgreSQL, MinIO, backend и frontend остаются доступны лишь внутри Docker-сети.

## Резервные копии

Скрипт `scripts/backup-production.sh` создаёт резервную копию PostgreSQL и копию файлов из MinIO в каталоге `backups/`. Его следует регулярно запускать на VPS и отправлять копии во внешнее хранилище.

```bash
./scripts/backup-production.sh
```

## TODO

- [ ] Арендовать и настроить VPS-сервер для production-развёртывания.
- [ ] Подключить домен: направить DNS-запись на IP-адрес VPS и указать домен в `.env.production`.
