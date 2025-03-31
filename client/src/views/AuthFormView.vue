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
    <p>By: <strong>cramirez</strong> &copy; 2025
      <img src="/images/LogoUNED.png" alt="Logo" class="footer-logo" />
    </p>
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
            this.$router.push('/app'); // Redirige después de 1 seg
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

//Importa los estilos de AuthFormView
<style src="@/assets/css/AuthFormView.css" scoped></style>
