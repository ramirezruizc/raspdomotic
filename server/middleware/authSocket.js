// /server/middleware/authSocket.js
const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const User = require("../models/User");

const authSocket = async (socket, next) => {
    try {
        // Extraer las cookies del handshake
        const cookies = socket.handshake.headers.cookie;
        if (!cookies) {
            return next(new Error("Acceso denegado: No hay cookies"));
        }
        const parsedCookies = cookie.parse(cookies);
        const token = parsedCookies.token;
        if (!token) {
            return next(new Error("Acceso denegado: Token no encontrado"));
        }
        // Verificar y decodificar el token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            return next(new Error("Acceso denegado: Usuario no encontrado"));
        }
        // Adjuntar el usuario autenticado al socket
        socket.user = user;
        next();
    } catch (err) {
        next(new Error("Acceso denegado: Token inválido o expirado"));
    }
};

module.exports = authSocket;
