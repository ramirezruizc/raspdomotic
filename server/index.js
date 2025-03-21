require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http'); 
const { Server } = require('socket.io');  // Para Socket.io (Vue web frontend)
const WebSocket = require('ws');         // Para WebSocket puro (ESP32-CAM y Node-RED)
const jwt = require('jsonwebtoken');
const { publishMessage } = require('./mqttClient'); // Importa el cliente MQTT

//const session = require("express-session");

// Importar rutas
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const { log } = require('console');

//const authSocket = require('./middleware/authSocket');
//const socketHandler = require('./sockets'); // Importamos los eventos

const app = express();

let alarmTriggered = false;
let streamingActive = false;
let activeViewers = 0;

// Configurar cookie-parser
app.use(cookieParser());

// Middleware
app.use(bodyParser.json());  // Asegura que req.body esté parseado como JSON

const server = http.createServer(app); // Crear servidor HTTP para Socket.io (WebSocket)

// Definir orígenes permitidos
const allowedOrigins = [
  "http://192.168.1.4",
  "http://raspi.local",
  "http://raspdomotic.ddns.net"
];

// Configurar CORS para HTTP (Express)
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "OPTIONS"], // Agrega OPTIONS
  credentials: true
}));

// Configurar Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"], // Agrega OPTIONS
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true
  }
});

app.set("io", io);

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
    streamingActive = true;
    //mqttClient.publish("esp01s/camara", "activar");
    const topic = 'esp01s/camara'; // Cambia por el tópico del dispositivo
    const message = 'activar';
    publishMessage(topic, message);
    cameraViewers.add(socket.id);
    //activeViewers++;
    //console.log(`🎥 Viewers conectados: ${activeViewers}`);
  });

  socket.on("close-camera", () => {
    cameraViewers.delete(socket.id);
    console.log(`❌ Cliente ${socket.id} dejó de ver la cámara`);
  });

  socket.on("disconnect", () => {
    cameraViewers.delete(socket.id);
    console.log("🔴 Cliente desconectado");
  });
});

// 🔹 Configurar WebSocket puro (ws)
const wss = new WebSocket.Server({ noServer: true });

//Peticiones Socket.io con URL '/ws' se redirigen a WS puro
server.on("upgrade", (request, socket, head) => {
  if (request.url === "/ws") {
    console.log("🔄 Update de conexión. Socket.io a WebSocket puro");
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

let cameraViewers = new Set(); // IDs de los clientes que quieren ver la cámara
let base64Image = null;

wss.on("connection", (ws, request) => {
  console.log("🟢 Cliente WebSocket conectado");

  ws.on("message", (message) => {
    try {
      // Verifica el mensaje recibido como buffer antes de convertirlo
      console.log("🔧 Mensaje recibido en formato Buffer:", message);

      // Convertimos el Buffer a texto para analizarlo
      const textMessage = message.toString().trim();
      //console.log("🔧 Mensaje recibido como texto:", textMessage);

      // 🔄 Si el mensaje es "STATUS", responder directamente
      if (textMessage === "STATUS") {
        console.log("🔄 Respondiendo al ESP32-CAM: 'BACKEND WS OK'");
        ws.send("BACKEND WS OK");
        return; // Salimos del handler sin hacer nada más
      }

      // Verificar si es JSON antes de intentar parsear
      if (textMessage.startsWith("{") && textMessage.endsWith("}")) {
        console.log("Comando recibido por JSON");
        try {
          const data = JSON.parse(textMessage); // Si es JSON, lo procesamos
          console.log(data);

          switch (data.action) {
            case "get_mode":
              let mode = "idle";
              if (alarmTriggered) {
                mode = "alarm";
                alarmTriggered = false;
              } else if (streamingActive) {
                mode = "stream";
              }
              ws.send(JSON.stringify({ action: "mode", mode }));
              break;
            case "alarm-triggered":
              console.log("🚨 Se ha producido una Alarma!");
              alarmTriggered = true;
              break;
            case "bulb-status":
              io.emit("bulb-status", { state: data.state });
              break;
            case "alarm-status":
              io.emit("alarm-status", { status: data.status });
              break;
            default:
              console.warn("⚠️ Acción desconocida recibida:", data.action);
          }
          return; // 🔹 Si era JSON, terminamos aquí
        } catch (err) {
          console.error("❌ Error procesando JSON:", err);
        }
      }

      // Si no es JSON, asumimos que es binario (imagen)
      console.log("📸 Imagen binaria recibida");
      base64Image = message.toString("base64");
      
      // Reenviar stream solo a los usuarios que solicitaron
      if (cameraViewers.size > 0) {
        io.to([...cameraViewers]).emit("camera_frame", base64Image);
      }
      else if (cameraViewers.size == 0) {
        mode = "stop-stream";
        streamingActive = false;
        base64Image = null;
        console.log("ESP32-CAM DeepSleep");
        ws.send(JSON.stringify({ action: "mode", mode }));
      }
      return;
    } catch (err) {
      console.error("❌ Error procesando mensaje:", err);
    }
  });

  ws.on("close", () => {
    console.log("🔴 Cliente WebSocket desconectado");
  });
});

// Ruta raíz para comprobar el estado del servidor
app.get('/', (req, res) => {
  res.send('Servidor funcionando correctamente');
});

const connectWithRetry = () => {
  console.log("🔄 Intentando conectar con MongoDB...");
  mongoose
    .connect(process.env.DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => {
      console.log("✅ Conectado a MongoDB");
    })
    .catch((err) => {
      console.error("❌ Error conectando a MongoDB:", err);
      console.log("⏳ Reintentando en 5 segundos...");
      setTimeout(connectWithRetry, 5000); // Reintentar en 5 segundos
    });
};

// Conectar al inicio
connectWithRetry();

// 🔄 Detectar desconexión y reconectar
mongoose.connection.on("disconnected", () => {
  console.error("⚠️ Se perdió la conexión con MongoDB. Intentando reconectar...");
  connectWithRetry();
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);

// Servidor web con Socket.io y WS 'puro' escuchando
const PORT = process.env.PORT || 7000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});

//module.exports = { app, server, io };