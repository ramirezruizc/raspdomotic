const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { publishMessage } = require('../mqtt/mqttClient');
const { setStreamingActive, getCameraViewers, addViewer, removeViewer } = require('./shared/cameraState');

// Definir orígenes permitidos
const allowedOrigins = [
  "http://192.168.1.4",
  "http://raspi.local",
  "http://raspdomotic.ddns.net"
];

let cameraViewers = new Set(); // IDs de los clientes que quieren ver la cámara

function initSocketIo(server) {
  // Configurar Socket.io
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST", "OPTIONS"], // Agrega OPTIONS
      allowedHeaders: ["Authorization", "Content-Type"],
      credentials: true
    }
  });

  //app.set("io", io);

  // Middleware para autenticar WebSockets
  io.use((socket, next) => {
    const token = socket.handshake.headers.cookie
        ?.split("; ")
        .find(row => row.startsWith("token="))
        ?.split("=")[1];

    //const token = socket.handshake.query.token;

    if (!token) {
        console.log("❌ Conexión rechazada: No hay token");
        return next(new Error("No autorizado"));
    }

    try {
        const user = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = user; // Guardar usuario en el socket
        next();
    } catch (err) {
        console.log("❌ Token inválido");
        return next(new Error("No autorizado"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`🟢 Cliente socket.io autenticado conectado: ${socket.user}`);

    // Escuchar cambios en la alarma
    socket.on("toggle-alarm", (state) => {
        console.log(`🔔 Alarma ${state ? "activada" : "desactivada"} por ${socket.user.username}`);
        console.log("📤 Enviando estado de la alarma a todos los clientes:", state);

        io.emit("alarm-status", state);
    });

    // Escuchar cambios en la bombilla
    socket.on("toggle-bulb", (data) => {
      const newState = data.state;
      console.log(`💡 Bombilla ${newState === 'ON' ? 'encendida' : 'apagada'} por ${socket.user.username}`);
      console.log("📤 Enviando estado de la bombilla a todos los clientes:", newState);

      // Emitir el nuevo estado a todos los clientes
      //io.emit("bulb-status", { state: newState });
    });

    // Control del número de visualizadores de streaming
    socket.on("request-camera", () => {
      console.log("📡 Iniciando stream...");

      setStreamingActive(true);

      const topic = 'esp01s/camara'; // Cambia por el tópico del dispositivo
      const message = 'activar';

      publishMessage(topic, message);

      addViewer(socket.id);
    });

    socket.on("close-camera", () => {
      removeViewer(socket.id);
    });

    socket.on("disconnect", () => {
      removeViewer(socket.id);
    });
  });

  return io;
}

module.exports = { initSocketIo };