const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: [String],
    //enum: ['s-user', 'user', 'admin', 'system'],
    default: ['user'],
  },
  tokens: { token: String }, // Almacena el token emitido para el usuario
  layout: { // Almacena el esquema del Home Control del usuario
    type: Array, 
    default: [] 
  },
  isSystem: { type: Boolean, default: false },
  invalidated: { type: Boolean, default: false },
  blocked: { type: Boolean, default: false }
});

// Middleware para cifrar contraseñas
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Método para comparar contraseñas
UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);