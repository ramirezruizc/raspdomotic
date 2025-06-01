const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const { authMiddleware, isAdminMiddleware, isSUserMiddleware } = require('../middleware/auth');
const logEvent = require('../utils/logEvent');
const mongoose = require('mongoose');
const router = express.Router();

//const { io } = require('../index'); // Importa io para usar WebSocket en rutas

// Registro
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).json({ message: 'El usuario ya existe' });

    // Verifica si ya existe un s-user del sistema, si no, el registro de
    // usuario se hará con ese rol, con privilegios especiales (nuke-database)
    const hasSuperUser = await User.exists({ role: 's-user' });

    // Asignar rol según si es el primer s-user o no
    const role = !hasSuperUser ? ['s-user', 'admin'] : ['user'];

    // Verificar estado del sistema
    const config = await SystemConfig.findOne();

    if (!config.allowRegistration && !role.includes('admin')) {
      return res.status(403).json({ message: 'Registro deshabilitado por el administrador.' });
    }

    const newUser = new User({ username, password, role });
    await newUser.save();

    // Registra registro de usuario
    await logEvent({
      eventType: 'register_success',
      user: newUser._id,
      additionalInfo: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    /* Por defecto, allowRegistration en systemConfig ya se estabelce a false
    if (role === 'admin') {
      const SystemConfig = require('../models/SystemConfig');
    
      await SystemConfig.findOneAndUpdate(
        {},
        { allowRegistration: false, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    
      console.log('⚙️ Configuración del sistema actualizada: allowRegistration = false');
    }
    */

    console.log(`✅ Usuario ${username} creado con rol ${role}`);
    res.status(201).json({ message: `Usuario registrado como ${role}` });
  } catch (err) {
    console.error('Error en el registro:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  console.log("Intento de inicio de sesion de:", username);

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });

    if (user.isSystem) {
      return res.status(403).json({ message: 'Este usuario no puede iniciar sesión.' });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch)
    {
      // Registra acceso incorrecto
      await logEvent({
      eventType: 'login_unsuccess',
      user: user._id,
      additionalInfo: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
        }
      });

      return res.status(400).json({ message: 'Contraseña incorrecta' });
    }

    // Registra acceso
    await logEvent({
      eventType: 'login_success',
      user: user._id,
      additionalInfo: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Verificar estado del sistema
    const config = await SystemConfig.findOne() || await SystemConfig.create({});

    if (config.maintenanceMode && !user.role.includes('admin')) {
      return res.status(403).json({
        message: 'El sistema está en mantenimiento. Solo los administradores pueden acceder.'
      });
    }

    //Generar Token JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '5m' });

    console.log("Nuevo token generado para:", username);

    // Almacenar el token en la base de datos
    user.tokens = { token: token };
    //user.tokens.push({ token }); // Añadimos el nuevo token al array de tokens
    await user.save(); // Guardamos el usuario con el nuevo token

    // Establecer la cookie http-only
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Solo https en producción
      maxAge: 5 * 60 * 1000, // 5 minutos
    });

    /*
    // NOTA: En este ejemplo, si se desea emitir un evento por WebSocket, se hace a traves de req.app
    const io = req.app.get("io");
    if (io) {
      io.emit("login_ok", { userId: user._id, message: "Usuario autenticado correctamente" });
    }
    */

  //  res.json({ token });
    res.json({ message: 'Inicio de sesión correcto', user: { username: user.username, role: user.role } });
  } catch (err) {
    console.error('Error en el login:', err); // Agregamos un log para el error
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Obtener información del usuario autenticado
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'No autenticado' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json({
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    console.error('Error en /me:', err);
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);

  if (!(await user.comparePassword(currentPassword))) {
    return res.status(400).json({ message: 'Contraseña actual incorrecta' });
  }

  user.password = newPassword;
  await user.save();

  // Registra cambio contraseña
  await logEvent({
    eventType: 'change_pass_success',
    user: user._id,
    additionalInfo: {
      ip: req.ip,
      userAgent: req.headers['user-agent']
      }
  });

  res.json({ message: 'Contraseña actualizada!' });
});

// Ruta para guardar el esquema de reordenación
router.post('/save-layout', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;  // El ID del usuario está disponible en req.user después de pasar por authMiddleware
    const { layout } = req.body;  // Recibimos el nuevo esquema en el cuerpo de la solicitud
    
    // Actualizar el esquema del usuario
    const user = await User.findByIdAndUpdate(userId, { layout }, { new: true });
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.status(200).json({ message: 'Esquema guardado correctamente', layout: user.layout });
  } catch (error) {
    console.error("Error al guardar el esquema:", error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

router.get('/get-layout', authMiddleware, async (req, res) => {
  const userId = req.user._id;

  try {
      const user = await User.findById(userId);

      res.json({ layout: user.layout });
  } catch (error) {
      res.status(500).json({ message: 'Error al obtener el layout', error });
  }
});

router.get('/keep-alive', authMiddleware, (req, res) => {
  res.status(200).json({ message: 'Sesión activa' });
});

// Logout (Borra el token)
router.post('/logout', async (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Cierre de sesión correcto' });
});

// Ruta para eliminar la base de datos (solo accesible para admin)
router.delete('/nuke-database', authMiddleware, isSUserMiddleware, async (req, res) => {
  const { confirmStep1, confirmStep2 } = req.body;

  // Validación de las dos confirmaciones
  if (!confirmStep1 || !confirmStep2) {
    return res.status(400).json({ message: 'Se requieren ambas confirmaciones para proceder con el borrado' });
  }

  try {
    // Intentamos borrar la base de datos
    await mongoose.connection.db.dropDatabase();
    console.log(`⚠️ Base de datos raspdomotic_db eliminada por el usuario ${req.user.username}`);
    res.status(200).json({ message: 'Base de datos eliminada correctamente.' });
  } catch (error) {
    console.error('Error eliminando base de datos:', error);
    res.status(500).json({ message: 'No se pudo eliminar la base de datos.', error });
  }
});

router.get('/users-list', async (req, res) => {
  try {
    const users = await User.find({}, 'username role isSystem').lean();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Cambiar rol de un usuario
router.post('/set-role', authMiddleware, isAdminMiddleware, async (req, res) => {
  const { username, role } = req.body;

  console.log("Usuaio a modificar rol:", req.body);

  if (
    !Array.isArray(role) ||
    !role.every(r => ['user', 'admin'].includes(r))
  ) {
    return res.status(400).json({ message: 'Rol inválido' });
  }

  try {
    /*const user = await User.findOneAndUpdate(
      { username },
      { role },
      { new: true }
    );*/

    const user = await User.findOne({ username });

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (user.isSystem || (user.role || []).includes('s-user')) {
      return res.status(403).json({ message: 'No se puede modificar este usuario del sistema' });
    }

    user.role = role;
    await user.save();

    res.json({ message: `Rol de ${username} actualizado a ${role}` });
  } catch (error) {
    console.error('Error actualizando rol:', error);
    res.status(500).json({ message: 'Error al actualizar rol' });
  }
});

// Eliminar un usuario
router.post('/delete-user', authMiddleware, isAdminMiddleware, async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Nombre de usuario requerido' });
  }

  try {
    //const user = await User.findOneAndDelete({ username });

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.isSystem || (user.role || []).includes('s-user')) {
      return res.status(403).json({ message: 'No se puede eliminar este usuario del sistema' });
    }

    await User.deleteOne({ _id: user._id });

    res.json({ message: `Usuario ${username} eliminado correctamente` });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

// 🔹 Ruta protegida (Verifica el token)
router.get('/protected-route', authMiddleware, (req, res) => {
  res.json({ message: 'Acceso concedido' });
});

module.exports = router;