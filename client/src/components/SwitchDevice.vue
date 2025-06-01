<template>
  <div class="toggle-container" style="position: relative;">
    <!-- Spinner overlay -->
    <div v-if="isLoading" class="blocker-overlay">
      <div class="spinner"></div>
    </div>

    <!-- Overlay para error -->
    <div v-if="hasError" class="blocker-overlay">
      <button class="retry-button" @click="retryFetch" :disabled="isLoading">
        <i class="pi pi-refresh" :class="{ 'pi-spin': isLoading }"></i>
      </button>
    </div>

    <span class="toggle-label">{{ deviceName }}:</span>

    <div class="toggle-group-vertical">
      <div class="toggle-row">
        <label class="toggle-switch">
          <input type="checkbox" v-model="switchState" @change="toggleSwitch" />
          <span class="slider"></span>
        </label>
      </div>

      <span class="toggle-state">{{ switchState ? "ON" : "OFF" }}</span>
    </div>
  </div>
</template>

<script>
import api from "../api/api";
import { io } from "socket.io-client";

export default {
  props: {
    deviceId: {
      type: String,
      required: true,
    },
    deviceName: {
      type: String,
      default: "Switch",
    }
  },
  data() {
    return {
      socket: null,
      switchState: false,
      isOnline: false,
      isLoading: true,
      hasError: false,
      timeoutId: null,
    };
  },
  mounted() {
    this.setupSocket();
    this.fetchInitialStateWithTimeout();
  },
  beforeUnmount() {
    if (this.socket) this.socket.disconnect();
    if (this.timeoutId) clearTimeout(this.timeoutId);
  },
  methods: {
    setupSocket() {
      this.socket = io(window.location.origin, {
        path: "/socket.io",
        withCredentials: true,
      });

      this.socket.on("switch-status", (data) => {
        if (data.deviceId === this.deviceId) {
          console.log("🔄 Estado del switch vía WS:", data);

          // ⚠️ Maneja el estado ON/OFF solo si viene explícito
          if (typeof data.state === "boolean") {
            this.switchState = data.state;
          }

          if (typeof data.isOnline === "boolean") {
            this.isOnline = data.isOnline;
            this.hasError = !data.isOnline;

            // 🔄 Si vuelve online, también desactiva el spinner
            if (data.isOnline) {
              this.hasError = false;
            }
          }
        }
      });

      /*
      this.socket.on("switch-status", (data) => {
        if (data.deviceId === this.deviceId) {
          console.log("🔄 Estado del switch vía WS:", data);
          this.switchState = data.state;
          this.isOnline = data.isOnline;
        }
      });
      */
    },

    async fetchInitialStateWithTimeout() {
      // Activamos el timeout manualmente para fallback
      this.timeoutId = setTimeout(() => {
        if (!this.isOnline) {
          console.warn("⏱ Timeout: no se detectó al dispositivo");
          this.hasError = true;
          this.isLoading = false;
        }
      }, 10000);

      try {
        const response = await api.get(`/devices/${this.deviceId}/switch`);

        const { relayStatus, isOnline } = response.data;

        console.log(`Respuesta GET de Switch (MQTT): Online (${isOnline}), Switch (${relayStatus})`);

        if (relayStatus !== undefined && typeof isOnline === "boolean") {
          this.switchState = relayStatus;
          this.isOnline = isOnline;
          this.hasError = !isOnline; // Si no está online, mostramos overlay
          this.isLoading = false;

          if (isOnline) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
          }
        } else {
          throw new Error("Respuesta incompleta del servidor");
        }
      } catch (error) {
        console.error("❌ Error en fetch inicial del switch:", error);
        this.hasError = true;
        this.isLoading = false;
        clearTimeout(this.timeoutId); // Cancelamos timeout si falla de inmediato
        this.timeoutId = null;
      }
    },

    async toggleSwitch(event) {
      const newState = event.target.checked;
      const previousState = !newState;

      this.switchState = newState;
      this.isLoading = true;

      try {
        const response = await api.post(`/devices/${this.deviceId}/switch/toggle`, {
          estado: newState ? "ON" : "OFF",
        });

        if (!response.data.success) {
          throw new Error(response.data.message || "Error en cambio de estado");
        }
      } catch (error) {
        console.error("❌ Error al cambiar estado:", error);
        this.switchState = previousState;
      } finally {
        this.isLoading = false;
      }
    },

    retryFetch() {
      this.hasError = false;
      this.isLoading = true;
      this.fetchInitialStateWithTimeout();
    },
  },
};
</script>

<style scoped>
.toggle-container {
  min-width: auto; /* Evita forzar un ancho mínimo */
  max-width: 100%; /* Se adapta sin desbordarse */
  flex-grow: 1; 
}

.toggle-group-vertical {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-state {
  margin-top: 4px;
  font-weight: bold;
}

.toggle-label {
  flex-shrink: 0; /* Evita que se achique el texto */
}

/* Estilos del switch */
.toggle-switch {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 50px;
  height: 24px;
  min-width: 40px; /* Evita que el switch sea demasiado pequeño */
}

.toggle-switch input {
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

/* Spinner overlay */
.blocker-overlay {
  position: absolute;
  top: 0;
  left: 0;
  background: rgba(255, 255, 255, 0.85);
  width: 100%;
  height: 100%;
  z-index: 999;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 12px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(0, 0, 0, 0.2);
  border-top: 3px solid #007bff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.retry-button {
  background: none;
  border: none;
  font-size: 2rem;
  color: #007bff;
  cursor: pointer;
}

.retry-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
