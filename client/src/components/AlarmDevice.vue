<template>
	<div>
		<button @click="toggleAlarma" :class="alarma ? 'btn-on' : 'btn-off'">
			<i class="pi pi-power-off"></i>
		</button>
		<p>Alarma: <strong>{{ alarma ? "ACTIVADA" : "DESACTIVADA" }}</strong></p>
	</div>
</template>

<script>
import api from '../api';
import { io } from "socket.io-client";

export default {
	data() {
		return {
			alarma: false,
			socket: null,
		};
	},
	async mounted() {
		this.socket = io(window.location.origin, { path: "/socket.io", withCredentials: true });

		this.socket.on("alarm-status", (data) => {
			console.log("🔔 Estado de alarma actualizado:", data);
			this.alarma = data.status;
		});

		try {
			const response = await api.get('/devices/get-alarma');
			this.alarma = response.data.estado;
		} catch (error) {
			console.error("❌ Error al obtener el estado de la alarma:", error);
		}
	},
	methods: {
		async toggleAlarma() {
			const estadoPrevio = this.alarma;
			this.alarma = !this.alarma;

			try {
				const response = await api.post('/devices/set-alarma', { estado: this.alarma });
				if (!response.data.success) {
					throw new Error(response.data.message || "Error desconocido");
				}
				this.socket.emit("toggle-alarm", { status: this.alarma });
			} catch (error) {
				console.error("❌ Error al cambiar la alarma:", error);
				this.alarma = estadoPrevio;
			}
		}
	}
};
</script>

<style scoped>
p {
  margin-top: 10px;
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
</style>