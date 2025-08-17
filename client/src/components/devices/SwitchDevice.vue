<template>
  <div class="toggle-container">
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
          <input type="checkbox" v-model="switchState" @change="toggleSwitch" :disabled="hasError || isLoading"/>
          <span class="slider"></span>
        </label>

        <button class="config-button" @click="openModal" :disabled="hasError || isLoading">⚙️</button>
      </div>

      <span class="toggle-state">{{ switchState ? "ON" : "OFF" }}</span>
    </div>

    <!-- Icono parpadeante crono activo -->
    <i
      v-if="crono.active"
      class="pi pi-clock crono-icon"
    >
    </i>
    <span v-if="crono.active" class="crono-remaining">{{ formatTime(crono.remaining) }}</span>

    <!-- Modal de Planificacion -->
    <teleport to="#modals">
      <div v-if="showModal" class="overlay" @click.self="showModal = false">
        <div class="modal-container">
          <h3>Planificación de {{ deviceName }}</h3>

          <SchedulePlanner
            ref="planner"
            :value="schedule"
            :deviceId="deviceId"
            @update="schedule = $event"
            @save="saveSchedule"
            :onActivateCrono="activateCrono"
            :onDeactivateCrono="deactivateCrono"
          />

          <div class="modal-buttons">
            <button @click="showModal = false" class="modal-button">Cerrar</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script>
import api from "@/api/api";
import { io } from "socket.io-client";
import SchedulePlanner from '@/components/SchedulePlanner.vue';

export default {
  components: {
    SchedulePlanner
  },

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
      showModal: false,
      schedule: { days: [], slots: [], enforceOutsideSlot: false },
      crono: {
        active: false,
        remaining: 0,
        timer: null
      }
    };
  },
  
  async mounted() {
    this.setupSocket();
    this.fetchInitialStateWithTimeout();
    await this.fetchSchedule();
    await this.fetchCronoStatus();
  },

  beforeUnmount() {
    if (this.socket)
    {
      this.socket.off('crono:update');
      this.socket.off('switch-status');
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.timeoutId) clearTimeout(this.timeoutId);

    this.clearCronoVisual();
    this.crono.active = false;
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

          //Maneja el estado ON/OFF solo si viene explícito
          if (typeof data.state === "boolean") {
            this.switchState = data.state;
          }

          if (typeof data.isOnline === "boolean") {
            this.isOnline = data.isOnline;
            this.hasError = !data.isOnline;

            //Si vuelve online, también desactiva el spinner
            if (data.isOnline) {
              this.hasError = false;
            }
          }
        }
      });

      this.socket.on("crono:update", (data) => {
        if (data.deviceId !== this.deviceId) return;

        if (!data.active) {
          this.crono.active = false;
          this.clearCronoVisual();
          return;
        }

        this.crono.active = true;
        this.setRemainingTime(data.remaining);
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

    async fetchCronoStatus() {
      try {
        const { data } = await api.get(`/crono/${this.deviceId}/crono`);

        if (!data.active) {
          this.crono.active = false;
          this.clearCronoVisual();
          return;
        }

        this.crono.active = true;
        this.setRemainingTime(data.remaining);
      } catch (err) {
        console.error("❌ Error al consultar estado inicial de crono:", err);
        this.crono.active = false;
        this.clearCronoVisual();
      }
    },

    setRemainingTime(seconds) {
      // Evitar timers duplicados
      if (this.crono.timer) {
        clearInterval(this.crono.timer);
        this.crono.timer = null;
      }

      this.crono.remaining = seconds;

      // Inicia temporizador visual
      this.crono.timer = setInterval(async () => {
        if (this.crono.remaining > 0) {
          this.crono.remaining--;
        } else {
          // Llegó a 0
          try {
            const { data } = await api.get(`/crono/${this.deviceId}/crono`);

            if (!data.active) {
              this.clearCronoVisual();
              this.crono.active = false;
              return;
            }
            // Sigue activo, reprogramar
            this.setRemainingTime(data.remaining);

          } catch (err) {
            console.error("❌ Error verificando estado de crono:", err);
            this.clearCronoVisual();
            this.crono.active = false;
          }
        }
      }, 1000);
    },

    clearCronoVisual() {
      if (this.crono.timer) {
        clearInterval(this.crono.timer);
        this.crono.timer = null;
      }
      this.crono.remaining = 0;
    },

    formatTime(seconds) {
      const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
      const secs = String(seconds % 60).padStart(2, "0");
      return `${mins}:${secs}`;
    },

    async fetchInitialStateWithTimeout() {
      // Activamos el timeout manualmente para fallback
      this.timeoutId = setTimeout(() => {
        if (!this.isOnline) {
          console.warn("⏱ Timeout: no se detectó al dispositivo");
          this.hasError = true;
          this.isLoading = false;
        }
      }, 3000);

      try {
        const response = await api.get(`/devices/${this.deviceId}/switch/status`);

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
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
    },

    async fetchSchedule() {
      try {
        const { data } = await api.get(`/schedule/${this.deviceId}`);
        if (data.success) {
          this.schedule = data.schedule;
        }
      } catch (error) {
          console.error("❌ Error al obtener planificación:", error);
      }
    },

    async saveSchedule() {
      try {
        await api.post(`/schedule/${this.deviceId}`, this.schedule);
        alert("✅ Planificación guardada correctamente");
      } catch (err) {
          console.error("❌ Error al guardar planificación:", err);
          alert("❌ No se pudo guardar la planificación");
      }
    },

    async toggleSwitch({ target, fromCrono = false, duration = null, isCustom = false }) {
      const newState = target.checked;
      const previousState = !newState;

      if (!fromCrono) {
        this.switchState = newState; // Cambio inmediato si es manual y no por crono
      }

      this.isLoading = true;

      try {
        const response = await api.post(`/devices/${this.deviceId}/switch/toggle`, {
          estado: newState ? "ON" : "OFF",
          fromCrono, //parametros del Crono
          duration, //Parametros del Crono
          isCustom: isCustom
        });

        if (!response.data.success) {
          throw new Error(response.data.message || "Error en cambio de estado");
        }

        //Si es por crono, nos aseguramos que la operación fue bien previamente
        if (fromCrono) {
          this.switchState = newState;
        }

        return response.data; 
      } catch (error) {
        console.error("❌ Error al cambiar estado:", error);
        this.switchState = previousState;
        return { success: false, message: error.message || "Error en toggleSwitch" };
      } finally {
        this.isLoading = false;
      }
    },

    async openModal() {
      this.showModal = true;

      // Esperamos al siguiente tick para que el componente se monte y se pueda acceder al ref
      /*this.$nextTick(async () => {
        await this.fetchCronoStatus(); // si hay crono activo, se enviará al modal
      });
      */
      this.$nextTick(() => {
        this.$refs.planner?.fetchAndSetRemainingTime(this.deviceId);
      });
    },

    /*
    async fetchCronoStatus() {
      try {
        const { data } = await api.get(`/devices/${this.deviceId}/crono`);

        if (data.active) {
          console.log("Crono data: ", data);
          // Pasar tiempo restante a SchedulePlanner
          this.$refs.planner?.setRemainingTime(data.remaining, data.isCustom);
        }
      } catch (err) {
        console.error("❌ Error consultando crono:", err);
      }
    },
    */

    async activateCrono({ duration, isCustom }) {
      if (this.switchState) {
        //Dispositivo ya encendido. Solo es necesario persistir en BBDD el crono
        try {
          const response = await api.post(`/crono/${this.deviceId}/crono`, { duration, isCustom });

          return response.data;
        } catch (err) {
          console.error("❌ Error al persistir crono:", err);
          return { success: false, message: "Error al persistir crono" };
        }
      } else {
        //Encender. Simular toggle pero con flag para control de flujo
        return await this.toggleSwitch({
          target: { checked: true },
          fromCrono: true,
          duration,
          isCustom  
        });
      }
    },

    async deactivateCrono() {
      this.isLoading = true;
      try {
        return await this.toggleSwitch({
          target: { checked: false },
          fromCrono: true
        });
      } catch (err) {
        console.error("❌ Error al desactivar crono:", err);
        return { success: false, message: "Error al desactivar crono" };
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
  position: relative;
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

.config-button {
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
}

/* Modal */
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

.modal-container {
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  text-align: center;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-container h3 {
  margin: 0;
}

.modal-container button {
  display: block;
  width: 100%;
  max-width: 200px;
  padding: 10px 15px;
  font-size: 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  text-align: center;
}

.modal-container button:hover {
  background-color: #0056b3;
}

.control-group {
  margin-top: 15px;
  margin-bottom: 15px;
}

.modal-buttons {
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
}

.modal-button {
  width: 100%;
  max-width: 200px;
  padding: 10px 15px;
  font-size: 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  text-align: center;
}

.modal-button:hover {
  background-color: #0056b3;
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

/* Icono crono en esquina inferior derecha */
.crono-icon {
  position: absolute;
  bottom: 3px;
  right: 0px;
  font-size: 1.3rem;
  font-weight: bold;
  color: orange;
  animation: blink 3s infinite;
}

@keyframes blink {
  0%, 50%, 100% { opacity: 1; }
  25%, 75% { opacity: 0; }
}

.crono-remaining {
  position: absolute;
  bottom: -13px;
  right: 0px;
  font-size: 0.8rem;
  font-weight: bold;
  color: orange;
  animation: blink 3s infinite;
}
</style>
