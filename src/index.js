// src/index.js

// === ИМПОРТЫ ===
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Prisma с адаптером для PostgreSQL
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

// === ЗАГРУЗКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ ===
dotenv.config();

// === НАСТРОЙКА PRISMA С АДАПТЕРОМ ===
// Создаём адаптер для подключения к PostgreSQL
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

// Инициализируем Prisma Client с адаптером
const prisma = new PrismaClient({ adapter });

// === НАСТРОЙКА EXPRESS ===
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Разрешаем CORS (запросы с фронтенда)
app.use(express.json()); // Парсим JSON в теле запросов

// === МАРШРУТЫ ===

// 🏠 Главная страница — проверка работы сервера
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Сервер работает! API готов.',
    timestamp: new Date().toISOString()
  });
});

// 🩺 Health check — проверка подключения к базе данных
app.get('/api/health', async (req, res) => {
  try {
    // Проверяем подключение, выполняя простой запрос
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// 📋 Получить все задачи (тестовый маршрут)
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      include: { 
        user: { 
          select: { id: true, email: true } // Возвращаем только нужные поля пользователя
        } 
      },
      orderBy: { createdAt: 'desc' } // Сортируем по дате создания (новые сверху)
    });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// ➕ СОЗДАТЬ НОВУЮ ЗАДАЧУ
app.post('/api/tasks', async (req, res) => {
  try {
    // 1. Получаем данные из тела запроса
    const { title, userId } = req.body;
    
    // 2. Простая валидация: проверяем обязательные поля
    if (!title || !userId) {
      return res.status(400).json({ error: 'Title и userId обязательны' });
    }
    
    // 3. Проверяем, существует ли пользователь с таким ID
    const user = await prisma.user.findUnique({ 
      where: { id: parseInt(userId) } 
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Пользователь не найден' });
    }
    
    // 4. Создаём задачу в базе
    const newTask = await prisma.task.create({
       data: {
        title,                    // Короткая запись: title: title
        userId: parseInt(userId), // Превращаем строку в число
        isCompleted: false        // Новая задача по умолчанию не выполнена
      },
      include: { 
        // Сразу возвращаем данные пользователя в ответе
        user: { select: { id: true, email: true } } 
      }
    });
    
    // 5. Возвращаем созданную задачу с кодом 201 (Created)
    res.status(201).json(newTask);
    
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🔍 ПОЛУЧИТЬ ОДНУ ЗАДАЧУ ПО ID
app.get('/api/tasks/:id', async (req, res) => {
  try {
    // 1. Получаем ID из параметров маршрута
    const { id } = req.params;
    
    // 2. Ищем задачу в базе по ID
    const task = await prisma.task.findUnique({
      where: { id: parseInt(id) },  // Превращаем строку в число
      include: { 
        // Подключаем данные пользователя (но только email и id)
        user: { select: { id: true, email: true } } 
      }
    });
    
    // 3. Если задача не найдена — возвращаем ошибку 404
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    
    // 4. Возвращаем найденную задачу
    res.json(task);
    
  } catch (error) {
    // 5. Если произошла ошибка — логируем и возвращаем 500
    console.error('Error fetching task:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✏️ ОБНОВИТЬ ЗАДАЧУ
app.put('/api/tasks/:id', async (req, res) => {
  try {
    // 1. Получаем ID из маршрута и новые данные из тела
    const { id } = req.params;
    const { title, isCompleted } = req.body;
    
    // 2. Проверяем, существует ли задача
    const existingTask = await prisma.task.findUnique({ 
      where: { id: parseInt(id) } 
    });
    
    if (!existingTask) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    
    // 3. Обновляем только те поля, которые пришли в запросе
    const updatedTask = await prisma.task.update({
      where: { id: parseInt(id) },
       data: {
        // Если title пришёл — используем его, иначе оставляем старый
        title: title !== undefined ? title : existingTask.title,
        // То же самое для isCompleted
        isCompleted: isCompleted !== undefined ? isCompleted : existingTask.isCompleted
      },
      include: { 
        user: { select: { id: true, email: true } } 
      }
    });
    
    // 4. Возвращаем обновлённую задачу
    res.json(updatedTask);
    
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🗑️ УДАЛИТЬ ЗАДАЧУ
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    // 1. Получаем ID из параметров маршрута
    const { id } = req.params;
    
    // 2. Проверяем, существует ли задача
    const existingTask = await prisma.task.findUnique({ 
      where: { id: parseInt(id) } 
    });
    
    if (!existingTask) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    
    // 3. Удаляем задачу из базы
    await prisma.task.delete({
      where: { id: parseInt(id) }
    });
    
    // 4. Возвращаем подтверждение удаления
    res.json({ 
      message: 'Задача успешно удалена', 
      deletedId: parseInt(id) 
    });
    
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

// === ЗАПУСК СЕРВЕРА ===
app.listen(PORT, () => {
  console.log(`🔥 Сервер запущен на порту ${PORT}`);
  console.log(`📡 API доступно по адресу: http://localhost:${PORT}`);
  console.log(`🗄️  База данных: ${process.env.DATABASE_URL ? 'подключена' : 'ошибка конфигурации'}`);
});

// === КОРРЕКТНОЕ ЗАВЕРШЕНИЕ РАБОТЫ ===
// Закрываем соединение с БД при остановке сервера (Ctrl+C)
process.on('SIGINT', async () => {
  console.log('\n🔌 Завершение работы...');
  await prisma.$disconnect();
  console.log('✅ Prisma отключена');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔌 Завершение работы (SIGTERM)...');
  await prisma.$disconnect();
  console.log('✅ Prisma отключена');
  process.exit(0);
});