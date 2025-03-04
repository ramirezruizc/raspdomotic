const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth'); // Importar el middleware de autenticación
const router = express.Router();

const { io } = require('../index'); // Importa io para usar WebSocket en rutas

// Registro
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).json({ message: 'El usuario ya existe' });

    const newUser = new User({ username, password });
    await newUser.save();
    res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (err) {
    console.error('Error en el registro:', err); // Agregamos un log para el error
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Contraseña incorrecta' });

    //Generar Token JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '5m' });

    // Almacenar el token en la base de datos
    user.tokens.push({ token }); // Añadimos el nuevo token al array de tokens
    await user.save(); // Guardamos el usuario con el nuevo token

    // Establecer la cookie http-only
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Solo https en producción
      maxAge: 5 * 60 * 1000, // 10 minutos
    });

    /*
    // NOTA: En este ejemplo, si deseas emitir un evento por WebSocket, hazlo a través de req.app
    const io = req.app.get("io");
    if (io) {
      io.emit("login_exitoso", { userId: user._id, message: "Usuario autenticado correctamente" });
    }
    */

  //  res.json({ token });
    res.json({ message: 'Inicio de sesión correcto' });
  } catch (err) {
    console.error('Error en el login:', err); // Agregamos un log para el error
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// 🔹 Logout (Borra el token)
router.post('/logout', async (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Cierre de sesión exitoso' });
});

// 🔹 Ruta protegida (Verifica el token)
router.get('/protected-route', authMiddleware, (req, res) => {
  res.json({ message: 'Acceso concedido', user: req.user });
});

module.exports = router;

/*
// Logout
router.post('/logout', async (req, res) => {
  const token = req.cookies.token; // Extraemos el token de la cookie

  if (!token) {
    return res.status(400).json({ message: 'Token ausente' });
  }

  try {
    // Decodificamos el token para obtener el userId
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscamos al usuario en la base de datos usando el userId
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Eliminamos el token de la lista de tokens del usuario
    //user.tokens = user.tokens.filter(t => t.token !== token);
    // Eliminar todos los tokens (limpiar el array)
    user.tokens = [];
    await user.save(); // Guardamos el cambio en la base de datos

    // Limpiamos la cookie que contiene el token
    res.clearCookie('token');

    //res.clearCookie('token', {
    //  httpOnly: true,
    //  secure: process.env.NODE_ENV === 'production',
    //  sameSite: 'Strict',
    //});

    res.json({ message: 'Cierre de sesión exitoso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al intentar cerrar sesión' });
  }
});
*/

/*
// Ruta protegida
router.get('/protected-route', authMiddleware, async (req, res) => {
  try {
    const oldToken = req.cookies.token; // Extraemos el token actual de la cookie

    if (!oldToken) {
      return res.status(401).json({ message: 'Token ausente' });
    }

    // Verificar y decodificar el token
    const decoded = jwt.verify(oldToken, process.env.JWT_SECRET);

    // Buscar al usuario en la base de datos
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Eliminar el token viejo del array de tokens
    user.tokens = user.tokens.filter(t => t.token !== oldToken);

    // Generar un nuevo token con tiempo extendido
    const newToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1m' });
    user.tokens.push({ token: newToken }); // Añadir el nuevo token a la lista

    await user.save(); // Guardar los cambios en la base de datos

    // Configurar la nueva cookie con el token renovado
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
      maxAge: 10 * 60 * 1000, // 10 minutos
    });

    res.json({ message: 'Token renovado correctamente' });
  } catch (err) {
    console.error('Error al renovar el token:', err);
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
});
*/

/*
router.get('/protected-route', authMiddleware, (req, res) => {
  res.json({ message: 'Acceso concedido', user: req.user }); // Devuelve un mensaje y los datos del usuario autenticado
});*/

//module.exports = router;