# Backend

API для сервиса Telegraph Clone. Отвечает за статьи, загрузку изображений и работу с PostgreSQL и S3-совместимым хранилищем.

## Стек

- Node.js и TypeScript;
- встроенный HTTP-сервер Node.js;
- Prisma и PostgreSQL;
- AWS SDK для MinIO / S3;
- Zod для проверки входящих данных.

## Подготовка

Для локальной работы нужны запущенные PostgreSQL и MinIO из корня репозитория:

```bash
docker compose up -d
```

Установите зависимости и подготовьте переменные окружения:

```bash
npm install
```

Создайте файл `.env` со значениями для локального окружения:

```env
DATABASE_URL="postgresql://telegraph:telegraph@localhost:5432/telegraph"
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="telegraph"
S3_SECRET_KEY="telegraph123"
S3_BUCKET="article-images"
```

Затем примените миграции базы данных:

```bash
npm run db:migrate
```

## Запуск

```bash
npm run dev
```

Сервер будет доступен по адресу `http://localhost:3000`.

## API

| Метод | Маршрут | Описание |
| --- | --- | --- |
| `GET` | `/articles` | Получить список статей |
| `POST` | `/articles` | Создать статью |
| `GET` | `/articles/:slug` | Получить статью по URL-идентификатору |
| `PATCH` | `/articles/:slug` | Обновить статью |
| `DELETE` | `/articles/:slug` | Удалить статью |
| `POST` | `/uploads` | Загрузить изображение |
| `GET` | `/uploads/:key` | Получить изображение |
| `DELETE` | `/uploads/:key` | Удалить изображение |

`POST /uploads` принимает JPEG, PNG, WebP и GIF размером до 5 МиБ.

## Команды

```bash
npm run dev          # запуск в режиме разработки
npm run build        # production-сборка
npm start            # запуск собранного приложения
npm run db:migrate   # применение миграций Prisma
npm test             # API-тесты
npm run typecheck    # проверка TypeScript
npm run format       # форматирование исходников
npm run format:check # проверка форматирования
```

## Production

Production-запуск описан в корневом [README](../README.md). Для него используются `backend/Dockerfile`, `docker-compose.production.yml` и переменные из `.env.production` в корне репозитория.
