<template>
  <div class="menu-burguer">
    <!-- Botón de hamburguesa -->
    <button class="burger-btn" @click="toggleMenu">
      <i class="pi pi-bars"></i>
    </button>

    <!-- Menú desplegable con overlay -->
    <div v-if="mostrarMenu">
      <div class="menu-overlay" @click="cerrarMenu"></div> <!-- Overlay para cerrar menú -->
      <div class="menu-container" @click.stop> <!-- Evita cierre al hacer clic dentro -->
        <h2>RaspDomotic</h2>
        <ul>
          <li v-for="(item, index) in opciones" :key="index" @click="seleccionarOpcion(item)">
            {{ item.nombre }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '@/store/mainStore';
import { routeRoles } from '@/permissions/routeRoles';  

export default {
  data() {
    return {
      mostrarMenu: false,
      opcionesBase: [
        { nombre: "Home Control", ruta: "/app" },
        { nombre: "Dashboard", ruta: "/app/dashboard" },
        { nombre: "Configuration", ruta: "/app/configuration" },
      ],
    };
  },

  computed: {
    opciones() {
      const authStore = useAuthStore();
      const userRoles = authStore.role || [];

      return this.opcionesBase.filter(item => {
        const required = routeRoles[item.ruta];
        if (!required) return true; // sin restricciones = visible
        return required.some(r => userRoles.includes(r));
      });
    },
  },

  methods: {
    toggleMenu() {
      this.mostrarMenu = !this.mostrarMenu;
    },
    cerrarMenu() {
      this.mostrarMenu = false;
    },
    seleccionarOpcion(item) {
      console.log(`Navegando a: ${item.ruta}`);
      this.mostrarMenu = false;

      // usamos Vue Router: this.$router.push(item.ruta);
      this.$router.push(item.ruta);
      this.mostrarMenu = false;
    },
  },
};
</script>

<style scoped>
/* Estilos del botón hamburguesa */
.burger-btn {
  position: fixed;
  top: 15px;
  left: 10px;
  font-size: 24px;
  background: none;
  border: none;
  cursor: pointer;
  color: black;
  z-index: 1000;
}

/* Fondo oscuro al abrir el menú */
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
}

/* Contenedor del menú */
.menu-container {
  position: absolute;
  top: 50px; /* Mantiene el menú debajo del icono */
  left: 15px;
  background: white;
  width: 200px;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  text-align: left;
  z-index: 1101;
}

h2 {
  margin-bottom: 15px;
  font-size: 20px;
}

ul {
  list-style: none;
  padding: 0;
}

li {
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid #ddd;
}

li:hover {
  background: #f0f0f0;
}
</style>
