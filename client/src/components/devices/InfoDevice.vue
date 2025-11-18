<template>
  <div class="info-container">
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

    <!-- Etiqueta con el nombre del dispositivo -->
    <span class="info-label">{{ deviceName }}:</span>

    <!-- Contenido principal: chips dinámicos -->
    <div class="info-group-vertical">
      <!-- Chips de atributos "principales" (sin label, SOLO chip) -->
      <div
        v-for="chip in primaryChips"
        :key="'p-'+chip.key"
        class="info-row"
      >
        <span class="status-chip" :class="chip.className">{{ chip.text }}</span>
      </div>

      <!-- Chips de atributos "extra" (label opcional) -->
      <div
        v-for="row in extraRows"
        :key="'e-'+row.key"
        class="info-row"
        style="margin-top:6px"
      >
        <span class="extra-chip chip-default">
          <!-- Si hay label entonces 'Label: valor', si no, sólo 'valor' -->
          <template v-if="row.label && row.label.length">
            {{ row.label }}: {{ formatValue(row) }}
          </template>
          <template v-else>
            {{ formatValue(row) }}
          </template>
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import api from "@/api/api";
import { io } from "socket.io-client";

export default {
  name: "InfoDevice",

  props: {
    deviceId:   { type: String, required: true },
    deviceName: { type: String, default: "Info" }
  },

  data() {
    return {
      socket: null,
      isOnline: false,
      isLoading: true,
      hasError: false,
      timeoutId: null,
      values: {},
      //Alineado a cómo se define el componente en Node-RED
      schema: { primary: [], extra: [] }
    };
  },

  async mounted() {
    this.setupSocket();
    this.fetchInitialStateWithTimeout();
  },

  beforeUnmount() {
    if (this.socket) {
      this.socket.off("info-update");
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  },

  computed: {
    //Construye chips principales (sin label)
    //match de clave-valor entre lo que tiene el sistema
    //ya sea por snapshot de deviceRegistry o por cambio
    //por websocket si se produce una modificacion estando online
    primaryChips() {
      return (this.schema.primary || []).map(def => {
        const raw = this.values?.[def.key];
        if (def.type === "boolean") {
          let text = "—";
          let className = "chip-default";

          if (raw === true) {
            text = def.trueText || "true";
            className = this.colorClass(def.trueColor);
          } else if (raw === false) {
            text = def.falseText || "false";
            className = this.colorClass(def.falseColor);
          }

          return { key: def.key, text, className };
        }

        // Otros tipos, imprime valor en chip por defecto
        return {
          key: def.key,
          text: this.formatValue({ ...def, value: raw }),
          className: "chip-default"
        };
      });
    },

    // Filas extra (label opcional)
    //match de clave-valor entre lo que tiene el sistema
    //ya sea por snapshot de deviceRegistry o por cambio
    //por websocket si se produce una modificacion estando online
    extraRows() {
      return (this.schema.extra || [])
        .filter(def => Object.prototype.hasOwnProperty.call(this.values || {}, def.key))
        .map(def => ({
          ...def,
          value: this.values[def.key]
        }));
    }
  },

  methods: {
    setupSocket() {
      this.socket = io(window.location.origin, {
        path: "/socket.io",
        withCredentials: true
      });

      // Espera: { deviceId, values:{...}, isOnline? }
      this.socket.on("info-update", (data) => {
        if (!data || data.deviceId !== this.deviceId) return;

        console.log(`🔄 Estado del InfoDevice ${data.deviceId}:`, data);

        if (typeof data.isOnline === "boolean") {
          this.isOnline = data.isOnline;
        }

        if (data.values && typeof data.values === "object") {
          this.values = data.values;
        }
      });
    },

    async fetchInitialStateWithTimeout() {
      // Timeout de cortesía
      this.timeoutId = setTimeout(() => {
        if (!this.isOnline && Object.keys(this.values).length === 0) {
          this.hasError = true;
          this.isLoading = false;
        }
      }, 3000);

      try {
        const { data } = await api.get(`/devices/${this.deviceId}/info`);
        if (!data?.success) throw new Error("Respuesta inválida /info");

        this.isOnline = !!data.isOnline;
        this.values   = data.values || {};
        this.schema   = this.deriveSchema(data.view || {});

        this.hasError = false;
      } catch (err) {
        console.error("❌ Error en fetch inicial de InfoDevice:", err);
        this.hasError = true;
      } finally {
        this.isLoading = false;
        if (this.timeoutId) { clearTimeout(this.timeoutId); this.timeoutId = null; }
      }
    },

    retryFetch() {
      this.hasError = false;
      this.isLoading = true;
      this.fetchInitialStateWithTimeout();
    },

    //Convierte view a esquema interno, preservando label vacío.
    //Aquí hacemoos normalizacion sobre como es el esquema del dipositivo en Node-RED
    //(la información que se espera que el dispositivo tenga), y que almacena el sistema
    //en cuanto a atributo-valor. Esto define como renderizar la informacion
    deriveSchema(view) {
      const primary = Array.isArray(view?.primary) ? view.primary.map(this.normalizeDef) : [];
      const extra   = Array.isArray(view?.extra)   ? view.extra.map(this.normalizeDef)   : [];

      return { primary, extra };
    },

    normalizeDef(def) {
      return {
        key: def.key,
        type: def.type || "auto",
        label: (typeof def.label === "string") ? def.label : "",
        unit: def.unit || "",
        decimals: (typeof def.decimals === "number") ? def.decimals : null,
        trueText: def.trueText || "",
        falseText: def.falseText || "",
        trueColor: def.trueColor || "green",
        falseColor: def.falseColor || "red"
      };
    },

    colorClass(color) {
      const c = String(color || "").toLowerCase();
      if (c === "green") return "chip-green";
      if (c === "red")   return "chip-red";
      if (c === "warn")  return "chip-warn";
      if (c === "blue")  return "chip-blue";
      return "chip-default";
    },

    formatValue(def) {
      const v = def.value;
      if (v === null || v === undefined) return "—";
      if (def.type === "number" && typeof v === "number") {
        if (typeof def.decimals === "number") {
          return `${v.toFixed(def.decimals)}${def.unit ? " " + def.unit : ""}`;
        }
        return `${v}${def.unit ? " " + def.unit : ""}`;
      }
      return `${v}${def.unit ? " " + def.unit : ""}`;
    }
  }
};
</script>

<style scoped>
.info-container {
  min-width: 0;
}

.info-group-vertical {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Etiqueta con nombre */
.info-label {
  flex-shrink: 0;
}

/* CHIP status */
.status-chip {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.90rem;
  background: #f1f3f5;
  border: 1px solid rgba(0,0,0,0.06);
  white-space: nowrap; /* evita salto de línea */
}

/* CHIP extra: mas pequeño que el primary */
.extra-chip {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.80rem;
  opacity: 0.95;
}

/* Colores */
.chip-green  { background:#e6f4ea; border-color:#b7e1c0; color:#1e7d34; }
.chip-red    { background:#fde8e8; border-color:#f5b5b5; color:#b00020; }
.chip-warn   { background:#fff4e5; border-color:#ffd59a; color:#8a5a00; }
.chip-blue   { background:#e7f1ff; border-color:#b7d2ff; color:#0b57d0; }
.chip-default{ background:#f1f3f5; border-color:#e1e5ea; color:#333; }

/* Spinner overlay */
.blocker-overlay {
  position: absolute;
  top: 0; left: 0;
  background: rgba(255, 255, 255, 0.85);
  width: 100%; height: 100%;
  z-index: 999;
  display: flex; justify-content: center; align-items: center;
  border-radius: 12px;
}
.spinner {
  width: 24px; height: 24px;
  border: 3px solid rgba(0, 0, 0, 0.2);
  border-top: 3px solid #007bff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }

.retry-button {
  background: none; border: none; font-size: 2rem;
  color: #007bff; cursor: pointer;
}
.retry-button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>