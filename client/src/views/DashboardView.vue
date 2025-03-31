<template>
  <div class="dashboard">
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
  </div>
</template>

<script>
import api from '../api';
import componentMap from '../components/DeviceMapper';
import draggable from 'vuedraggable';

export default {
  components: { 
    draggable
  },

  data() {
    return {
      devices: [],  // Lista de dispositivos obtenidos desde Node-RED
      groupedDevices: []
    };
  },

  async mounted() {
    console.log("Componentes mapeados:", componentMap);

    await this.loadDevices();
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
  }
};
</script>

/* Importa los estilos de DashboardView */
<style src="@/assets/css/DashboardView.css" scoped></style> 