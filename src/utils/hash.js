// src/utils/hash.js
import bcrypt from 'bcryptjs';

/**
 * Хеширует пароль перед сохранением в базу
 * @param {string} password - Пароль в открытом виде
 * @returns {Promise<string>} Хеш пароля
 */
export async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Проверяет, совпадает ли пароль с хешем
 * @param {string} password - Пароль от пользователя
 * @param {string} hash - Хеш из базы данных
 * @returns {Promise<boolean>} true если пароль верный
 */
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}