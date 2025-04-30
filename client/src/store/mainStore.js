import { defineStore } from 'pinia';
import { keepAlive, getCurrentUser, logout } from '@/api/auth'; // Importamos las funciones de auth.js
import router from '@/router';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    //user: localStorage.getItem("user") || null,  // Cargar nombre de usuario almacenado
    //role: localStorage.getItem("role") || null,  // Cargar role almacenado
    user: null,
    role: null,
    logoutLoading: false,
    logoutStatus: 'loading',
    logoutMessage: 'Cerrando sesión...',
  }),
  actions: {
    async hydrateFromServer() {
      try {
        const userData = await getCurrentUser();
        this.user = userData.username;
        this.role = userData.role;
        console.log("🔄 Usuario restaurado desde /me:", userData);
      } catch (err) {
        console.warn("⚠️ No se pudo hidratar usuario desde /me", err);
        this.user = null;
        this.role = null;
        router.push('/login'); // Redirige si el usuario no está autenticado
      }
    },

    setUser(user) {
      this.user = user.username;
      this.role = user.role;
      //localStorage.setItem("user", user.username);
      //localStorage.setItem("role", user.role);
    },

    async logout() {
      this.logoutLoading = true;
      this.logoutStatus = 'loading';
      this.logoutMessage = 'Cerrando sesión...';
      
      console.log("🔴 Cerrando sesión...");
      try {
        await logout();  // Llamada a la función que cierra la sesión
        this.logoutStatus = 'success';
        this.logoutMessage = 'Sesión cerrada correctamente';
        
        setTimeout(() => {
          router.push('/login');
          this.logoutLoading = false; // Oculta overlay después de redirigir
          this.user = null;
          this.role = null;
          //localStorage.removeItem("user");
          //localStorage.removeItem("role");
        }, 1000);
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
        router.push('/login');
      }
    }
  }
});

export const useSessionStore = defineStore('session', {
  state: () => ({
    showWarning: false,
    sessionTimeout: null,
    warningTimeout: null,
    inactivityLimit: 5 * 60 * 1000, // 5 minutos
    warningTime: 4 * 60 * 1000, // Aviso 1 min antes
    isLoading: false,
    loadingMessage: 'Cargando...',
  }),

  actions: {
    resetSessionTimer() {
      clearTimeout(this.sessionTimeout);
      clearTimeout(this.warningTimeout);
      this.showWarning = false;

      this.warningTimeout = setTimeout(() => {
        this.showWarning = true;
      }, this.warningTime);

      this.sessionTimeout = setTimeout(() => {
        useAuthStore().logout();
      }, this.inactivityLimit);
    },

    async keepSessionAlive() {
      try {
        await keepAlive();  // Llamada a la función que renovará la sesión
        console.log("✅ Sesión renovada");
        this.resetSessionTimer();  // Reiniciar temporizador al renovar token
      } catch (error) {
        console.warn("⚠️ No se pudo renovar la sesión", error);
      }
    },

    setLoading(status) {
      this.isLoading = status;
    },

    // Simulación de carga
    simulateLoading() {
      this.setLoading(true);
      setTimeout(() => {
        this.setLoading(false);
      }, 3000); // 3 segundos
    }
  }
});