# 📋 Task Manager API

Простой API для управления задачами с авторизацией и возможностью расшаривания.

## 🚀 Быстрый старт

### Требования
- Node.js 18+
- PostgreSQL 14+
- Prisma CLI

### Установка

```bash
# 1. Клонировать репозиторий
git clone <твой-репозиторий>
cd backend

# 2. Установить зависимости
npm install

# 3. Настроить переменные окружения
cp .env.example .env
# Отредактировать .env: добавить DATABASE_URL и JWT_SECRET

# 4. Применить миграции базы данных
npx prisma migrate dev

# 5. Запустить сервер
npm run dev

# Авторизация
Authorization: Bearer <ваш_токен>

# 📝 Регистрация нового пользователя
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password_123"
}

# 🔑 Вход (получение токена)
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password_123"
}

# 👤 Получить текущего пользователя
GET /api/auth/me
Authorization: Bearer <токен>

# 📋 Задачи
# 📥 Получить все задачи (свои + расшаренные)
GET /api/tasks
Authorization: Bearer <токен>

# ➕ Создать новую задачу
POST /api/tasks
Content-Type: application/json
Authorization: Bearer <токен>

{
  "title": "Новая задача"
}

# 🔍 Получить одну задачу по ID
GET /api/tasks/:id
Authorization: Bearer <токен>

# Ответ (200): Объект задачи
# Ответ (404): {"error": "Задача не найдена"}

# ✏️ Обновить задачу
PUT /api/tasks/:id
Content-Type: application/json
Authorization: Bearer <токен>

{
  "title": "Обновлённое название",
  "isCompleted": true
}

# Можно обновлять только свои задачи. При попытке изменить чужую — 403 Forbidden.

# 🗑️ Удалить задачу
DELETE /api/tasks/:id
Authorization: Bearer <токен>

# Можно удалять только свои задачи.

# 🔗 Расшаривание задач
# 🔗 Добавить доступ к задаче для другого пользователя
POST /api/tasks/:id/share
Content-Type: application/json
Authorization: Bearer <токен>

{
  "email": "friend@example.com"
}

# ⚠️ Расшаривать можно только свои задачи.

# 🔗 Убрать доступ
DELETE /api/tasks/:id/share/:userId
Authorization: Bearer <токен>

# ⚙️ Переменные окружения
# Создай файл .env в корне проекта:
# Подключение к базе данных
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"

# Секретный ключ для JWT (минимум 32 символа)
JWT_SECRET="your_super_secret_key_change_in_production"

# Порт сервера (опционально)
PORT=3000

# Никогда не коммить файл .env в репозиторий!

# Структура базы данных
users
├─ id (PK)
├─ email (unique)
├─ password_hash
└─ created_at

tasks
├─ id (PK)
├─ title
├─ is_completed
├─ created_at
├─ user_id (FK → users.id)
└─ user (relation)

shared_access
├─ id (PK)
├─ task_id (FK → tasks.id)
├─ user_id (FK → users.id)
└─ UNIQUE(task_id, user_id)


