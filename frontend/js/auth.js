// API URL (бэкенд)
const API_URL = 'http://localhost:3000/api';

/**
 * Регистрация пользователя
 */
async function register(email, password) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Ошибка регистрации');
  }
  
  return data;
}

/**
 * Вход пользователя
 */
async function login(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Ошибка входа');
  }
  
  return data;
}

/**
 * Получить текущего пользователя
 */
async function getMe(token) {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Ошибка авторизации');
  }
  
  return data;
}

/**
 * Сохранить токен в localStorage
 */
function saveToken(token) {
  localStorage.setItem('token', token);
}

/**
 * Получить токен из localStorage
 */
function getToken() {
  return localStorage.getItem('token');
}

/**
 * Удалить токен
 */
function removeToken() {
  localStorage.removeItem('token');
}