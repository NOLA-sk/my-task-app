// src/utils/auth.js
import jwt from 'jsonwebtoken';

/**
 * Генерирует JWT-токен для пользователя
 * @param {Object} user - Объект пользователя с полями id, email
 * @returns {string} JWT-токен
 */
export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },  // Полезная нагрузка (payload)
    process.env.JWT_SECRET,                   // Секретный ключ
    { expiresIn: '7d' }                       // Токен действителен 7 дней
  );
}

/**
 * Извлекает данные пользователя из токена
 * @param {string} token - JWT-токен из заголовка
 * @returns {Object|null} Данные пользователя или null
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null; // Токен недействителен или истёк
  }
}