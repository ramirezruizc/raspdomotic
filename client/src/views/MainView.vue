<template>
  <div v-if="isHydrating" class="overlay">
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Validando sesión...</p>
    </div>
  </div>

  <div v-else class="mainview">
    <burguerMenu />
    
    <div class="logout">
      <span v-if="authStore.user" class="user-name">
        ¡Hola! <strong>{{ authStore.user }}</strong>
      </span>
      <a href="#" @click.prevent="authStore.logout" class="logout-link">Salir</a>
    </div>

    <transition name="fade" mode="out-in">
      <div class="view-wrapper">
        <router-view />
      </div>
    </transition>

    <footer class="main-footer">
      <VoiceControl />
    </footer>

    <!-- Overlay de carga global -->
    <div v-if="sessionStore.isLoading" class="overlay">
      <div class="loading-container">
        <div class="spinner"></div>
        <p>{{ sessionStore.loadingMessage }}</p>
      </div>
    </div>

    <!-- Aviso de expiración de sesión -->
    <div v-if="sessionStore.showWarning" class="session-warning" @click="sessionStore.resetSessionTimer()">
      ⚠️ Tu sesión expirará en 1 minuto. Toca o haz clic para continuar.
    </div>

    <!-- Overlay de logout -->
    <div v-if="authStore.logoutLoading" class="overlay">
      <div class="loading-container">
        <div v-if="authStore.logoutStatus === 'loading'" class="spinner"></div>
        <div v-if="authStore.logoutStatus === 'success'" class="status-icon success">✓</div>
        <p>{{ authStore.logoutMessage }}</p>
      </div>
    </div>
  </div>
</template>
  
<script>
import { useAuthStore, useSessionStore } from '../store/mainStore';
import burguerMenu from "../components/BurguerMenu.vue";
import VoiceControl from "../components/VoiceControl.vue";
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

export default {
  components: { 
    burguerMenu,
    VoiceControl
  },

  setup() {
    const authStore = useAuthStore();
    const sessionStore = useSessionStore();
    const isHydrating = ref(true);
    const router = useRouter();

    onMounted(async () => {
      try {
        await authStore.hydrateFromServer(); // Intentamos obtener el usuario desde el backend
        sessionStore.resetSessionTimer();    // Sólo si se autenticó bien
      } catch (error) {
        console.warn("No se pudo hidratar la sesión:", error);
        router.push("/login");
      } finally {
        isHydrating.value = false;
      }
    });

    return {
      authStore,
      sessionStore,
      isHydrating
    };
  },

  methods: {
    async logout() {
      //Logout centralizado desde mainSotre.js
      await this.authStore.logout();
    }
  },

  watch: {
    // Observamos los cambios en showWarning para renovar la sesión
    "sessionStore.showWarning"(newValue) {
      if (!newValue && !this.authStore.logoutLoading) {
        this.sessionStore.keepSessionAlive();
      }
    }
  }
};
</script>

/* Importa los estilos de MainView */
<style src="@/assets/css/MainView.css" scoped></style> 