<template>
  <!-- Logo -->
  <div class="logo-container">
    <img src="/images/RD.png" alt="Logo" class="logo" />
  </div>

  <div>
    <h2>{{ isLogin ? 'Login' : 'Registro' }}</h2>

    <form @submit.prevent="handleSubmit">
      <label for="username"><strong>Usuario:</strong></label>
      <input type="text" id="username" v-model="formData.username" required />

      <label for="password"><strong>Contraseña:</strong></label>
      <input type="password" id="password" v-model="formData.password" required />

      <button type="submit">
        {{ isLogin ? 'Iniciar Sesión' : 'Registrar' }}
      </button>
    </form>

    <p @click="toggleMode">
      {{ isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? ' }}
      <strong>{{ isLogin ? 'Regístrate aquí' : 'Inicia sesión aquí' }}</strong>
    </p>

    <!-- Pantalla de carga mejorada -->
    <div v-if="loading" class="overlay">
      <div class="loading-container">
        <div v-if="status === 'loading'" class="spinner"></div>
        <div v-if="status === 'success'" class="status-icon success">✔️</div>
        <div v-if="status === 'error'" class="status-icon error">❌</div>
        <p>{{ statusMessage }}</p>
      </div>
    </div>
  </div>

  <footer class="footer">
    <p>By: <strong>cramirez</strong> &copy; 2025</p>
  </footer>
</template>

<script>
import api from '../api';
import { mapActions } from 'pinia';
import { useAuthStore } from '../store/auth';

export default {
  data() {
    return {
      isLogin: true,
      formData: { username: '', password: '' },
      loading: false, // Controla la pantalla de carga
      status: 'loading', // Puede ser 'loading', 'success' o 'error'
      statusMessage: 'Validando...', // Mensaje debajo del spinner
    };
  },
  methods: {
    ...mapActions(useAuthStore, ['setUser']), // Importar acción de Pinia

    toggleMode() {
      this.isLogin = !this.isLogin;
    },
    async handleSubmit() {
      this.loading = true;
      this.status = 'loading';
      this.statusMessage = 'Validando...';

      const endpoint = this.isLogin ? '/auth/login' : '/auth/register';
      try {
        const response = await api.post(endpoint, this.formData);

        console.log("Respuesta del backend de inicio de sesion para:", this.formData.username, response);

        if (this.isLogin) {
          console.log(`Usuario ${response.data.user.username} almacenado en Pinia`);
          this.setUser(response.data.user.username); // Guardar usuario en Pinia y sessionStorage
          this.status = 'success';
          this.statusMessage = '¡Inicio de sesión correcto!';
          
          setTimeout(() => {
            this.$router.push('/dashboard'); // Redirige después de 1 seg
          }, 1000);
        } else {
          this.status = 'success';
          this.statusMessage = 'Registro con éxito. ¡Inicia sesión!';

          setTimeout(() => {
            this.loading = false;
            this.isLogin = true; // Cambia a la vista de Login
          }, 2000);
        }
      } catch (error) {
        this.status = 'error';
        this.statusMessage = error.response?.data?.message || 'Ocurrió un error';
        
        setTimeout(() => {
          this.loading = false;
        }, 3000); // Oculta el error después de 3 seg
      }
    },
  },
};
</script>

<style scoped>
/* Formulario */
form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 320px;
  width: 100%;
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
}

input,
button {
  width: 100%;
  padding: 10px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: 5px;
  box-sizing: border-box;
}

button {
  background-color: #007bff;
  color: white;
  border: none;
  cursor: pointer;
}

button:hover {
  background-color: #0056b3;
}

/* Contenedor del logo */
.logo-container {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

/* Estilo del logo */
.logo {
  max-width: 100%;
  height: auto;
  max-height: 150px;
}

/* 🔹 PANTALLA DE CARGA SUPERPUESTA */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* 🔹 Contenedor del spinner e íconos */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: white;
  padding: 20px;
  border-radius: 15px;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
  text-align: center;
}

/* 🔹 Spinner animado */
.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(0, 0, 0, 0.1);
  border-top-color: #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 🔹 Iconos de estado */
.status-icon {
  font-size: 50px;
  margin-bottom: 10px;
}

.success {
  color: green !important;
}

.error {
  color: red !important;
}

.footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;  /* Espacio entre elementos */
  padding-bottom: 20px; /* Espacio extra debajo */
  font-size: 14px;
  text-align: center;
}

.footer strong {
  font-weight: bold;
}
</style>
