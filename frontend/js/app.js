const { createApp } = Vue;

createApp({
  data() {
    return {
      user: null,
      tasks: [],
      showLogin: true,
      authForm: { email: '', password: '' },
      newTaskTitle: '',
      showShareModal: null,
      shareEmail: '',
      alert: null
    };
  },
  
  async mounted() {
    // Проверяем, есть ли сохранённый токен
    const token = getToken();
    if (token) {
      try {
        this.user = await getMe(token);
        await this.loadTasks();
      } catch (error) {
        removeToken();
        this.showAlert('Сессия истекла. Войдите снова.', 'warning');
      }
    }
  },
  
  methods: {
    // === Авторизация ===
    async auth() {
      try {
        let result;
        if (this.showLogin) {
          // Вход
          result = await login(this.authForm.email, this.authForm.password);
        } else {
          // Регистрация
          result = await register(this.authForm.email, this.authForm.password);
        }
        
        saveToken(result.token);
        this.user = result.user;
        await this.loadTasks();
        this.authForm = { email: '', password: '' };
        this.showAlert('Успешно!', 'success');
      } catch (error) {
        this.showAlert(error.message, 'danger');
      }
    },
    
    logout() {
      removeToken();
      this.user = null;
      this.tasks = [];
      this.showAlert('Вы вышли из системы', 'info');
    },
    
    // === Задачи ===
    async loadTasks() {
      try {
        const token = getToken();
        const response = await fetch(`${API_URL}/tasks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки задач');
        
        this.tasks = await response.json();
      } catch (error) {
        this.showAlert(error.message, 'danger');
      }
    },
    
    async createTask() {
      try {
        const token = getToken();
        const response = await fetch(`${API_URL}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title: this.newTaskTitle })
        });
        
        if (!response.ok) throw new Error('Ошибка создания задачи');
        
        this.newTaskTitle = '';
        await this.loadTasks();
        this.showAlert('Задача создана!', 'success');
      } catch (error) {
        this.showAlert(error.message, 'danger');
      }
    },
    
    async toggleTask(task) {
      try {
        const token = getToken();
        const response = await fetch(`${API_URL}/tasks/${task.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ isCompleted: !task.isCompleted })
        });
        
        if (!response.ok) throw new Error('Ошибка обновления');
        
        await this.loadTasks();
      } catch (error) {
        this.showAlert(error.message, 'danger');
      }
    },
    
    async deleteTask(task) {
      if (!confirm(`Удалить задачу "${task.title}"?`)) return;
      
      try {
        const token = getToken();
        const response = await fetch(`${API_URL}/tasks/${task.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Ошибка удаления');
        
        await this.loadTasks();
        this.showAlert('Задача удалена', 'success');
      } catch (error) {
        this.showAlert(error.message, 'danger');
      }
    },
    
    // === Расшаривание ===
    async shareTask() {
      try {
        const token = getToken();
        const response = await fetch(`${API_URL}/tasks/${this.showShareModal.id}/share`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email: this.shareEmail })
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Ошибка расшаривания');
        }
        
        this.showShareModal = null;
        this.shareEmail = '';
        this.showAlert('Доступ предоставлен!', 'success');
      } catch (error) {
        this.showAlert(error.message, 'danger');
      }
    },
    
    // === Утилиты ===
    showAlert(message, type) {
      this.alert = { message, type };
      setTimeout(() => { this.alert = null; }, 3000);
    },
    
    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
      });
    }
  }
}).mount('body');