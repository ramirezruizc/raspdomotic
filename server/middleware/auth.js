const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Función para generar un nuevo token válido por 5 minutos
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

        // ⚠️ Si quedan menos de 60 segundos para expirar, renovar el token
        if (tiempoRestante < 60) {
            const newToken = generateToken(user);
            res.cookie("token", newToken, { httpOnly: true, sameSite: 'Strict' });
        }

        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Acceso denegado: Token inválido o expirado' });
    }
};

module.exports = authMiddleware;