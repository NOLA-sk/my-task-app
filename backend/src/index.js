// src/index.js

// === ИМПОРТЫ ===
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { protect } from './middleware/auth.js';

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

// === МАРШРУТЫ АВТОРИЗАЦИИ ===

// 📝 РЕГИСТРАЦИЯ НОВОГО ПОЛЬЗОВАТЕЛЯ
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 1. Валидация
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }
    
    // 2. Проверяем, не занят ли email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }
    
    // 3. Хешируем пароль
    const { hashPassword } = await import('./utils/hash.js');
    const passwordHash = await hashPassword(password);
    
    // 4. Создаём пользователя
    const newUser = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true }
    });
    
    // 5. Генерируем токен
    const { generateToken } = await import('./utils/auth.js');
    const token = generateToken(newUser);
    
    // 6. Возвращаем пользователя и токен
    res.status(201).json({
      user: newUser,
      token
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🔐 ВХОД (ПОЛУЧЕНИЕ ТОКЕНА)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 1. Валидация
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }
    
    // 2. Ищем пользователя
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    
    // 3. Проверяем пароль
    const { verifyPassword } = await import('./utils/hash.js');
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    
    // 4. Генерируем токен
    const { generateToken } = await import('./utils/auth.js');
    const token = generateToken(user);
    
    // 5. Возвращаем токен (пароль не отдаём!)
    res.json({
      user: { id: user.id, email: user.email },
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 👤 ПОЛУЧИТЬ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ (защищённый маршрут)
app.get('/api/auth/me', protect, async (req, res) => {
  try {
    // req.user уже добавлен middleware protect()
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, createdAt: true }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: error.message });
  }
});

// === МАРШРУТЫ: РАСШАРИВАНИЕ ЗАДАЧ ===

// 🔗 Добавить доступ к задаче для другого пользователя
app.post('/api/tasks/:id/share', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const ownerId = req.user.id;
    
    // 1. Валидация
    if (!email) {
      return res.status(400).json({ error: 'Email пользователя обязателен' });
    }
    
    // 2. Проверяем, что задача существует и принадлежит текущему пользователю
    const task = await prisma.task.findUnique({ where: { id: parseInt(id) } });
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    if (task.userId !== ownerId) {
      return res.status(403).json({ error: 'Нет прав на расшаривание этой задачи' });
    }
    
    // 3. Находим пользователя по email
    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    if (targetUser.id === ownerId) {
      return res.status(400).json({ error: 'Нельзя расшарить задачу самому себе' });
    }
    
    // 4. Создаём запись в shared_access (игнорируем дубликаты)
    const shared = await prisma.sharedAccess.create({
       data: {
        taskId: parseInt(id),
        userId: targetUser.id
      }
    });
    
    res.status(201).json({ 
      message: 'Доступ предоставлен', 
      shared: { taskId: shared.taskId, userId: shared.userId } 
    });
    
  } catch (error) {
    // Обработка ошибки дубликата (если доступ уже есть)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Доступ уже предоставлен этому пользователю' });
    }
    console.error('Share error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🔗 Убрать доступ к задаче
app.delete('/api/tasks/:id/share/:userId', protect, async (req, res) => {
  try {
    const { id, userId } = req.params;
    const ownerId = req.user.id;
    
    // Проверяем права: только владелец задачи может убрать доступ
    const task = await prisma.task.findUnique({ where: { id: parseInt(id) } });
    if (!task || task.userId !== ownerId) {
      return res.status(403).json({ error: 'Нет прав на управление доступом' });
    }
    
    // Удаляем доступ
    await prisma.sharedAccess.delete({
      where: {
        taskId_userId: {
          taskId: parseInt(id),
          userId: parseInt(userId)
        }
      }
    });
    
    res.json({ message: 'Доступ удалён' });
    
  } catch (error) {
    console.error('Unshare error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 📋 Получить задачи, которые расшарили мне
app.get('/api/tasks/shared', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Находим все задачи, которые расшарили текущему пользователю
    const sharedTasks = await prisma.sharedAccess.findMany({
      where: { userId },
      include: {
        task: {
          include: {
            user: { select: { id: true, email: true } }
          }
        }
      }
    });
    
    // Возвращаем только задачи (без обёртки sharedAccess)
    const tasks = sharedTasks.map(sa => sa.task);
    
    res.json(tasks);
    
  } catch (error) {
    console.error('Get shared tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// // 📋 Получить все задачи (тестовый маршрут)
// app.get('/api/tasks', protect, async (req, res) => {
//   try {
//     const tasks = await prisma.task.findMany({
//       where: { userId: req.user.id },
//       include: { 
//         user: { 
//           select: { id: true, email: true } // Возвращаем только нужные поля пользователя
//         } 
//       },
//       orderBy: { createdAt: 'desc' } // Сортируем по дате создания (новые сверху)
//     });
//     res.json(tasks);
//   } catch (error) {
//     console.error('Error fetching tasks:', error);
//     res.status(500).json({ error: error.message });
//   }
// });
// 📋 Получить все задачи (свои + расшаренные)
app.get('/api/tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Получаем свои задачи
    const myTasks = await prisma.task.findMany({
      where: { userId },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    
    // Получаем расшаренные мне задачи
    const sharedAccess = await prisma.sharedAccess.findMany({
      where: { userId },
      include: {
        task: {
          include: { user: { select: { id: true, email: true } } }
        }
      }
    });
    const sharedTasks = sharedAccess.map(sa => sa.task);
    
    // Объединяем и сортируем
    const allTasks = [...myTasks, ...sharedTasks].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    res.json(allTasks);
    
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// // ➕ СОЗДАТЬ НОВУЮ ЗАДАЧУ
// app.post('/api/tasks', async (req, res) => {
//   try {
//     // 1. Получаем данные из тела запроса
//     const { title, userId } = req.body;
    
//     // 2. Простая валидация: проверяем обязательные поля
//     if (!title || !userId) {
//       return res.status(400).json({ error: 'Title и userId обязательны' });
//     }
    
//     // 3. Проверяем, существует ли пользователь с таким ID
//     const user = await prisma.user.findUnique({ 
//       where: { id: parseInt(userId) } 
//     });
    
//     if (!user) {
//       return res.status(400).json({ error: 'Пользователь не найден' });
//     }
    
//     // 4. Создаём задачу в базе
//     const newTask = await prisma.task.create({
//        data: {
//         title,                    // Короткая запись: title: title
//         userId: parseInt(userId), // Превращаем строку в число
//         isCompleted: false        // Новая задача по умолчанию не выполнена
//       },
//       include: { 
//         // Сразу возвращаем данные пользователя в ответе
//         user: { select: { id: true, email: true } } 
//       }
//     });
    
//     // 5. Возвращаем созданную задачу с кодом 201 (Created)
//     res.status(201).json(newTask);
    
//   } catch (error) {
//     console.error('Error creating task:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// ➕ СОЗДАТЬ НОВУЮ ЗАДАЧУ (теперь только для авторизованных)
app.post('/api/tasks', protect, async (req, res) => {
  try {
    const { title } = req.body;
    const userId = req.user.id; // ← Берём из токена, а не из body!
    
    if (!title) {
      return res.status(400).json({ error: 'Title обязателен' });
    }
    
    const newTask = await prisma.task.create({
        data: {
        title,
        userId,
        isCompleted: false
      },
      include: { user: { select: { id: true, email: true } } }
    });
    
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

// // ✏️ ОБНОВИТЬ ЗАДАЧУ
// app.put('/api/tasks/:id', async (req, res) => {
//   try {
//     // 1. Получаем ID из маршрута и новые данные из тела
//     const { id } = req.params;
//     const { title, isCompleted } = req.body;
    
//     // 2. Проверяем, существует ли задача
//     const existingTask = await prisma.task.findUnique({ 
//       where: { id: parseInt(id) } 
//     });
    
//     if (!existingTask) {
//       return res.status(404).json({ error: 'Задача не найдена' });
//     }
    
//     // 3. Обновляем только те поля, которые пришли в запросе
//     const updatedTask = await prisma.task.update({
//       where: { id: parseInt(id) },
//        data: {
//         // Если title пришёл — используем его, иначе оставляем старый
//         title: title !== undefined ? title : existingTask.title,
//         // То же самое для isCompleted
//         isCompleted: isCompleted !== undefined ? isCompleted : existingTask.isCompleted
//       },
//       include: { 
//         user: { select: { id: true, email: true } } 
//       }
//     });
    
//     // 4. Возвращаем обновлённую задачу
//     res.json(updatedTask);
    
//   } catch (error) {
//     console.error('Error updating task:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// ✏️ ОБНОВИТЬ ЗАДАЧУ (только свою!)
app.put('/api/tasks/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, isCompleted } = req.body;
    const userId = req.user.id;
    
    // Проверяем, что задача существует и принадлежит пользователю
    const existingTask = await prisma.task.findUnique({ 
      where: { id: parseInt(id) } 
    });
    
    if (!existingTask) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    
    // 🔐 Проверка прав: пользователь может менять только свои задачи
    if (existingTask.userId !== userId) {
      return res.status(403).json({ error: 'Нет прав на изменение этой задачи' });
    }
    
    const updatedTask = await prisma.task.update({
      where: { id: parseInt(id) },
       data: {
        title: title !== undefined ? title : existingTask.title,
        isCompleted: isCompleted !== undefined ? isCompleted : existingTask.isCompleted
      },
      include: { user: { select: { id: true, email: true } } }
    });
    
    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// // 🗑️ УДАЛИТЬ ЗАДАЧУ
// app.delete('/api/tasks/:id', async (req, res) => {
//   try {
//     // 1. Получаем ID из параметров маршрута
//     const { id } = req.params;
    
//     // 2. Проверяем, существует ли задача
//     const existingTask = await prisma.task.findUnique({ 
//       where: { id: parseInt(id) } 
//     });
    
//     if (!existingTask) {
//       return res.status(404).json({ error: 'Задача не найдена' });
//     }
    
//     // 3. Удаляем задачу из базы
//     await prisma.task.delete({
//       where: { id: parseInt(id) }
//     });
    
//     // 4. Возвращаем подтверждение удаления
//     res.json({ 
//       message: 'Задача успешно удалена', 
//       deletedId: parseInt(id) 
//     });
    
//   } catch (error) {
//     console.error('Error deleting task:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// 🗑️ УДАЛИТЬ ЗАДАЧУ (только свою!)
app.delete('/api/tasks/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const existingTask = await prisma.task.findUnique({ 
      where: { id: parseInt(id) } 
    });
    
    if (!existingTask) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    
    // 🔐 Проверка прав
    if (existingTask.userId !== userId) {
      return res.status(403).json({ error: 'Нет прав на удаление этой задачи' });
    }
    
    await prisma.task.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ message: 'Задача успешно удалена', deletedId: parseInt(id) });
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