# Frontend

Клиентское приложение Telegraph Clone. Позволяет создавать и редактировать статьи, загружать изображения и открывать опубликованные материалы.

## Стек

- React и TypeScript;
- Vite;
- React Router;
- TanStack Query для запросов и кэша;
- TanStack Form для формы редактора;
- TipTap rich-text редактор;
- CSS Modules и FSD-структура проекта.

## Страницы

| Маршрут | Назначение |
| --- | --- |
| `/` | Создание статьи |
| `/articles` | Список статей |
| `/:slug` | Публичная страница статьи |
| `/:slug/edit` | Редактирование и удаление статьи |

## Подготовка и запуск

Установите зависимости:

```bash
npm install
```

Запустите приложение:

```bash
npm run dev
```

По умолчанию оно будет доступно по адресу `http://localhost:5173` и обращается к API на `http://localhost:3000`.

Чтобы использовать другой адрес API, создайте `.env.local`:

```env
VITE_API_URL=http://localhost:3000
```

Для полноценной локальной работы также запустите backend и его PostgreSQL/MinIO-инфраструктуру — инструкции есть в [README backend](../backend/README.md).

## Команды

```bash
npm run dev          # запуск Vite в режиме разработки
npm run build        # проверка TypeScript и production-сборка
npm run preview      # просмотр собранного приложения
npm run lint         # проверка ESLint
npm run format       # форматирование исходников
npm run format:check # проверка форматирования
```

## Структура `src`

```text
app/       # провайдеры, роутер и глобальные стили
pages/     # страницы приложения
widgets/   # крупные составные блоки интерфейса
features/  # пользовательские сценарии, включая редактор
entities/  # сущность Article, API и запросы
shared/    # общие UI-компоненты, API-клиент и утилиты
```

## Production

В production frontend собирается в Docker-образ и раздаётся Nginx. Запросы к `/api` проксируются во внутренний backend. Общая инструкция по развёртыванию находится в корневом [README](../README.md).
