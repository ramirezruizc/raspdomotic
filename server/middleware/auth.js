const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Función para generar un nuevo token válido durante 5 minutos
const generateToken = (user) => {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '5m' });
};

// Middleware de autenticación con token deslizante
const authMiddleware = async (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. Token no existe' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Buscar usuario en la base de datos
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Verificar cuánto tiempo le queda al token
        const tiempoRestante = decoded.exp - Math.floor(Date.now() / 1000);

        // Si quedan menos de 60 segundos para expirar, renovar el token
        if (tiempoRestante < 60) {
            console.log("Se renueva el token del usuario:", user.username);
            const newToken = generateToken(user);

            user.tokens = { token: newToken };
            await user.save();

            res.cookie("token", newToken, { httpOnly: true, sameSite: 'Strict' });
        }

        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Acceso denegado: Token inválido o expirado' });
    }
};

// Extensión para comprobar si el rol del usuario es admin o no
const isAdminMiddleware = (req, res, next) => {
    if (req.user && req.user.role.includes('admin')) {
        return next();
    }
    return res.status(403).json({ message: '⛔ Acceso solo para administradores' });
};

// Extensión para comprobar si el rol del usuario es s-user o no
const isSUserMiddleware = (req, res, next) => {
    if (req.user && req.user.role.includes('s-user')) {
        return next();
    }
    return res.status(403).json({ message: '⛔ Acción solo permitida para s-user' });
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
      if (!allowedRoles.includes(req.user.role)) {
        return res.sendStatus(403); // Forbidden
      }
      next();
    };
};

module.exports = { authMiddleware, isAdminMiddleware, isSUserMiddleware, authorizeRoles };