//require('dotenv').config({ path: __dirname + '/.env' });
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http'); 
const { initSocketIo } = require('./services/webSocket/socketIoManager');
const { initWss } = require('./services/webSocket/wssManager');
const mqttClient = require('./services/mqtt/mqttClient');
const { loadDevicesFromNodeRed } = require('./services/device/deviceLoader');
const { initScheduleExecutor } = require('./services/scheduler/schedulerExecutor');
const { initCronoExecutor } = require('./services/crono/cronoExecutor');

// Importar rutas
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const eventRoutes = require('./routes/events');
const systemConfigRoutes = require('./routes/systemConfig');
const scheduleRoutes = require('./routes/schedule');
const cronoRoutes = require('./routes/crono');
const { log } = require('console');

const app = express();

console.log(">> cwd:", process.cwd());
console.log(">> __dirname:", __dirname);

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

// Ruta raíz para comprobar el estado del servidor
app.get('/', (req, res) =>  {
  res.send('Servidor funcionando correctamente');
});

async function startServer() {
  try {
    console.log("🔄 Intentando conectar con MongoDB...");
    await mongoose.connect(process.env.DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ Conectado a MongoDB");

    //Cargamos dispositivos registrados en Node-RED
    //Node-RED será nuestra fuente de verdad
    //Hay un flujo "Config" donde se definen los devices
    await loadDevicesFromNodeRed();

    //WebSocket socket.io
    const io = initSocketIo(server);

    //Websocket wss (mas primitivo, necesario para usar con
    //microcontroladores y sistemas embebidos como ESP-32, etc)
    initWss(server, io);

    console.log("🔄 Inicializando cliente MQTT...");
    mqttClient.initMqtt(io);

    // Inicializar planificación
    initScheduleExecutor();

    // Inicializar expiración de cronos
    initCronoExecutor(io);

    //Por el momento, habilito la posibilidad
    //de llamar a io desde cualquier parte de
    //la aplicación para usar io.emit(xx, yy)
    //previa instancia de
    //const io = req.app.get("io");
    //o
    //this.socket = io(window.location.origin,
    //  { path: "/socket.io", withCredentials: true });
    app.set('io', io);

    // Rutas
    app.use('/api/v1/auth', authRoutes);
    //Rutas susceptibles de comunicacion por MQTT y Socket.io
    //Inyeccion de dependencias
    app.use('/api/v1/devices', deviceRoutes(mqttClient, io));
    app.use('/api/v1/events', eventRoutes);
    app.use('/api/v1/systemConfig', systemConfigRoutes);
    app.use('/api/v1/schedule', scheduleRoutes);
    app.use('/api/v1/crono', cronoRoutes);

    const PORT = process.env.PORT || 7000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
    });

    // Detectar desconexión y reconectar MongoDB
    mongoose.connection.on("disconnected", () => {
      console.error("⚠️ Se perdió la conexión con MongoDB. Intentando reconectar...");
      reconnectMongo();
    });
  } catch (err) {
    console.error("❌ Error al iniciar el servidor:", err);
    process.exit(1);
  }
}

// Reconectar MongoDB si se pierde conexión
function reconnectMongo() {
  setTimeout(() => {
    console.log("🔄 Reintentando conexión a MongoDB...");
    mongoose.connect(process.env.DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }).catch(err => {
      console.error("❌ Reintento fallido:", err);
      reconnectMongo(); // vuelve a intentar
    });
  }, 5000);
}

// Inicia el servidor
startServer();