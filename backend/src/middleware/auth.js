// src/middleware/auth.js
import { verifyToken } from '../utils/auth.js';

/**
 * Middleware: проверяет JWT-токен в заголовке Authorization
 * Если токен валиден — добавляет req.user и вызывает next()
 * Если нет — возвращает ошибку 401
 */
export function protect(req, res, next) {
  // 1. Получаем токен из заголовка
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  
  // 2. Извлекаем токен (убираем "Bearer ")
  const token = authHeader.slice(7);
  
  // 3. Проверяем токен
  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: 'Неверный или истёкший токен' });
  }
  
  // 4. Добавляем пользователя в запрос и продолжаем
  req.user = {
    id: payload.userId,
    email: payload.email
  };
  
  next();
}