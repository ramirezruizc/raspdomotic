<template>
  <div class="toggle-container">
    <span class="toggle-label">Salón:</span>

    <label class="toggle-switch">
      <input type="checkbox" v-model="bulbState" @change="toggleBulb" />
      <span class="slider"></span>
    </label>

    <span class="toggle-label">{{ bulbState ? "ON" : "OFF" }}</span>
  </div>
</template>

<script>
import api from '../api';
import { io } from "socket.io-client";

export default {
  data() {
    return {
      bulbState: false,
      socket: null,
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
      this.bulbState = response.data.estado;
    } catch (error) {
      console.error("❌ Error al obtener el estado de la bombilla:", error);
    }
  },
  methods: {
    async toggleBulb() {
      const estadoPrevio = !this.bulbState;
      const newState = this.bulbState ? "ON" : "OFF";

      try {
        const response = await api.post('/devices/toggle-bulb', { estado: newState });
        if (!response.data.success) {
          throw new Error(response.data.message || "Error desconocido");
        }
      } catch (error) {
        console.error("❌ Error al cambiar estado de la bombilla", error);
        this.bulbState = estadoPrevio;
      }
    }
  }
};
</script>

<style scoped>
.toggle-container {
  min-width: auto; /* 🔹 Evita forzar un ancho mínimo */
  max-width: 100%; /* 🔹 Se adapta sin desbordarse */
  flex-grow: 1; 
}

.toggle-label {
  flex-shrink: 0; /* 🔹 Evita que se achique el texto */
}

/* 🔹 Estilos del switch */
.toggle-switch {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 50px;
  height: 24px;
  min-width: 40px; /* 🔹 Evita que el switch sea demasiado pequeño */
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
</style>