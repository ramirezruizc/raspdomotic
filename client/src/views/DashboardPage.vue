<template>
  <div class="dashboard">
    <div class="logout">
      <a href="#" @click.prevent="logout">Cerrar sesión</a>
    </div>
    <h1>RaspDomotic Control</h1>

    <!-- Botón para controlar la bombilla -->
    <button @click="toggleBulb" :disabled="loading">
      {{ bulbState === 'ON' ? 'Apagar Bombilla' : 'Encender Bombilla' }}
    </button>

    <!-- Mensaje sobre el estado de la bombilla -->
    <p v-if="message">{{ message }}</p>

    <!-- Toggle para activar/desactivar la alarma -->
    <div class="toggle-container">
      <span>Alarma:</span>
      <label class="switch">
        <input type="checkbox" v-model="alarma" @change="toggleAlarma">
        <span class="slider"></span>
      </label>
    </div>

    <p>Estado actual de la alarma: <strong>{{ alarma ? "ACTIVADA" : "DESACTIVADA" }}</strong></p>

    <div>
      <button @click="toggleCamera">
        {{ viendoCamara ? "Detener Cámara" : "Ver Cámara" }}
      </button>

      <div v-if="viendoCamara" class="camera-container">
        <img :src="frameActual" alt="Stream de la cámara">
      </div>
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

export default {
  data() {
    return {
      bulbState: 'OFF',
      alarma: false,
      message: '',
      socket: null,
      alarmStatus: false,
      sessionTimeout: null,
      warningTimeout: null,
      showWarning: false,
      inactivityLimit: 5 * 60 * 1000, // 5 minutos de inactividad
      warningTime: 4 * 60 * 1000, // Mostrar aviso 1 min antes
      loading: false,
      viendoCamara: false,
      frameActual: "",
      logoutLoading: false, // Controla el overlay de cierre de sesión
      logoutStatus: 'loading', // Puede ser 'loading' o 'success'
      logoutMessage: 'Cerrando sesión...' // Mensaje debajo del spinner
    };
  },
  async mounted() {
    this.resetSessionTimer(); // Inicia el temporizador de sesión

    try {
      const response = await api.get('/devices/get-alarma');
      this.alarma = response.data.estado;
    } catch (error) {
      console.error("❌ Error al obtener el estado de la alarma:", error);
    }

    this.socket = io(window.location.origin, {
      path: "/socket.io",
      withCredentials: true
      //transports: ["websocket"]
    });

    this.socket.on("connect", () => {
      console.log("✅ Conectado a WebSocket");
    });

    this.socket.on("alarm-status", (data) => {
      console.log("Estado de alarma actualizado:", data);
      this.alarma = data.status;
    });

    this.socket.on("bulb-status", (data) => {
      this.bulbState = data.state;
    });

    this.socket.on("camera_frame", (base64Image) => {
      this.frameActual = `data:image/jpeg;base64,${base64Image}`;
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
  methods: {
    async toggleBulb() {
      this.loading = true;
      const newState = this.bulbState === 'ON' ? 'OFF' : 'ON';

      try {
        await api.post('/devices/toggle-bulb', { state: newState });
        this.socket.emit("toggle-bulb", { state: newState });
      } catch (error) {
        console.error("Error al cambiar estado de la bombilla", error);
      }
      this.loading = false;
    },

    async toggleAlarma() {
      const estadoPrevio = this.alarma;
      console.log("📤 Enviando evento toggle-alarm:", { status: this.alarma });

      this.socket.emit("toggle-alarm", { status: this.alarma });

      try {
        const response = await api.post('/devices/set-alarma', { estado: this.alarma });
        if (!response.data.success) {
          throw new Error(response.data.error || "Error desconocido");
        }
      } catch (error) {
        console.error("❌ Error al cambiar la alarma:", error);
        this.alarma = estadoPrevio;
      }
    },

    toggleCamera() {
      if (this.viendoCamara) {
        this.socket.emit("close-camera");
        this.frameActual = "";
      } else {
        this.socket.emit("request-camera");
      }
      this.viendoCamara = !this.viendoCamara;
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

/* Botón de cierre de sesión */
.logout {
  position: absolute;
  top: 20px;
  right: 20px;
}

.logout a {
  text-decoration: none;
  color: #007bff;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
}

.logout a:hover {
  color: #0056b3;
}

/* Botones generales */
button {
  padding: 10px 20px;
  font-size: 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

button:hover {
  background-color: #0056b3;
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

/* Contenedor del interruptor de encendido/apagado */
.toggle-container {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
}

.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #007bff;
}

input:checked + .slider:before {
  transform: translateX(26px);
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
  color: green;
}
</style>