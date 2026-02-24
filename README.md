# LawLogix AI

RAG-приложение для юридических советов на основе судебной практики.

## Стек

- **Frontend:** React 19, Vite, TypeScript
- **Backend:** Supabase (Auth, Postgres, Realtime, Edge Functions)
- **Поиск:** pgvector + эмбеддинги gte-small (Supabase)
- **LLM:** GitHub Models (DeepSeek v3)

## Функционал

- **Авторизация:** регистрация, вход, выход (email + пароль)
- **Диалоги:** список, создание нового, выбор существующего
- **RAG:** семантический поиск по базе дел (top-K фрагментов), ответ с учётом контекста
- **Чат:** отправка сообщения, ответ ассистента, история, блок «Источники» под ответом

## Быстрый старт

### 1. Supabase

1. Создайте проект на [supabase.com](https://supabase.com).
2. В SQL Editor выполните миграции из `supabase/migrations/` по порядку.
3. Включите Email auth в Authentication → Providers.

### 2. Секреты Edge Functions

В Dashboard → Edge Functions → Secrets задайте:

- `GITHUB_MODELS_TOKEN` — GitHub PAT с правами **models: read** (для вызова DeepSeek через GitHub Models).

Опционально:

- `GITHUB_MODELS_MODEL` — ID модели (по умолчанию `deepseek/DeepSeek-V3`).

### 3. Деплой Edge Functions

```bash
npx supabase functions deploy rag-chat
npx supabase functions deploy backfill-embeddingsW
```

### 4. Эмбеддинги для дел

В таблицу `case_chunks` добавлены демо-фрагменты (миграция `20250222000002_seed_demo_chunks.sql`). Чтобы заполнить для них эмбеддинги, вызовите один раз Edge Function `backfill-embeddings` (с ключом service_role или из Dashboard):

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/backfill-embeddings" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

Для своих дел: вставляйте строки в `case_chunks` (content, case_number, metadata), затем снова вызывайте `backfill-embeddings`.

### 5. Frontend

```bash
cp .env.example .env
# Заполните VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env

npm install
npm run dev
```

Откройте указанный в консоли URL (обычно http://localhost:5173).

## Страницы

- **Вход:** email, пароль, кнопка «Войти», ссылка на регистрацию.
- **Регистрация:** email, пароль, кнопка «Зарегистрироваться», ссылка на вход.
- **Чат:** левый сайдбар — список диалогов и «Новый диалог»; основная область — история сообщений, поле ввода и кнопка отправки; под ответом ассистента — блок «Источники» (до 8 элементов); индикатор загрузки при генерации ответа.

## Структура проекта

```
LawLogixAi/
├── src/
│   ├── lib/          # supabase, auth, api
│   ├── hooks/        # useDialogs, useMessages
│   └── pages/        # Login, Register, Chat
├── supabase/
│   ├── migrations/   # схема БД, pgvector, seed
│   └── functions/
│       ├── rag-chat/           # RAG: эмбеддинг → поиск → LLM
│       └── backfill-embeddings # заполнение embedding для case_chunks
├── .env.example
└── README.md
```

## Лицензия

MIT
