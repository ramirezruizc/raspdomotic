<template>
  <div class="home-control" v-if="isLoaded">
    <h1>🧙🏼‍♂️ Home Control</h1>

    <!-- Contenedor de categorías draggable -->
    <div v-if="groupedDevices.length > 0">
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
                    <div class="device-type-icon">
                      <i :class="getIcon(device)"></i>
                    </div>
                    <span class="drag-handle"><i class="pi pi-ellipsis-v"></i></span>
                    <div class="device-content">
                      <component
                        :is="getComponent(device.type)"
                        v-if="getComponent(device.type)"
                        :key="device.id"
                        :deviceId="device.deviceId"
                        :deviceName="device.deviceName"
                        />
                    </div>
                  </div>
                </template>
              </draggable>
            </div>
          </template>
        </draggable>
      </div>
    </div>
    <div v-else class="no-data-overlay">
      <span class="info-icon">ℹ️</span>
      <p>No hay dispositivos disponibles para su usuario.</p>
    </div>
  </div>
</template>

<script>
import { getLayout, saveLayout } from '../api/auth';
import { getDevices } from '../api/devices';
import componentMap from '../components/devices/DeviceMapper';
import draggable from 'vuedraggable';
import { useSessionStore } from '../store/mainStore';

export default {
  components: { draggable },

  data() {
    return {
      groupedDevices: [],
      isLoaded: false
    };
  },

  async mounted() {
    console.log("Componentes mapeados:", componentMap);
    await this.syncLayout(); // Cargar y sincronizar dispositivos
  },

  methods: {
    async syncLayout() {
      const sessionStore = useSessionStore();

      try {
        sessionStore.setLoading(true);

        console.log("🚀 Iniciando sincronización del layout...");

        // Obtener layout guardado
        const layoutResponse = await getLayout();
        console.log("Backend responde para layout:",layoutResponse);
        //const savedLayout = layoutResponse.data.layout || [];
        const savedLayout = layoutResponse.data.layout || [];
        console.log("🗄 Layout guardado en BBDD:", JSON.stringify(savedLayout, null, 2));

        // Obtener dispositivos actuales desde el sistema
        const devicesResponse = await getDevices();
        //const systemDevices = devicesResponse.data.devices || [];
        const systemDevices = devicesResponse.devices || [];
        console.log("💾 Dispositivos actuales en el sistema:", JSON.stringify(systemDevices, null, 2));

        // Generar IDs únicos para los nuevos dispositivos
        let tempIdCounter = 0;

        // Crear un mapa para contar instancias de cada type-category
        const devicePool = {};
        systemDevices.forEach(dev => {
          const key = `${dev.category}-${dev.type}`;
          if (!devicePool[key]) devicePool[key] = [];
          devicePool[key].push({
            ...dev,
            originalId: `temp-id-${tempIdCounter++}` // ID provisional
          });
        });

        const usedIds = new Set();
        const layoutGrouped = [];

        for (const savedCategory of savedLayout) {
          const validDevices = [];

          for (const savedDevice of savedCategory.devices) {
            const key = `${savedCategory.category}-${savedDevice.type}`;
            if (devicePool[key] && devicePool[key].length > 0) {
              const match = devicePool[key].shift();
              validDevices.push({
                id: savedDevice.id, // Usamos el ID antiguo
                type: savedDevice.type,
                deviceId: match.id, // ID real (ej: ESPURNA-SWITCH1)
                deviceName: match.name
              });
              usedIds.add(match.originalId); // Marcamos como usado
            }
          }

          if (validDevices.length > 0) {
            layoutGrouped.push({
              category: savedCategory.category,
              devices: validDevices
            });
          }
        }

        // Agregar dispositivos nuevos que no estaban en el layout guardado
        for (const [key, devices] of Object.entries(devicePool)) {
          console.log("Categoría procesada:", key);

          for (const dev of devices) {
            if (usedIds.has(dev.originalId)) continue; // Ya fue usado

            // Separar por categoría
            let categoryGroup = layoutGrouped.find(g => g.category === dev.category);
            if (!categoryGroup) {
              categoryGroup = { category: dev.category, devices: [] };
              layoutGrouped.push(categoryGroup);
            }

            // Generar nuevo ID único
            const newId = `temp-id-${tempIdCounter++}`;
            categoryGroup.devices.push({ id: newId, type: dev.type, deviceId: dev.id, deviceName: dev.name });
            usedIds.add(dev.originalId);
          }
        }

        console.log("📌 Layout ajustado final (orden y dispositivos):", JSON.stringify(layoutGrouped, null, 2));

        const layoutChanged = JSON.stringify(layoutGrouped) !== JSON.stringify(savedLayout);

        if (layoutChanged) {
          console.log("⚡️ Layout cambiado, actualizando en base de datos...");
          await saveLayout(layoutGrouped);
        } else {
          console.log("✅ Layout ya estaba sincronizado, sin cambios.");
        }

        this.groupedDevices = layoutGrouped;
      } catch (error) {
        console.error("❌ Error al sincronizar el layout:", error);
      } finally {
        this.isLoaded = true;
        sessionStore.setLoading(false); // Finaliza la carga global
        console.log("🎯 Sincronización terminada.");
      }
    },

    getComponent(tipo) {
      return componentMap[tipo] || null;
    },

    getIcon(device) {
      if (device.type === 'InfoDevice') {
        // Heuristica basada en deviceId (cuidado con id, que es del layout) y name del device para deducir icono mas apropiado en InfoDevice
        console.log('Icon heuristics →', {
          type: device.type,
          deviceId: device.deviceId,
          deviceName: device.deviceName
        });

        const text = (device.deviceId || device.deviceName || '').toLowerCase();

        if (text.includes('temp') || text.includes('temperatura') ||
          text.includes('hum')  || text.includes('humedad') ||
          text.includes('aht10')|| text.includes('dht22'))
        {
            return 'pi pi-gauge';
        }

        return 'pi pi-shield';
      }

      switch (device.type) {
        case 'BulbRGBDevice': return 'pi pi-lightbulb';
        case 'SwitchDevice': return 'pi pi-power-off';
        case 'AirConditioningDevice': return 'pi pi-sun';
        case 'AlarmDevice': return 'pi pi-bell';
        case 'CameraDevice': return 'pi pi-camera';
        default: return '';
      }
    },

    checkMove(event) {
      return event.to === event.from; // Evita mover entre categorías distintas
    },

    async saveOrder() {
      try {
        await saveLayout(this.groupedDevices);
        console.log("Esquema de usuario guardado correctamente");
      } catch (error) {
        console.error("Error al guardar el esquema:", error);
      }
    }
  }
};
</script>

//Importa los estilos de HomeControlView
<style src="@/assets/css/HomeControlView.css" scoped></style>