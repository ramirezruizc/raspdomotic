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

    <span class="toggle-label">A/C Salón:</span>

    <div class="toggle-group-vertical">
      <div class="toggle-row">
        <label class="toggle-switch">
          <input type="checkbox" :checked="acPower" @change="handleACCheckboxChange" :disabled="isLoading" />
          <span class="slider"></span>
        </label>

        <button class="config-button" @click="showModal = true" :disabled="isLoading">⚙️</button>
      </div>

      <!-- Visualización de temperaturas -->
      <div class="temperature-display">
        <span class="mode-icon">
          {{ mode === 'heat' ? '☀️' : mode === 'cooling' ? '❄️' : '' }}
        </span>
        <span
          class="temp-room"
          :class="{
            'temp-cooling-room': mode === 'cooling',
            'temp-heat-room': mode === 'heat'
          }"
          v-if="roomTemperature !== undefined"
        >
          {{ roomTemperature }}°C
        </span>
        <span class="temp-arrow">→</span>
        <span
          class="temp-target"
          :class="{
            'temp-cooling-target': mode === 'cooling',
            'temp-heat-target': mode === 'heat'
          }"
        >
          {{ temperature.toFixed(1) }}°C
        </span>
      </div>
      
      <!-- estado ON/OFF -->
      <span class="toggle-state">{{ acPower ? "ON" : "OFF" }}</span>
    </div>

    <!-- Modal de configuración -->
    <teleport to="#modals">
      <div v-if="showModal" class="overlay" @click.self="showModal = false">
        <div class="modal-container">
          <h3>Configuración de A/C</h3>

          <div class="control-group">
            <label>Temperatura: {{ temperature }}°C</label>
            <input type="range" min="16" max="30" step="0.5" v-model.number="temperature" @input="setTemperature" />
          </div>

          <div class="control-group">
            <label>Modo:</label>
            <select v-model="mode">
              <option value="heat">Calor</option>
              <option value="cooling">Frío</option>
            </select>
          </div>

          <div class="control-group">
            <label>Velocidad del ventilador:</label>
            <select v-model="fanSpeed">
              <option value="1">Baja</option>
              <option value="2">Media</option>
              <option value="3">Alta</option>
            </select>
          </div>

          <button class="btn-apply" @click="applySettings">Aplicar</button>
          <button @click="showModal = false">Cerrar</button>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script>
import api from '@/api/api';

export default {
  data() {
    return {
      isLoading: true,
      hasError: false,
      acPower: false,
      showModal: false,
      temperature: 24,
      mode: "heat",
      fanSpeed: 1,
      roomTemperature: null
    };
  },
  async mounted() {
    this.fetchACState();
  },
  methods: {
    handleACCheckboxChange(event) {
      const newState = event.target.checked;
      const previousState = this.acPower;

      // Aplicamos visualmente el cambio
      this.acPower = newState;
      this.isLoading = true;

      this.sendFullACState()
        .catch((error) => {
          console.error("❌ Error al cambiar estado del A/C:", error);
          // Revertimos el estado si falla
          this.acPower = previousState;
        })
        .finally(() => {
          this.isLoading = false;
        });
    },

    async applySettings() {
      // Guardar estados anteriores
      const prevPower = this.acPower;
      const prevTemperature = this.temperature;
      const prevMode = this.mode;
      const prevFanSpeed = this.fanSpeed;

      //Asegurar encendido al aplicar cambios 
      if (!this.acPower) {
        this.acPower = true;
      }

      this.showModal = false;
      this.isLoading = true;

      try{
        await this.sendFullACState();
      } catch (error) {
        console.error("❌ Error al aplicar configuración del A/C:", error);
        
        // Revertir al estado anterior
        this.acPower = prevPower;
        this.temperature = prevTemperature;
        this.mode = prevMode;
        this.fanSpeed = prevFanSpeed;
      } finally {
        this.isLoading = false;
      }
    },

    async fetchACState()
    {
      try {
        const { data } = await api.get('/devices/get-ac');

        console.log("Respuesta GET de A/C:", data);

        if (data.success) {
          const modeMap = {
            1: "heat",
            3: "cooling"
          };

          this.acPower = data.power === true;
          this.temperature = data.temperature;
          this.mode = modeMap[data.mode];
          this.fanSpeed = data.fanspeed;
          this.roomTemperature = data.roomTemperature;
          this.hasError = false;
        }
        else
        {
          throw new Error("No pudo completarse la operación en A/C");
        }
      } catch (error) {
        console.error("❌ Error al obtener estado del A/C:", error);
        this.hasError = true;
      } finally {
        this.isLoading = false; 
      }
    },

    async sendFullACState() {
      try {
        const { data } = await api.post('/devices/set-ac', {
          power: this.acPower ? "on" : "off",
          temperature: this.temperature,
          mode: this.mode,
          fanspeed: this.fanSpeed
        });

        console.log("Respuesta POST de A/C:", data);

        if (!data.success) {
          throw new Error("No pudo completarse la operación en A/C");
        }
      } catch (error) {
        console.error("❌ Error al enviar configuración completa del A/C:", error);
        throw error;
      }
    },

    async retryFetch() {
      this.isLoading = true;
      this.hasError = false;
      await this.fetchACState();
    }
  }
};
</script>

<style scoped>
.toggle-container {
  min-width: auto;
  max-width: 100%;
  flex-grow: 1;
  position: relative;
}

.toggle-group-vertical {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
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
  flex-shrink: 0;
}

.toggle-switch {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 50px;
  height: 24px;
  min-width: 40px;
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
}

.modal-container button:hover {
  background-color: #0056b3;
}

.control-group {
  margin-bottom: 15px;
}

.modal-container .btn-apply {
  background-color: #28a745 !important;
}

.modal-container .btn-apply:hover {
  background-color: #218838 !important;
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

.temperature-display {
  font-size: 0.75rem;
  display: flex;
  gap: 6px;
  align-items: baseline;
  justify-content: center;
}

.temp-arrow {
  color: inherit;
  font-weight: bold;
}

.temp-cooling-room {
  color: #e67e22; /* Naranja */
  font-weight: 600;
}
.temp-cooling-target {
  color: #3498db; /* Azul */
  font-weight: 600;
}

.temp-heat-room {
  color: #3498db; /* Azul */
  font-weight: 600;
}
.temp-heat-target {
  color: #e67e22; /* Naranja */
  font-weight: 600;
}
</style>
