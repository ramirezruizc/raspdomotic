<template>
  <!-- Logo -->
  <div class="logo-container">
    <img src="/images/RD.png" alt="Logo" class="logo" />
  </div>

  <div class="AuthForm" v-if="isLoaded">
    <!-- Vista principal -->
    <h2>{{ isLogin ? 'Login' : 'Registro' }}</h2>

    <!-- Muestra alerta si hay modo mantenimiento activo y no estamos en registro -->
    <p v-if="maintenanceMode && isLogin" class="info-message">
      ⚠️ Modo mantenimiento activado. Solo usuarios administradores pueden iniciar sesión.
    </p>

    <!-- Mensaje para primer usuario -->
    <p v-if="initialSetup" class="info-message">
      🛠️ No se ha detectado ningún usuario en el sistema. 
      Registra el primer usuario administrador para continuar.
    </p>

    <form @submit.prevent="handleSubmit">
      <label for="username"><strong>Usuario:</strong></label>
      <input type="text" id="username" v-model="formData.username" required />

      <label for="password"><strong>Contraseña:</strong></label>
      <input type="password" id="password" v-model="formData.password" required />

      <button type="submit">
        {{ initialSetup ? 'Registrar administrador' : (isLogin ? 'Iniciar Sesión' : 'Registrar') }}
      </button>
    </form>

    <!-- Mostrar mensaje si el registro está deshabilitado (pero solo si no hay mantenimiento) -->
    <p v-if="!initialSetup && !allowRegistration && !maintenanceMode" class="info-message">
      🛑 El registro de nuevos usuarios está deshabilitado.
      Contacta al administrador si necesitas acceso.
    </p>

    <!-- Alternar entre login y registro (si está permitido y no hay mantenimiento) -->
    <p v-if="!initialSetup && allowRegistration && !maintenanceMode" @click="toggleMode">
      {{ isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? ' }}
      <strong>{{ isLogin ? 'Regístrate aquí' : 'Inicia sesión aquí' }}</strong>
    </p>
  </div>

  <!-- Pantalla de carga -->
  <div v-if="loading" class="overlay">
    <div class="loading-container">
      <div v-if="status === 'loading'" class="spinner"></div>
      <div v-if="status === 'success'" class="status-icon success">✓</div>
      <div v-if="status === 'error'" class="status-icon error">❌</div>
        <p>{{ statusMessage }}</p>
    </div>
  </div>

  <!-- Footer -->
  <footer class="footer">
    <p>By: <strong>cramirez</strong> &copy; 2025
      <img src="/images/LogoUNED.png" alt="Logo" class="footer-logo" />
    </p>
  </footer>
</template>

<script>
import { mapActions } from 'pinia';
import { useAuthStore } from '../store/mainStore';
import { login, register } from '@/api/auth';
import { getSystemConfig } from '@/api/systemConfig';

export default {
  data() {
    return {
      isLogin: true,
      formData: {
        username: '',
        password: ''
      },
      loading: false,
      status: 'loading',
      isLoaded: false,
      statusMessage: 'Validando...',
      allowRegistration: false,
      maintenanceMode: false,
      initialSetup: false
    };
  },
  methods: {
    ...mapActions(useAuthStore, ['setUser']),

    toggleMode() {
      if (this.initialSetup) return;
      this.isLogin = !this.isLogin;
    },

    async handleSubmit() {
      this.loading = true;
      this.status = 'loading';
      this.statusMessage = 'Validando...';

      try {
        const response = this.isLogin
          ? await login(this.formData)
          : await register(this.formData);

        if (this.isLogin) {
          this.setUser(response.user);
          this.status = 'success';
          this.statusMessage = '¡Inicio de sesión correcto!';
          this.formData.username = '';
          this.formData.password = '';
          setTimeout(() => this.$router.push('/app'), 1000);
        } else {
          this.status = 'success';
          this.statusMessage = 'Registro correcto. ¡Inicia sesión!';
          setTimeout(() => {
            this.loading = false;
            this.isLogin = true;
            this.initialSetup = false;
            this.formData.username = '';
            this.formData.password = '';
          }, 2000);
        }
      } catch (error) {
        this.status = 'error';
        this.statusMessage = error.response?.data?.message || 'Ocurrió un error';
        setTimeout(() => {
          this.loading = false;
        }, 3000);
      }
    },

    async checkSystemConfig() {
      try {
        this.loading = true;
        this.status = 'loading';
        this.statusMessage = 'Validando...';

        const config = await getSystemConfig();

        console.log("Configuración del sistema:", config);

        this.allowRegistration = config.allowRegistration;
        this.maintenanceMode = config.maintenanceMode;

        if (config.initialSetup) {
          this.isLogin = false;
          this.initialSetup = true;
        }

        this.loading = false;
      } catch (error) {
        console.error('Error al cargar configuración del sistema', error);
      }
    },
  },

  async mounted() {
    this.isLoaded = false;
    await this.checkSystemConfig();
    this.isLoaded = true;
  }
};
</script>

<style src="@/assets/css/AuthFormView.css" scoped></style>