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

    <span class="toggle-label">Luz Salon1:</span>

    <div class="toggle-group-vertical">
      <div class="toggle-row">
        <label class="toggle-switch">
          <input type="checkbox" v-model="bulbState" @change="toggleBulb" />
          <span class="slider"></span>
        </label>

        <button class="config-button" @click="showModal = true">⚙️</button>
      </div>

      <span class="toggle-state">{{ bulbState ? "ON" : "OFF" }}</span>
    </div>

    <!-- Modal de configuración -->
    <teleport to="#modals">
      <div v-if="showModal" class="overlay" @click.self="showModal = false">
        <div class="modal-container">
          <h3>Configuración de luz</h3>

          <div class="control-group">
            <label>Brillo: {{ brightness }}%</label>
            <input type="range" min="1" max="100" v-model.number="brightness" @input="setBrightness" />
          </div>

          <div class="control-group">
            <label>Color:</label>
            <input type="color" v-model="color" @input="setColor" />
          </div>

          <button @click="showModal = false">Cerrar</button>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script>
import api from '../api/api';
import { io } from "socket.io-client";

export default {
  data() {
    return {
      bulbState: false,
      socket: null,
      showModal: false,
      brightness: 50,
      color: "#ffffff",
      hsbColor: null,
    };
  },
  async mounted() {
    this.socket = io(window.location.origin, { path: "/socket.io", withCredentials: true });

    this.socket.on("bulb-status", (data) => {
      console.log("💡 Estado de bombilla actualizado:", data);
      this.bulbState = data.state;
    });

    try {
      const response = await api.get('/devices/get-bulb');

      console.log("Respuesta GET del Bulb:", response.data);

      const { estado, hsbColor } = response.data;
      this.bulbState = estado;

      if (hsbColor) {
      this.hsbColor = { ...hsbColor };
      this.brightness = hsbColor.b;
      this.color = hsbToHex(hsbColor.h, hsbColor.s, hsbColor.b);
    }

    } catch (error) {
      console.error("❌ Error al obtener el estado de la bombilla:", error);
    }
  },
  methods: {
    async toggleBulb() {
      const estadoPrevio = !this.bulbState;
      const newState = this.bulbState ? "ON" : "OFF";

      const hsb = hexToHsb(this.color);
      hsb.b = this.brightness;

      console.log("Configuración luminica", hsb);

      try {
        const response = await api.post('/devices/toggle-bulb', { 
          estado: newState,
          hsbColor: hsb
         });
        if (!response.data.success) {
          throw new Error(response.data.message || "Error desconocido");
        }
      } catch (error) {
        console.error("❌ Error al cambiar estado de la bombilla", error);
        this.bulbState = estadoPrevio;
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
        await api.post('/devices/set-bulb-bright-color', { hsbColor: hsb });
      } catch (error) {
        console.error("❌ Error al actualizar color o brillo:", error);
      }
    },

    setBrightness() {
      this.updateBulbBrightColor();
    },

    setColor() {
      this.updateBulbBrightColor();
    }
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

.modal-container button {
  display: block;
  margin: 20px auto 0 auto;
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
  margin-bottom: 15px;
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