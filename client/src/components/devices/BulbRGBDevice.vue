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
          <input type="checkbox" v-model="bulbState" @change="toggleBulb" :disabled="hasError || isLoading"/>
          <span class="slider"></span>
        </label>

        <button class="config-button" @click="openModal" :disabled="hasError || isLoading">⚙️</button>
      </div>

      <span class="toggle-state">{{ bulbState ? "ON" : "OFF" }}</span>
    </div>

    <!-- Icono parpadeante crono activo -->
    <i
      v-if="crono.active"
      class="pi pi-clock crono-icon"
    >
    </i>
    <span v-if="crono.active" class="crono-remaining">{{ formatTime(crono.remaining) }}</span>

    <!-- Modal de configuración -->
    <teleport to="#modals">
      <div v-if="showModal" class="overlay" @click.self="showModal = false">
        <div class="modal-container">
          <h3>Configuración de {{ deviceName }}</h3>

          <!-- Tabs -->
          <div class="tabstrip">
            <button :class="{ active: activeTab === 'config' }" @click="activeTab = 'config'">Luz</button>
            <button :class="{ active: activeTab === 'schedule' }" @click="activeTab = 'schedule'">Planificación</button>
          </div>

          <!-- Configuración lumínica -->
          <div v-if="activeTab === 'config'">
            <div class="control-group">
              <label>Brillo: {{ brightness }}%</label>
              <input type="range" min="1" max="100" v-model.number="brightness" @input="setBrightness" />
            </div>

            <div class="control-group">
              <label>Color:</label>
              <input type="color" v-model="color" @input="setColor" />
            </div>
          </div>

          <!-- Planificación horaria -->
          <div v-if="activeTab === 'schedule'">
            <SchedulePlanner
              ref="planner"
              :value="schedule"
              :deviceId="deviceId"
              @update="schedule = $event"
              @save="saveSchedule"
              :onActivateCrono="activateCrono"
              :onDeactivateCrono="deactivateCrono"
            />
          </div>

          <div class="modal-buttons">
            <button @click="showModal = false" class="modal-button">Cerrar</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script>
import api from '@/api/api';
import { io } from "socket.io-client";
import SchedulePlanner from '@/components/SchedulePlanner.vue';

export default {
  components: {
    SchedulePlanner
  },

  props: {
    deviceId: { type: String, required: true },
    deviceName: { type: String, default: "Bombilla RGB" }
  },

  data() {
    return {
      bulbState: false,
      socket: null,
      showModal: false,
      brightness: 50,
      color: "#ffffff",
      hsbColor: null,
      isLoading: true,
      hasError: false,
      activeTab: "config",
      schedule: { days: [], slots: [], enforceOutsideSlot: false },
      crono: {
        active: false,
        remaining: 0,
        timer: null
      }
    };
  },

  watch: {
    activeTab(newVal) {
      if (newVal === "schedule") {
        this.$nextTick(() => {
          this.$refs.planner?.fetchAndSetRemainingTime(this.deviceId);
        });
      }
    }
  },

  async mounted() {
    this.socket = io(window.location.origin, { path: "/socket.io", withCredentials: true });

    this.socket.on("bulb-status", (data) => {
      if (data.deviceId === this.deviceId) {
        console.log("💡 Estado de bombilla actualizado:", data);

        this.bulbState = data.state;
        this.hasError = false;

        if (data.hsbColor && typeof data.hsbColor.b === 'number') {
          this.hsbColor = { ...data.hsbColor };
          this.brightness = data.hsbColor.b;
          this.color = hsbToHex(data.hsbColor.h, data.hsbColor.s, data.hsbColor.b);
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

    await this.fetchInitialState();
    await this.fetchSchedule();
    await this.fetchCronoStatus();
  },

  beforeUnmount() {
    if (this.socket)
    {
      this.socket.off('crono:update');
      this.socket.off('bulb-status');
      this.socket.disconnect();
      this.socket = null;
    }

    this.clearCronoVisual();
    this.crono.active = false;
  },
  
  methods: {
    async fetchInitialState() {
      try {
        const response = await api.get(`/devices/${this.deviceId}/bulbRGB/status`);
        const { power, hsbColor } = response.data;

        this.bulbState = power === "ON" ? true : false;

        if (hsbColor) {
          this.hsbColor = { ...hsbColor };
          this.brightness = hsbColor.b;
          this.color = hsbToHex(hsbColor.h, hsbColor.s, hsbColor.b);
        }

        this.isLoading = false;
      } catch (error) {
        console.error("❌ Error al obtener el estado de la bombilla:", error);
        this.hasError = true;
        this.isLoading = false;
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

    async saveSchedule() {
      try {
        await api.post(`/schedule/${this.deviceId}`, this.schedule);
        alert("✅ Planificación guardada correctamente");
      } catch (err) {
          console.error("❌ Error al guardar planificación:", err);
          alert("❌ No se pudo guardar la planificación");
      }
    },

    async toggleBulb({ power = null, fromCrono = false, duration = null, isCustom = false }) { 
      const estadoPrevio = !this.bulbState;
      const newState = power || (this.bulbState ? "ON" : "OFF");

      //const hsb = hexToHsb(this.color);
      //hsb.b = this.brightness;

      //console.log("Configuración luminica", hsb);

      this.isLoading = true;

      try {
        const response = await api.post(`/devices/${this.deviceId}/bulbRGB/toggle`, { 
          power: newState,
          //hsbColor: hsb
          fromCrono,
          duration,
          isCustom
         });
        
        if (!response.data.success) {
          throw new Error(response.data.message || "Error desconocido");
        }

        return response.data;
      } catch (error) {
          console.error("❌ Error al cambiar estado de la bombilla", error);
          this.hasError = true;
          this.bulbState = estadoPrevio;
          return { success: false, message: error.message || "Error al cambiar estado de la bombilla" };
      } finally {
          this.isLoading = false;
      }
    },

    async updateBulbBrightColor() {
      console.log("🎯 Ejecutando updateBulbBrightColor", {
      brightness: this.brightness,
      color: this.color
      });

      const hsb = hexToHsb(this.color);
      hsb.b = this.brightness;
      
      console.log("🔧 Enviando al backend:", hsb);

      try {
        await api.post(`/devices/${this.deviceId}/bulbRGB/set-color `, { hsbColor: hsb });
      } catch (error) {
        console.error("❌ Error al actualizar color o brillo:", error);
      }
    },

    setBrightness() {
      this.updateBulbBrightColor();
    },

    setColor() {
      this.updateBulbBrightColor();
    },

    retryFetch() {
      this.hasError = false;
      this.isLoading = true;
      this.fetchInitialState();
    },

    addSlot() {
      this.schedule.slots.push({ start: "07:30", end: "08:30" });
    },

    removeSlot(index) {
      this.schedule.slots.splice(index, 1);
    },

    openModal() {
      this.showModal = true;
      if (this.activeTab === "schedule") {
        this.$nextTick(() => {
          this.$refs.planner?.fetchAndSetRemainingTime(this.deviceId);
        });
      }
    },

    async activateCrono({ duration, isCustom }) {
      if (this.bulbState) {
        // Ya está encendida → solo persistir crono
        try {
          const response = await api.post(`/crono/${this.deviceId}/crono`, { duration, isCustom });
          return response.data;
        } catch (err) {
          console.error("❌ Error al persistir crono:", err);
          return { success: false, message: "Error al persistir crono" };
        }
      } else {
        // Encender con flag de crono
        return await this.toggleBulb({
          power: "ON",
          fromCrono: true,
          duration,
          isCustom
        });
      }
    },

    async deactivateCrono() {
      this.isLoading = true;

      try {
        return await this.toggleBulb({
          power: "OFF",
          fromCrono: true
        });
      } catch (err) {
        console.error("❌ Error al desactivar crono:", err);
        return { success: false, message: "Error al desactivar crono" };
      } finally {
        this.isLoading = false;
      }
    },
  }
};

// Tasmota envia el estado de la bombilla RBG en formato hsb
// y Color picker (elemento UI) solo acepta hexadecimales como #RRGGBB
function hsbToHex(h, s, b) {
  s /= 100;
  b /= 100;

  const k = (n) => (n + h / 60) % 6;
  const f = (n) => b - b * s * Math.max(Math.min(k(n), 4 - k(n), 1), 0);

  const r = Math.round(f(5) * 255);
  const g = Math.round(f(3) * 255);
  const b_ = Math.round(f(1) * 255);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b_).toString(16).slice(1)}`;
}

// Funcion auxiliar para convertir parametros hexadecimal a formato hsb
function hexToHsb(hex) {
  hex = hex.replace(/^#/, '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;

  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max === min) {
    h = 0; // achromatic
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    b: Math.round(v * 100)
  };
}
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
  margin-top: 0;
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

.tabstrip {
  display: flex;
  justify-content: center;
  border-radius: 6px 6px 0 0;
  background-color: #e9ecef;
  overflow: hidden;
}

.tabstrip button {
  flex: 1;
  padding: 10px 0;
  background: transparent;
  border: none;
  color: #333;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

.tabstrip button:hover {
  background-color: #d0d7de;
}

.tabstrip button.active {
  background-color: #ffffff;
  color: #007bff;
  font-weight: 600;
  border-bottom: 2px solid #007bff;
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