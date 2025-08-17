  const { Server } = require('socket.io');
  const jwt = require('jsonwebtoken');
  const { publishMessage } = require('../mqtt/mqttClient');
  const { setStreamingActive, addViewer, removeViewer } = require('./shared/cameraState');

  const connectedUsers = new Map();

  // Definir orígenes permitidos
  const allowedOrigins = [
    "http://192.168.1.4",
    "http://raspi.local",
    "http://raspdomotic.ddns.net"
  ];

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
      // Escuchar cambios en la alarma
      //socket.on("toggle-alarm", (state) => {
      //    console.log(`🔔 Alarma ${state ? "activada" : "desactivada"} por ${socket.user.username}`);
      //    console.log("📤 Enviando estado de la alarma a todos los clientes:", state);
      //
      //    io.emit("alarm-status", state);
      //});

      /*
      // Escuchar cambios en la bombilla
      socket.on("toggle-bulb", (data) => {
        const newState = data.state;
        console.log(`💡 Bombilla ${newState === 'ON' ? 'encendida' : 'apagada'} por ${socket.user.username}`);
        console.log("📤 Enviando estado de la bombilla a todos los clientes:", newState);

        // Emitir el nuevo estado a todos los clientes
        //io.emit("bulb-status", { state: newState });
      });
      */

      // Control del número de visualizadores de streaming
      socket.on("request-camera", () => {
        console.log("📡 Iniciando stream...");

        setStreamingActive(true);

        const topic = 'esp01s/camara';
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

    //Namespace para gestion remota de sesiones de usuario
    const sessionNamespace = io.of("/session");

    sessionNamespace.use((socket, next) => {
      const token = socket.handshake.headers.cookie
        ?.split("; ")
        .find(row => row.startsWith("token="))
        ?.split("=")[1];

      if (!token) {
        console.log("❌ [session] Conexión rechazada: No hay token");
        return next(new Error("No autorizado"));
      }

      try {
        const user = jwt.verify(token, process.env.JWT_SECRET);
        console.log("🧾 [session] Usuario extraído del token:", user);
        socket.user = user;
        next();
      } catch (err) {
        console.log("❌ [session] Token inválido");
        return next(new Error("No autorizado"));
      }
    });

    sessionNamespace.on("connection", (socket) => {
      const userId = socket.user.id;
      const username = socket.user.username;
      const sessionId = socket.user.sessionId;

      const isSuperUser = Array.isArray(socket.user?.role)
        ? socket.user.role.includes("s-user")
        : socket.user?.role === "s-user";

      socket.sessionId = sessionId;

      console.log(`🟢 [session] Socket conectado: ${username} (${userId})`);
      const existingSocket = connectedUsers.get(userId);

      if (existingSocket) {
        console.log(`🔍 SessionId anterior: ${existingSocket.sessionId}`);
        console.log(`🔍 SessionId nuevo: ${sessionId}`);
      }

      if (existingSocket && existingSocket.sessionId !== sessionId) {
        if (isSuperUser) {
          console.log(`🛡️ ${username} es s-user. Permitimos múltiples sesiones.`);
          // No cerramos la conexión anterior
        } else {
          console.log(`🔁 [session] Usuario ${username} ya conectado. Desconectando anterior...`);
          existingSocket.emit("force-logout", { reason: "Has iniciado sesión en otro dispositivo." });
          existingSocket.disconnect(true);
        }
      }

      connectedUsers.set(userId, socket);

      socket.on("disconnect", () => {
        console.log(`🔌 [session] Usuario desconectado: ${username}`);
        connectedUsers.delete(userId);
      });
    });

    return io;
  }

  function getConnectedUserIds() {
    return Array.from(connectedUsers.keys());
  }

  function forceLogout(options = {}) {
    const {
      targetUserId = null,       // ID unico para expulsion individual
      include = null,            // Lista de IDs a expulsar
      includeRoles = null,       // Roles a incluir en la expulsion
      excludeUserId = null,      // ID del solicitante para no autoexpulsarse
      excludeRoles = [],         // roles que no deben ser expulsados
      reason = "Sesión cerrada por un administrador"
    } = options;

    // Logout individual
    if (targetUserId) {
      const socket = connectedUsers.get(targetUserId);

      if (socket) {
        const roles = socket.user?.role || [];
        const isProtected = excludeRoles.some(r =>
          Array.isArray(roles) ? roles.includes(r) : roles === r
        );

        if (isProtected) {
          console.log(`🛡️ Usuario ${targetUserId} tiene rol protegido. No será desconectado.`);
          return;
        }

        console.log(`🚫 Forzando logout de usuario: ${targetUserId}`);
        socket.emit("force-logout", { reason });
        socket.disconnect(true);
        connectedUsers.delete(targetUserId);
      }

      return;
    }

    // Logout explícito por lista de usuarios
    if (Array.isArray(include) && include.length > 0) {
      for (const userId of include) {
        if (userId === excludeUserId) {
          console.log(`🛡️ Usuario ${userId} es el solicitante. No será desconectado.`);
          continue;
        }

        const socket = connectedUsers.get(userId);
        if (!socket) continue;

        const roles = socket.user?.role || [];
        const isProtected = excludeRoles.some(r =>
          Array.isArray(roles) ? roles.includes(r) : roles === r
        );

        if (isProtected) {
          console.log(`🛡️ Usuario ${userId} tiene rol protegido. No será desconectado.`);
          continue;
        }

        console.log(`🚫 Forzando logout de usuario: ${userId}`);
        socket.emit("force-logout", { reason });
        socket.disconnect(true);
        connectedUsers.delete(userId);
      }
      return;
    }

    // Logout por Rol
    if (Array.isArray(includeRoles) && includeRoles.length > 0) { 
      for (const [userId, socket] of connectedUsers.entries()) {
        const roles = socket.user?.role || [];

        const hasMatchingRole = includeRoles.some(r => Array.isArray(roles) ? roles.includes(r) : roles === r);
        const hasProtectedRole = excludeRoles.some(r => Array.isArray(roles) ? roles.includes(r) : roles === r);

        if (!hasMatchingRole || hasProtectedRole || userId === excludeUserId) continue;

        console.log(`🚫 Forzando logout de usuario: ${userId}`);
        socket.emit("force-logout", { reason });
        socket.disconnect(true);
        connectedUsers.delete(userId);
      }
      return;
    }

    // Logout global
    for (const [userId, socket] of connectedUsers.entries()) {
      const roles = socket.user?.role || [];

      const hasProtectedRole = excludeRoles.some(r =>
        Array.isArray(roles) ? roles.includes(r) : roles === r
      );

      if (hasProtectedRole || userId === excludeUserId) {
        console.log(`🛡️ Usuario ${userId} protegido. No será desconectado.`);
        continue;
      }

      console.log(`🚫 Forzando logout de usuario: ${userId}`);
      socket.emit("force-logout", { reason });
      socket.disconnect(true);
      connectedUsers.delete(userId);
    }
  }

  module.exports = { initSocketIo, forceLogout, getConnectedUserIds };