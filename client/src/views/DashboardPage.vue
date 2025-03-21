<template>
  <div class="dashboard">
    <div class="logout">
      <span v-if="authStore.user" class="user-name">
        ¡Hola! <strong>{{ authStore.user }}</strong>
      </span>
      <a href="#" @click.prevent="logout" class="logout-link">Cerrar sesión</a>
    </div>

    <h1>Dashboard</h1>

    <div v-for="(category, index) in devicesWithComponents" :key="index" class="device-category">
      <h2>{{ category.category }}</h2>

      <div v-for="device in category.devices" :key="device.type" class="device-container">
        <component :is="device.component" v-if="device.component" />
      </div>

      <hr class="separador"> <!-- 🔹 Separador estilizado -->
    </div>

    <!-- ⚠️ Aviso de que la sesión expirará pronto -->
    <div v-if="showWarning" class="session-warning">
      ⚠️ Tu sesión expirará en 1 minuto. Toca o haz clic para continuar.
    </div>

    <!-- Overlay de cierre de sesión -->
    <div v-if="logoutLoading" class="overlay">
      <div class="loading-container">
        <div v-if="logoutStatus === 'loading'" class="spinner"></div>
        <div v-if="logoutStatus === 'success'" class="status-icon success">✔️</div>
        <p>{{ logoutMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import api from '../api';
import { io } from "socket.io-client";
import { useAuthStore } from '../store/auth';
import componentMap from '../components/DeviceMapper';

export default {
  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },

  data() {
    return {
      devices: [],  // Lista de dispositivos obtenidos desde Node-RED
      socket: null,
      alarmStatus: false,
      sessionTimeout: null,
      warningTimeout: null,
      showWarning: false,
      inactivityLimit: 5 * 60 * 1000, // 5 minutos de inactividad
      warningTime: 4 * 60 * 1000, // Mostrar aviso 1 min antes
      loading: false,
      logoutLoading: false, // Controla el overlay de cierre de sesión
      logoutStatus: 'loading', // Puede ser 'loading' o 'success'
      logoutMessage: 'Cerrando sesión...' // Mensaje debajo del spinner
    };
  },

  async mounted() {
    console.log("Componentes mapeados:", componentMap);

    console.log("Usuario en Pinia al montar Dashboard:", this.authStore.user);
    this.resetSessionTimer(); // Inicia el temporizador de sesión

    await this.loadDevices();

    this.socket = io(window.location.origin, {
      path: "/socket.io",
      withCredentials: true
      //transports: ["websocket"]
    });

    this.socket.on("connect", () => {
      console.log("✅ Conectado a WebSocket");
    });

    this.socket.on("disconnect", () => {
      console.log("🔴 Desconectado de WebSocket");
    });

    window.addEventListener("click", this.resetSessionTimer);
    window.addEventListener("keypress", this.resetSessionTimer);
    window.addEventListener("touchstart", this.resetSessionTimer);
  },

  beforeUnmount() {
    window.removeEventListener("click", this.resetSessionTimer);
    window.removeEventListener("keypress", this.resetSessionTimer);
    window.removeEventListener("touchstart", this.resetSessionTimer);
    clearTimeout(this.sessionTimeout);
    clearTimeout(this.warningTimeout);
  },

  computed: {
    groupedDevices() {
      const grouped = {};
      this.devices.forEach(device => {
        if (!grouped[device.category]) {
          grouped[device.category] = { category: device.category, devices: [] };
        }
        grouped[device.category].devices.push(device);
      });
      
      return Object.values(grouped);
    },
    devicesWithComponents() {
      return this.groupedDevices.map(category => ({
        category: category.category,
        devices: category.devices.map(device => ({
          ...device,
          component: componentMap[device.type] || null
        }))
      }));
    }
  },
  methods: {
    async loadDevices() {
      try {
        const response = await api.get('/devices/get-devices');
        if (response.data.success) {
          console.log("📥 Dispositivos obtenidos:", response.data);
          this.devices = response.data.devices || [];  // ✅ Si es undefined, asigna []
        } else {
          console.error("⚠️ Respuesta inesperada del backend:", response.data);
          this.devices = [];
        }
      } catch (error) {
        console.error("❌ Error al obtener dispositivos:", error);
      }
    },

    getComponent(tipo) {
      console.log("Obteniendo componente del tipo:",tipo);
      return componentMap[tipo] || null;
    },

    async logout() {
      this.logoutLoading = true;
      this.logoutStatus = 'loading';
      this.logoutMessage = 'Cerrando sesión...';
      
      try {
        await api.post('/auth/logout');
        this.logoutStatus = 'success';
        this.logoutMessage = 'Sesión cerrada correctamente';

        setTimeout(() => {
          this.$router.push('/');
        }, 1000);
      } catch (error) {
        console.error('Error durante el logout:', error);
        this.$router.push('/');
      }
    },

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
  }
};
</script>

<style scoped>
/* Estilos generales */
.dashboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  margin-top: 50px;
}

.separador {
  width: 80%; /* En lugar de 100%, ocupa solo el 80% del contenido */
  max-width: 600px; /* Limita el ancho máximo */
  height: 2px;
  background: linear-gradient(to right, #ccc, #666, #ccc);
  margin: 20px auto; /* Centra horizontalmente */
  display: block;
}

/* 🔹 Ajustes para la esquina superior derecha */
.logout {
  position: absolute;
  top: 10px;
  right: 10px;
  text-align: right;
}

.user-name {
  font-size: 14px;
  font-weight: bold;
  display: block;
}

.logout-link {
  text-decoration: none;
  color: #007bff;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  display: block;
}

.logout-link:hover {
  text-decoration: underline;
  color: #0056b3;
}

/* Aviso de sesión expirada */
.session-warning {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: red;
  color: white;
  padding: 10px 15px;
  border-radius: 5px;
  font-size: 14px;
  font-weight: bold;
}

/* Contenedor del stream de la cámara */
.camera-container {
  width: 90vw;  /* Se adapta al ancho del dispositivo */
  max-width: 600px;  /* No más grande que 600px en escritorio */
  margin: 20px auto 0; /* Centrado y separado del botón */
  padding: 10px;
  background: black; /* Fondo oscuro para mejor contraste */
  border: 3px solid #007bff;
  border-radius: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  aspect-ratio: 1 / 1; /* Cuadro perfectamente cuadrado */
}

/* Ajuste del stream */
.camera-container img {
  width: 100%;
  height: 100%;
  object-fit: contain; /* Evita distorsión */
  border-radius: 5px;
}

/* Evita el autozoom en móviles */
input {
  font-size: 16px; /* Evita que los navegadores móviles hagan zoom en inputs */
}
/* ✅ Overlay de cierre de sesión */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: white;
  padding: 20px;
  border-radius: 15px;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
  text-align: center;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(0, 0, 0, 0.1);
  border-top-color: #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-icon {
  font-size: 50px;
  margin-bottom: 10px;
}

.success {
  color: green !important;
}
</style>