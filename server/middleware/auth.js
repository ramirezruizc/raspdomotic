const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

        if (user.invalidated) {
            return res.status(401).json({ message: 'Sesión expirada. Debe iniciar sesión de nuevo.' });
        }

        // Verificar cuánto tiempo le queda al token
        const tiempoRestante = decoded.exp - Math.floor(Date.now() / 1000);

        // Si quedan menos de 60 segundos para expirar, renovar el token
        if (tiempoRestante < 60) {
            console.log("🟢 Se renueva el token del usuario:", user.username);

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const sessionId = decoded.sessionId || crypto.randomUUID();

            const newToken = jwt.sign(
            {
                id: user._id,
                username: user.username,
                role: user.role,
                sessionId
            },
            process.env.JWT_SECRET,
            { expiresIn: '5m' }
            );

            user.tokens = { token: newToken };
            await user.save();

            res.cookie("token", newToken, { httpOnly: true, sameSite: 'Strict' });

            //En los casos en los que se renueva el token, utilizamos un flag
            //de modo que en cliente sepamos que debemos renovar times de sesion
            //const newDecoded = jwt.decode(newToken);
            //res.set('x-token-exp', String(newDecoded.exp * 1000));
            res.set('x-token-renewed', 'true');
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

//Sin uso actualmente...
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
      if (!allowedRoles.includes(req.user.role)) {
        return res.sendStatus(403); // Forbidden
      }
      next();
    };
};

module.exports = { authMiddleware, isAdminMiddleware, isSUserMiddleware, authorizeRoles };