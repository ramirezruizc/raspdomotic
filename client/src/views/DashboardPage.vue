<template>
  <div class="dashboard">
    <div>
      <burguerMenu />
    </div>

    <div class="logout">
      <span v-if="authStore.user" class="user-name">
        ¡Hola! <strong>{{ authStore.user }}</strong>
      </span>
      <a href="#" @click.prevent="logout" class="logout-link">Cerrar sesión</a>
    </div>
    <h1>Dashboard</h1>

    <!-- Contenedor de categorías draggable -->
    <div class="categories-container">
      <draggable v-model="groupedDevices" item-key="category" group="categories" @end="saveOrder" 
      handle=".drag-handle" class="category-grid">
        <template #item="{ element: category }">
          <div class="device-category-container">
            <h2>
              <span class="drag-handle"><i class="pi pi-ellipsis-v"></i></span> 
              {{ category.category }}
            </h2>

            <!-- Contenedor de dispositivos draggable -->
            <draggable v-model="category.devices" item-key="id" group="devices" @end="saveOrder"
            handle=".drag-handle" class="device-grid" :forceFallback="true" :fallbackOnBody="true"
            :move="checkMove">
              <template #item="{ element: device }">
                <div class="device-container">
                  <span class="drag-handle"><i class="pi pi-ellipsis-v"></i></span> 
                  <div class="device-content">
                    <component :is="getComponent(device.type)" v-if="getComponent(device.type)" :key="device.id" />
                  </div>
                </div>  
              </template>
            </draggable>
          </div>
        </template>
      </draggable>
    </div>

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
import { io } from "socket.io-client";
import { useAuthStore } from '../store/auth';
import componentMap from '../components/DeviceMapper';
import draggable from 'vuedraggable';
import burguerMenu from "../components/BurguerMenu.vue";

export default {
  components: { 
    draggable,
    burguerMenu
  },

  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },

  data() {
    return {
      devices: [],  // Lista de dispositivos obtenidos desde Node-RED
      groupedDevices: [],
      socket: null,
      alarmStatus: false,
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
    console.log("Componentes mapeados:", componentMap);

    console.log("Usuario en Pinia al montar Dashboard:", this.authStore.user);
    this.resetSessionTimer(); // Inicia el temporizador de sesión

    await this.loadDevices();

    this.socket = io(window.location.origin, {
      path: "/socket.io",
      withCredentials: true
      //transports: ["websocket"]
    });

    this.socket.on("connect", () => {
      console.log("✅ Conectado a WebSocket");
    });

    this.socket.on("disconnect", () => {
      console.log("🔴 Desconectado de WebSocket");
    });

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
    async loadDevices() {
      try {
        const response = await api.get('/devices/get-devices');
        if (response.data.success) {
          console.log("📥 Dispositivos obtenidos:", response.data);
          this.devices = response.data.devices || [];  // ✅ Si es undefined, asigna []
          
          // Agrupar los dispositivos en categorías manualmente
          const grouped = {};
          this.devices.forEach(device => {
            if (!grouped[device.category]) {
              grouped[device.category] = { category: device.category, devices: [] };
            }
            grouped[device.category].devices.push(device);
          });

          this.groupedDevices = Object.values(grouped);  // ✅ Se mantiene reactivo
        } else {
          console.error("⚠️ Respuesta inesperada del backend:", response.data);
          this.devices = [];
        }
      } catch (error) {
        console.error("❌ Error al obtener dispositivos:", error);
      }
    },

    getComponent(tipo) {
      console.log("Obteniendo componente del tipo:",tipo);
      return componentMap[tipo] || null;
    },

    checkMove(event) {
      // Evita mover entre categorías diferentes
      return event.to === event.from;
    },

    async logout() {
      this.logoutLoading = true;
      this.logoutStatus = 'loading';
      this.logoutMessage = 'Cerrando sesión...';
      
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

/* Importa los estilos de DashboardPage */
<style src="@/assets/css/DashboardPage.css" scoped></style> 