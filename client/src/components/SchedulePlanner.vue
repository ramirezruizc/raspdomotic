<template>
  <div class="schedule-planner">

    <div class="crono-blocker-wrapper">
      <div v-if="cronoLoading" class="blocker-overlay">
        <div class="spinner"></div>
      </div>

      <!-- Botones del Crono -->
      <div class="control-group crono-buttons">
        <button
          v-for="duration in [15, 30, 45]"
          :key="duration"
          :class="['crono-btn', { active: isActive(duration, false) }]"
          @click="startCrono(duration, false)"
          :disabled="cronoLoading"
        >
          <div class="crono-label">
            <span>{{ isActive(duration, false) ? 'Stop' : 'Start' }}</span>
            <small>
              {{ isActive(duration, false) ? formatTime(crono.remaining) : `${duration} min` }}
            </small>
          </div>
        </button>

        <!-- Botón Custom Crono -->
        <div
          class="custom-crono-wrapper"
          v-click-outside="() => dropdownVisible = false"
        >
          <button
            :class="['crono-btn', { active: isActive(customMinutes, true) }]"
            @click="handleCustomClick"
            :disabled="cronoLoading"
          >
            <div class="crono-label">
              <span>{{ isActive(customMinutes, true) ? 'Stop' : 'Start' }}</span>
              <small>
                {{
                  isActive(customMinutes, true)
                    ? formatTime(crono.remaining)
                    : hasSelectedCustom
                      ? customMinutes + ' min'
                      : 'Custom'
                }}
              </small>
            </div>
          </button>

          <small
            class="hint"
            v-if="!hasSelectedCustom && !isActive(customMinutes, true)"
          >
            ¿Minutos?
          </small>

          <!-- Dropdown flotante -->
          <ul
            v-if="dropdownVisible"
            class="custom-dropdown"
          >
            <li
              v-for="m in 60"
              :key="m"
              @click="selectCustom(m)"
              :class="{ selected: m === customMinutes }"
            >
              {{ m }} min
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="control-group">
      <label>Días activos:</label>
      <div class="days-selector">
        <label v-for="(day, index) in daysOfWeek" :key="index">
          <input type="checkbox" v-model="localSchedule.days" :value="day" /> {{ day }}
        </label>
      </div>
    </div>

    <div class="control-group">
      <label>
        <input type="checkbox" v-model="localSchedule.enforceOutsideSlot" />
        Forzar apagado fuera de franja horaria
      </label>
    </div>

    <div class="control-group">
      <label>Franjas horarias:</label>
      <div v-for="(slot, index) in localSchedule.slots" :key="index" class="time-range">
        <input type="time" v-model="slot.start" step="1800" />
        <span>-</span>
        <input type="time" v-model="slot.end" step="1800" />
        <button class="delete-btn" @click="removeSlot(index)">
          <i class="pi pi-trash"></i>
        </button>
      </div>
      <button @click="addSlot">+ franja</button>
    </div>

    <button class="modal-button btn-success" @click="emitSchedule">Guardar planificación</button>
  </div>
</template>

<script>
import api from "@/api/api";
import { io } from "socket.io-client";

export default {
  name: "SchedulePlanner",

  directives: {
    clickOutside: {
      mounted(el, binding) {
        el.__clickOutsideHandler__ = (event) => {
          if (!el.contains(event.target)) {
            binding.value(event);
          }
        };
        document.addEventListener("click", el.__clickOutsideHandler__);
      },
      unmounted(el) {
        document.removeEventListener("click", el.__clickOutsideHandler__);
      }
    }
  },

  props: {
    value: { type: Object, required: true },
    onActivateCrono: { type: Function, required: true },
    onDeactivateCrono: { type: Function, required: true },
    deviceId: { type: String, required: true }
  },

  data() {
    return {
      cronoLoading: false,
      daysOfWeek: ["L", "M", "X", "J", "V", "S", "D"],
      localSchedule: JSON.parse(JSON.stringify(this.value)),
      customMinutes: 5,
      dropdownVisible: false,
      hasSelectedCustom: false, 
      crono: {
        activeDuration: null,
        remaining: 0,
        timer: null,
        isCustom: false
      },
      socket: null,
    };
  },

  mounted() {
    // Evento WebSocket
    this.socket = io(window.location.origin, { path: "/socket.io", withCredentials: true });

    this.socket.on('crono:update', async (data) => {
      if (data.deviceId !== this.deviceId) return;

      console.log('🔄 Evento crono recibido:', data);

      //await this.withSpinner(async () => {
        if (!data.active) {
          //Fin de crono
          this.clearCronoVisual();
          //this.cronoLoading = false;
          return;
        }

        const originalMinutes = Math.ceil(data.duration / 60);
        const sameCrono = this.crono.activeDuration === originalMinutes && this.crono.isCustom === data.isCustom;

        if (sameCrono) {
          //Ya hay un timer para este crono, solo sincroniza tiempo restante
          //no se establece setTimer para evitar timers duplicados
          this.crono.remaining = data.remaining;
          //this.cronoLoading = false;
          return;
        }

        //Es un crono nuevo o cambió (p.ej. otro botón): reprograma el timer
        await this.setRemainingTime(data.remaining, data.isCustom, originalMinutes);
      });
    //});
  },

  beforeUnmount() {
    // Limpiamos la suscripción al cerrar el modal o cambiar de vista
    if (this.socket) {
      this.socket.off('crono:update');
      this.socket.disconnect();
      this.socket = null;
    }

    this.clearCronoVisual();
  },

  methods: {
    async withSpinner(task) {
      this.cronoLoading = true;
      // Deja que Vue pinte el overlay
      await this.$nextTick();
      await new Promise(r => requestAnimationFrame(r));
      // (opcional) añade un microdelay si tu lógica es muy rápida:
      //await new Promise(r => setTimeout(r, 0));
      try {
        await task();
      } finally {
        this.cronoLoading = false;
      }
    },

    addSlot() {
      //this.localSchedule.slots.push({ start: "07:00", end: "07:30" });

      const now = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      const startHour = pad(now.getHours());
      const startMinute = pad(now.getMinutes());

      //Calcular hora fin sumando 1 hora
      now.setHours(now.getHours() + 1);
      const endHour = pad(now.getHours());
      const endMinute = pad(now.getMinutes());

      this.localSchedule.slots.push({
        start: `${startHour}:${startMinute}`,
        end: `${endHour}:${endMinute}`
      });
    },

    removeSlot(index) {
      this.localSchedule.slots.splice(index, 1);
    },

    emitSchedule() {
      this.$emit("update", this.localSchedule);
      this.$emit("save");
    },

    async fetchAndSetRemainingTime(deviceId) {
      this.cronoLoading = true;

      try {
        const { data } = await api.get(`/crono/${deviceId}/crono`);

        console.log("Lectura al entrar en crono", data);

        if (data.active) {
          const originalMinutes = Math.ceil(data.duration / 60);
          this.setRemainingTime(data.remaining, data.isCustom, originalMinutes);
        } else {
          this.cronoLoading = false;
        }
      } catch (err) {
        console.error("❌ Error al consultar crono activo:", err);
        this.cronoLoading = false;
      }
    },

    setRemainingTime(seconds, isCustom, originalMinutes = null) {
      //Evitar timings duplicados
      if (this.crono.timer) {
        clearInterval(this.crono.timer);
        this.crono.timer = null;
      }

      this.crono.remaining = seconds;
      //this.crono.activeDuration = Math.ceil(seconds / 60);
      this.crono.isCustom = isCustom;

      if (originalMinutes !== null) {
        this.crono.activeDuration = originalMinutes;
      }

      /*
      if (this.crono.isCustom) {
        this.customMinutes = this.crono.activeDuration;
        this.hasSelectedCustom = true;
      }*/

      if (isCustom) {
        this.customMinutes = this.crono.activeDuration;
        this.hasSelectedCustom = true;
      } else {
        this.hasSelectedCustom = false;
      }

      // Inicia temporizador visual
      //clearInterval(this.crono.timer);

      this.crono.timer = setInterval(async () => {
        if (this.crono.remaining > 0) {
          this.crono.remaining--;
        } else {
          this.cronoLoading = true;

          clearInterval(this.crono.timer);
          this.crono.timer = null;

          //this.crono.activeDuration = null;
          //this.crono.isCustom = false;
          //this.hasSelectedCustom = false;

          //Solo limpieza visual
          //No emitir crono-deactivated
          //this.cancelCrono();
          
          try {
            const { data } = await api.get(`/crono/${this.deviceId}/crono`);

            console.log("Lectura al timeout en crono",data);

            //Si no sigue activo limpiar y salir
            if (!data.active) {
              this.clearCronoVisual();
              return;
            }
            
            //Si sigue activo entonces reprogramar solo una vez
            this.setRemainingTime(data.remaining, data.isCustom, Math.ceil(data.duration / 60));
          } catch (err) {
            console.error("❌ Error verificando estado de crono:", err);
            this.clearCronoVisual();
          } finally {
            this.cronoLoading = false;
          }
        }
      }, 1000);

      this.cronoLoading = false;
    },

    async startCrono(minutes, fromCustom = false) {
      // Pulsamos sobre mismo boton de crono activo, eliminamos crono, apagamos dispositivo
      if (this.crono.activeDuration === minutes && this.crono.isCustom === fromCustom) {
        await this.cancelCrono();
        return;
      }

      // Ya existe un crono activo, confirmar reemplazo
      if (this.crono.activeDuration !== null) {
        if (!confirm("Hay un crono activo. ¿Deseas reemplazarlo?")) return;
        //this.cancelCrono();
        this.clearCronoVisual();
      }

      this.cronoLoading = true;

      // Solicitud al padre que active crono y esperamos respuesta
      const response = await this.onActivateCrono({
        duration: minutes,
        isCustom: fromCustom
      });

      if (!response?.success) {
        alert("❌ No se pudo activar el cronómetro. Inténtalo de nuevo.");
        this.cronoLoading = false;
        return;
      }

      //Noo iniciar timer aqui, ya que se solaparia la activacion
      //manual con la activación por WebSocket
      /*
      this.crono.activeDuration = minutes;
      this.crono.remaining = minutes * 60;
      this.crono.isCustom = fromCustom;

      this.crono.timer = setInterval(() => {
        if (this.crono.remaining > 0) {
          this.crono.remaining--;
        } else {
          this.cancelCrono();
        }
      }, 1000);
      */

      this.cronoLoading = false;
    },

    clearCronoVisual() {
      clearInterval(this.crono.timer);
      this.crono.activeDuration = null;
      this.crono.remaining = 0;
      this.crono.timer = null;
      this.hasSelectedCustom = false;
      this.crono.isCustom = false;
    },

    async cancelCrono() {
      this.cronoLoading = true;

      // Pedimos al padre que lo cancele
      const response = await this.onDeactivateCrono();

      /*
      if (!response?.success) { 
        alert("❌ No se pudo cancelar el cronómetro.");
        this.cronoLoading = false;
        return;
      }
      */

      if (!response?.success) {
        alert(response?.message || "❌ No se pudo cancelar el cronómetro.");
      }

      this.clearCronoVisual();

      this.cronoLoading = false;
    },

    handleCustomClick() {
      if (this.isActive(this.customMinutes, true)) {
        this.cancelCrono();
      } else {
        this.dropdownVisible = !this.dropdownVisible;
      }
    },

    selectCustom(m) {
      this.customMinutes = m;
      this.hasSelectedCustom = true;
      this.dropdownVisible = false;
      this.startCrono(m, true);
    },

    formatTime(seconds) {
      const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
      const secs = String(seconds % 60).padStart(2, "0");
      return `${mins}:${secs}`;
    },

    isActive(duration, custom = false) {
      return this.crono.activeDuration === duration && this.crono.isCustom === custom;
    }
  }
};
</script>

<style scoped>
.schedule-planner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: left;
  padding: 10px;
}

.crono-blocker-wrapper {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.crono-blocker-wrapper .blocker-overlay {
  position: absolute;
  top: 0;
  left: 0;
  background: rgba(255, 255, 255, 0.85);
  width: 100%;
  height: 100%;
  z-index: 10;
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

.crono-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 10px !important;
}

.crono-btn {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 3px dashed orange;
  background-color: orange;
  color: white;
  font-weight: bold;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  text-align: center;
  line-height: 1.2;
}

.crono-btn .crono-label span {
  display: block;
  color: white;
  font-size: 14px;
}

.crono-btn .crono-label small {
  display: block;
  font-size: 10px;
  margin-top: 2px;
  color: white;
}

.crono-btn.active {
  background-color: white;
  border: 3px dashed green;
}

.crono-btn.active .crono-label span {
  color: red;
}

.crono-btn.active .crono-label small {
  color: green;
}

.crono-btn:hover {
  background-color: orange;
  border-color: orange;
  color: white;
}
.crono-btn.active:hover {
  background-color: white;
  border-color: green;
}

.custom-crono-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.custom-dropdown {
  position: absolute;
  background: white;
  border: 1px solid #ccc;
  border-radius: 6px;
  list-style: none;
  padding: 4px 0;
  max-height: 150px;
  overflow-y: auto;
  width: 80px;
  z-index: 999;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  margin-top: 4px;
}

.custom-dropdown li {
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  text-align: center;
}

.custom-dropdown li:hover,
.custom-dropdown li.selected {
  background-color: #f0f0f0;
  font-weight: bold;
}

.hint {
  font-size: 10px;
  color: #999;
  text-align: center;
  margin-top: 2px;
}

.control-group {
  width: 100%;
  max-width: 500px;
  margin-bottom: 15px;
}

.days-selector {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.time-range {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  justify-content: center;
}

.time-range button {
  margin-left: 10px !important;
}

.schedule-planner button:not(.crono-btn) {
  padding: 8px 12px;
  font-size: 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.schedule-planner button:not(.crono-btn):hover {
  background-color: #0056b3;
}

.modal-button {
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

.modal-button:hover {
  background-color: #0056b3;
}

.btn-success {
  background-color: #28a745 !important;
  color: white;
}

.btn-success:hover {
  background-color: #218838;
}

.delete-btn {
  padding: 4px 8px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  background-color: #e53935 !important;
  color: white;
}

.delete-btn:hover {
  background-color: #f1b0b7 !important;
}
</style>