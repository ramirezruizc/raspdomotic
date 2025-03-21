<template>
  <div>
    <button @click="toggleCamera">
      {{ viendoCamara ? "Detener Cámara" : "Ver Cámara" }}
    </button>

    <div v-if="viendoCamara" class="camera-container">
      <img :src="frameActual" alt="Stream de la cámara">
    </div>
  </div>
</template>

<script>
import { io } from "socket.io-client";

export default {
  data() {
    return {
      viendoCamara: false,
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
    toggleCamera() {
      if (this.viendoCamara) {
        this.socket.emit("close-camera");
        this.frameActual = "";
      } else {
        this.socket.emit("request-camera");
      }
      this.viendoCamara = !this.viendoCamara;
    }
  }
};
</script>

<style scoped>
button {
  padding: 10px 20px;
  font-size: 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

button:hover {
  background-color: #0056b3;
}

.camera-container {
  width: 90vw;
  /* Se adapta al ancho del dispositivo */
  max-width: 600px;
  /* No más grande que 600px en escritorio */
  margin: 20px auto 0;
  /* Centrado y separado del botón */
  padding: 10px;
  background: black;
  /* Fondo oscuro para mejor contraste */
  border: 3px solid #007bff;
  border-radius: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  aspect-ratio: 1 / 1;
  /* Cuadro perfectamente cuadrado */
}

/* Ajuste del stream */
.camera-container img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  /* Evita distorsión */
  border-radius: 5px;
}
</style>