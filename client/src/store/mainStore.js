import { defineStore } from 'pinia';
import { keepAlive, getCurrentUser, logout } from '@/api/auth'; // Importamos las funciones de auth.js
import router from '@/router';
import { io } from "socket.io-client";

let socket = null; // socket global

export const useAuthStore = defineStore('auth', {
  state: () => ({
    //user: localStorage.getItem("user") || null,  // Cargar nombre de usuario almacenado
    //role: localStorage.getItem("role") || null,  // Cargar role almacenado
    user: null,
    role: null,
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
    logoutLoading: false,
    logoutStatus: 'loading',
    logoutMessage: 'Cerrando sesión...',
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
        this.logout();
      }, this.inactivityLimit);
    },

    async keepSessionAlive() {
      try {
        await keepAlive();  // Llamada a la función que renovará la sesión
        console.log("🟢 Sesión renovada");
        this.resetSessionTimer();  // Reiniciar temporizador al renovar token
      } catch (error) {
        console.warn("⚠️ No se pudo renovar la sesión", error);
        this.logout();
      }
    },

    async logout() {
      const authStore = useAuthStore();

      this.logoutLoading = true;
      this.logoutStatus = 'loading';
      this.logoutMessage = 'Cerrando sesión...';
      
      console.log("🔴 Cerrando sesión...");

      try {
        await logout();  // Llamada a la función que cierra la sesión
        this.logoutStatus = 'success';
        this.logoutMessage = 'Sesión cerrada correctamente';
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
        this.logoutStatus = 'success';
        this.logoutMessage = 'Sesión cerrada';
      } finally {
        authStore.user = null;
        authStore.role = null;

        this.disconnectSocket();

        clearTimeout(this.sessionTimeout);
        clearTimeout(this.warningTimeout);
        this.showWarning = false;
        this.sessionTimeout = null;
        this.warningTimeout = null;

        setTimeout(async () => {
          this.logoutLoading = false;
          await router.push('/login');
        }, 1000);
      }
    },

    setLoading(status) {
      this.isLoading = status;
    },

    //Simulación de carga de 3s si se decide que alguna
    //operación necesita simular un estado de stand-by
    //para mejorar la experiencia de usuario final
    simulateLoading() {
      this.setLoading(true);
      setTimeout(() => {
        this.setLoading(false);
      }, 3000); // 3 segundos
    },

    connectSocket() {
      // Si el socket ya existe
      if (socket) {
        if (socket.connected) {
          console.log("📡 Socket ya conectado. No se crea uno nuevo.");
          return;
        }

        if (socket.connecting) {
          console.log("⏳ Socket en proceso de conexión. Esperando...");
          return;
        }

        // Si existe pero está en estado raro o desconectado
        console.warn("🔄 Socket anterior inválido. Cerrando y creando uno nuevo.");
        socket.disconnect();
        socket = null;
      }

      console.log("⚙️ Creando nuevo socket...");

      //Creamos socket en un namespace especifico para control de sesiones
      socket = io(`${window.location.origin}/session`, {
        path: "/socket.io",
        withCredentials: true,
        reconnectionAttempts: 3,
        timeout: 5000
      });

      socket.on("connect", () => {
        console.log("✅ Conectado a WebSocket para control de sesión");
      });

      socket.on("disconnect", () => {
        console.log("🔌 Socket desconectado");
      });

      socket.on("force-logout", (payload) => {
        console.warn("🔴 Logout forzado recibido:", payload?.reason);
        alert(payload?.reason || "Has sido desconectado por un administrador.");
        this.logout();
      });
    },

    disconnectSocket() {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    }
  }
});