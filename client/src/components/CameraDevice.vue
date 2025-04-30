<template>
  <div>
    <button @click="abrirModal">
      Ver Cámara
    </button>

    <div v-if="mostrarModal" class="overlay" @click="cerrarModal">
      <div class="modal-container" @click.stop>
        <h2>📷 Stream de la Cámara</h2>

        <div class="camera-container">
          <img :src="frameActual" alt="Stream de la cámara">
        </div>

        <button @click="cerrarModal">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script>
import { io } from "socket.io-client";

export default {
  data() {
    return {
      mostrarModal: false,
      frameActual: "",
      socket: null,
    };
  },

  mounted() {
    this.socket = io(window.location.origin, { path: "/socket.io", withCredentials: true });

    this.socket.on("camera_frame", (base64Image) => {
      this.frameActual = `data:image/jpeg;base64,${base64Image}`;
    });
  },

  methods: {
    abrirModal() {
      this.mostrarModal = true;
      this.socket.emit("request-camera"); // Activar cámara
    },

    cerrarModal(event) {
      console.log("Cierro el modal de stream de cámara");

      // Si no hay evento (llamado directamente) o si es el overlay o si se pulsa sobre cerrar
      if (!event || event.target.classList.contains("overlay") || event.target.tagName === "BUTTON") {
        this.mostrarModal = false;
        this.socket.emit("close-camera"); // Detener cámara
        this.frameActual = ""; // Reset de imagen
      }
    }
  }
};
</script>

<style scoped>
/* Estilos del Modal */
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
  max-height: 90vh; /* No deja que el modal sea más alto que el 90% de la pantalla */
  overflow-y: auto; /* Permite hacer scroll si el contenido es muy grande */
}

.camera-container {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: black;
  border: 3px solid #007bff;
  border-radius: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
}

.camera-container img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 5px;
}

button {
  width: 100%; /* Ocupar todo el ancho disponible */
  max-width: 200px; /* Limita el ancho máximo */
  padding: 10px 15px; /* Espaciado interno para que el texto no toque los bordes */
  font-size: 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  display: flex; /* Asegura que el contenido se adapte */
  align-items: center; /* Centra el texto verticalmente */
  justify-content: center; /* Centra el texto horizontalmente */
  text-align: center; /* Asegura que el texto esté alineado */
  white-space: normal; /* Permite saltos de línea automáticos */
  word-wrap: break-word; /* Rompe las palabras largas si es necesario */
  overflow-wrap: break-word; /* Alternativa para navegadores modernos */
  text-overflow: ellipsis; /* Si el texto es muy largo, muestra "..." */
}

.modal-container button {
  display: block; /* Asegura que el botón sea un bloque */
  margin: 0 auto; /* Centra horizontalmente */
}

button:hover {
  background-color: #0056b3;
}
</style>