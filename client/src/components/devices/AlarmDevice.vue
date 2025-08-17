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

		<button
			@click="toggleAlarma"
			:class="alarma ? 'btn-on' : 'btn-off'"
			:disabled="isLoading || hasError"
		>
			<i class="pi pi-power-off"></i>
		</button>
		<p>Alarma: <strong>{{ alarma ? "ACTIVADA" : "DESACTIVADA" }}</strong></p>
	</div>
</template>

<script>
import api from '@/api/api';
import { io } from "socket.io-client";

export default {
	data() {
		return {
			isLoading: true,
			hasError: false,
			alarma: false,
			socket: null,
		};
	},
	async mounted() {
		this.socket = io(window.location.origin, { path: "/socket.io", withCredentials: true });

		this.socket.on("alarm-status", (data) => {
			console.log("🔔 Estado de alarma actualizado:", data.status);
			this.alarma = data.status;
		});

		this.fetchEstado();
	},
	methods: {
		async fetchEstado() {
			this.isLoading = true;
			this.hasError = false;

			try {
				const response = await api.get('/devices/get-alarma');
				this.alarma = response.data.estado;
			} catch (error) {
				console.error("❌ Error al obtener el estado de la alarma:", error);
				this.hasError = true;
			} finally {
				this.isLoading = false;
			}
		},

		retryFetch() {
			this.fetchEstado();
		},

		async toggleAlarma() {
			const estadoPrevio = this.alarma;
			this.alarma = !this.alarma;
			this.isLoading = true;

			try {
				const response = await api.post('/devices/set-alarma', { estado: this.alarma });
				if (!response.data.success) {
					throw new Error(response.data.message || "Error desconocido");
				}
				this.socket.emit("toggle-alarm", { status: this.alarma });
			} catch (error) {
				console.error("❌ Error al cambiar la alarma:", error);
				this.alarma = estadoPrevio;
			} finally {
				this.isLoading = false;
			}
		}
	}
};
</script>

<style scoped>
.toggle-container {
  min-width: auto; /* Evita forzar un ancho mínimo */
  max-width: 100%; /* Se adapta sin desbordarse */
  flex-grow: 1;
  position: relative;
  padding-top: 5px;
}

p {
  margin-top: 10px;
  margin-bottom: 0px;
  font-size: 14px;
  overflow-wrap: break-word; /* Asegura que el texto largo se rompa */
  word-wrap: break-word;
  white-space: normal; /* Permite que el texto fluya y no se corte */
}

button {
  padding: 10px 20px;
  font-size: 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  max-width: 100%; /* Evita que el botón se expanda más allá de su contenedor */
}

button:hover {
  background-color: #0056b3;
}

.btn-on {
  background-color: green !important;
  color: white;
  box-shadow: 0px 0px 15px rgba(0, 255, 0, 0.6); /* Brillo verde */
}

/* Estado cuando el botón ALARMA está apagado */
.btn-off {
  background-color: red !important;
  color: white;
  box-shadow: 0px 0px 15px rgba(255, 0, 0, 0.6); /* Brillo rojo */
}

/* Efecto de "presionado" cuando se hace clic */
button:active {
  transform: scale(0.9); /* Se reduce ligeramente */
  box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.2); /* Reduce sombra al presionar */
}

/* Aplica la animación cuando está activado */
.btn-on {
  animation: pulsar 0.5s infinite alternate;
}

/* Animación de encendido y apagado */
@keyframes pulsar {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
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