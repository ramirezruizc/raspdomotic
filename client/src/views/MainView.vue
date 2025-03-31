<template>
    <div class="mainview">
      <burguerMenu />
  
      <div class="logout">
        <span v-if="authStore.user" class="user-name">
          ¡Hola! <strong>{{ authStore.user }}</strong>
        </span>
        <a href="#" @click.prevent="logout" class="logout-link">Cerrar sesión</a>

        <VoiceControl />
      </div>
  
      <!-- 🔹 Aquí se cargará dinámicamente la página seleccionada -->
      <router-view />

      <!-- ⚠️ Aviso de que la sesión expirará pronto -->
      <div v-if="showWarning" class="session-warning">
        ⚠️ Tu sesión expirará en 1 minuto. Toca o haz clic para continuar.
      </div>

      <!-- Overlay de cierre de sesión -->
      <div v-if="logoutLoading" class="overlay">
        <div class="loading-container">
          <div v-if="logoutStatus === 'loading'" class="spinner"></div>
          <div v-if="logoutStatus === 'success'" class="status-icon success">✔️</div>
          <p>{{ logoutMessage }}</p>
        </div>
      </div>
    </div>
</template>
  
<script>
import api from '../api';
import { useAuthStore } from '../store/auth';
import burguerMenu from "../components/BurguerMenu.vue";
import VoiceControl from "../components/VoiceControl.vue";

export default {
  components: { 
    burguerMenu,
    VoiceControl
  },

  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },

  data() {
    return {
      sessionTimeout: null,
      warningTimeout: null,
      showWarning: false,
      inactivityLimit: 5 * 60 * 1000, // 5 minutos de inactividad
      warningTime: 4 * 60 * 1000, // Mostrar aviso 1 min antes
      loading: false,
      logoutLoading: false, // Controla el overlay de cierre de sesión
      logoutStatus: 'loading', // Puede ser 'loading' o 'success'
      logoutMessage: 'Cerrando sesión...' // Mensaje debajo del spinner
    };
  },

  async mounted() {
    window.addEventListener("click", this.resetSessionTimer);
    window.addEventListener("keypress", this.resetSessionTimer);
    window.addEventListener("touchstart", this.resetSessionTimer);
  },

  beforeUnmount() {
    window.removeEventListener("click", this.resetSessionTimer);
    window.removeEventListener("keypress", this.resetSessionTimer);
    window.removeEventListener("touchstart", this.resetSessionTimer);
    clearTimeout(this.sessionTimeout);
    clearTimeout(this.warningTimeout);
  },

  methods: {
    async logout() {
      this.logoutLoading = true;
      this.logoutStatus = 'loading';
      this.logoutMessage = 'Cerrando sesión...';
      console.log("Cerrando sesión");
      
      try {
        await api.post('/auth/logout');
        this.logoutStatus = 'success';
        this.logoutMessage = 'Sesión cerrada correctamente';

        setTimeout(() => {
          this.$router.push('/');
        }, 1000);
      } catch (error) {
        console.error('Error durante el logout:', error);
        this.$router.push('/');
      }
    },

    resetSessionTimer() {
      clearTimeout(this.sessionTimeout);
      clearTimeout(this.warningTimeout);
      this.showWarning = false;

      this.warningTimeout = setTimeout(() => {
        this.showWarning = true;
      }, this.warningTime);

      this.sessionTimeout = setTimeout(() => {
        this.logout();
      }, this.inactivityLimit);
    },
  }
};
</script>

/* Importa los estilos de MainView */
<style src="@/assets/css/MainView.css" scoped></style> 