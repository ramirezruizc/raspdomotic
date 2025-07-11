<template>
  <div class="device-manager">
    <div class="device-list-container">
      <div v-if="isLoading" class="blocker-overlay">
        <div class="spinner"></div>
      </div>
      <ul class="device-list">
        <li v-if="devices.length === 0" class="no-devices">No hay dipositivos.</li>
        <li
          v-for="device in devices"
          :key="device.id"
          class="device-item"
          @click="editDevice(device)"
        >
          <span 
            class="restriction-icon"
            :title="device.restricted ? 'Acceso restringido' : 'Acceso libre'"
          >
            {{ device.restricted ? '🔐' : '🟢' }}
          </span>
          <span class="device-name">{{ device.name }}</span>
          <div class="device-roles">
            <span
              v-for="role in device.accessRoles"
              :key="role"
              class="role-chip"
              :style="getRoleStyle(role)"
            >
              {{ role }}
            </span>
          </div>
          <span class="device-type">({{ device.type }})</span>
        </li>
      </ul>

      <button class="modal-button btn-success" @click="handleRefresh">
        🔄 Refresh desde Node-RED
      </button>
    </div>

    <!-- Modal -->
    <teleport to="#modals">
      <div v-if="deviceModalVisible" class="overlay" @click.self="closeModal">
        <div class="modal-container">
          <!-- Spinner interno del modal -->
          <div v-if="isLoading" class="blocker-overlay">
            <div class="spinner"></div>
          </div>

          <h3>🔌 Dispositivo: <strong>{{ selectedDevice?.name }}</strong></h3>
          <label>
            <input type="checkbox" v-model="selectedDevice.restricted" /> Restringir acceso
          </label>
          <div class="drag-container">
            <div class="drag-column">
              <h4>Roles disponibles</h4>
              <draggable
                :list="availableRoles"
                class="drag-zone"
                :group="{ name: 'roles', pull: 'clone', put: false }"
                :clone="role => role.name"
                item-key="name"
              >
                <template #item="{ element }">
                  <button
                    class="chip-btn"
                    :style="{ backgroundColor: element.color || '#007bff' }"
                  >
                    {{ element.name }}
                  </button>               
                </template>
              </draggable>
            </div>

            <div class="drag-column">
              <h4>Roles asignados</h4>
              <draggable
                v-model="selectedDevice.accessRoles"
                class="drag-zone"
                :group="{ name: 'roles', pull: false, put: true }"
                item-key="name"
              >
                <template #item="{ element, index }">
                  <div 
                    class="chip-btn"
                    :style="getRoleStyle(element)"
                  >
                    {{ element }}
                    <span
                      class="remove-chip"
                      @click.stop="removeAssignedRole(index)"
                    >
                      ×
                    </span>
                  </div>
                </template>
              </draggable>
            </div>
          </div>

          <div class="modal-buttons">
            <button class="modal-button btn-success" @click="saveDeviceAccess">Guardar</button>
            <button class="modal-button" @click="closeModal">Cerrar</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { getRoles } from '@/api/auth';
import { getDeviceAccess, updateDeviceAccess, refreshDevicesFromNodeRed } from '@/api/devices';
import draggable from 'vuedraggable';

const devices = ref([]);
const allRoles = ref([]);
const deviceModalVisible = ref(false);
const selectedDevice = ref(null);
const isLoading = ref(true);

const filteredRoles = computed(() =>
  allRoles.value.filter(r => !['admin', 'user', 's-user', 'system', 'dashboard'].includes(r.name))
);

const availableRoles = computed(() =>
  filteredRoles.value.filter(r => !selectedDevice.value?.accessRoles?.includes(r.name))
);

function getRoleStyle(roleNameOrObj) {
  const roleName = typeof roleNameOrObj === 'string' ? roleNameOrObj : roleNameOrObj.name;
  const role = allRoles.value.find(r => r.name === roleName);
  return {
    backgroundColor: role?.color || '#007bff',
    color: '#fff'
  };
}

async function fetchData() {
  /*
  // Obtener dispositivos desde Node-RED
  const nodeRes = await fetchDevicesFromNodeRed();
  const nodeDevices = nodeRes.devices;

  // Obtener asignaciones de BBDD
  const dbAccess = await getDeviceAccess();

  // Fusionar info
  devices.value = nodeDevices.map(nd => {
    const dbEntry = dbAccess.devices.find(d => d.id === nd.id);

    return {
      ...nd,
      restricted: dbEntry?.restricted ?? true,
      accessRoles: dbEntry?.accessRoles || []
    };
  });
  */

  //Dispositivos
  const dbAccess = await getDeviceAccess();
  devices.value = dbAccess.devices;

  // Roles
  allRoles.value = await getRoles();
}

function editDevice(device) {
  selectedDevice.value = {
    ...device,
    accessRoles: Array.isArray(device.accessRoles) ? [...device.accessRoles] : []
  };
  deviceModalVisible.value = true;
}

function closeModal() {
  deviceModalVisible.value = false;
  selectedDevice.value = null;
}

function removeAssignedRole(index) {
  selectedDevice.value.accessRoles.splice(index, 1);
}

async function saveDeviceAccess() {
  if (!selectedDevice.value) return;

  isLoading.value = true;

  try {
    await updateDeviceAccess(selectedDevice.value.id, {
      restricted: selectedDevice.value.restricted,
      accessRoles: selectedDevice.value.accessRoles,
      name: selectedDevice.value.name
    });

    await fetchData();
  } catch (e) {
    console.error('Error guardando acceso del dispositivo:', e);
    alert('Error al guardar acceso: ' + (e.response?.data?.message || e.message));
  } finally {
    isLoading.value = false;
    closeModal();
  }
}

async function handleRefresh() {
  isLoading.value = true;

  try {
    //await refreshDevicesFromNodeRed();
    await fetchData();
  } catch (e) {
    console.error('Error en la recarga de dispositivos:', e);
    alert('Error al recargar los dispositivos desde Node-RED');
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  isLoading.value = true;

  try {
    // Refresca dispositivos en backend primero, desde fuente de verdad (Node-RED)
    await refreshDevicesFromNodeRed();
    await fetchData();
  } catch (err) {
    console.error("❌ Error en carga inicial:", err);
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
.overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  position: relative;
  background: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 500px;
  width: 100%;
}

.modal-container h3 {
  margin: 0;
}

.modal-buttons {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.modal-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background-color: #007bff;
  color: white;
}

.modal-button:hover {
  background-color: #0056b3;
}

.modal-button.btn-success {
  background-color: #28a745;
}

.modal-button.btn-success:hover {
  background-color: #218838;
}

.device-list .device-item:nth-child(odd) {
  background-color: #f9f9f9; /* Color para filas impares */
}

.device-list .device-item:nth-child(even) {
  background-color: #ffffff; /* Color para filas pares */
}

.device-item:hover {
  background-color: #e6f7ff; /* Color al pasar el ratón */
}

.no-devices {
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 10px;
}

.device-list {
  max-height: 190px;
  overflow-y: auto;
  padding: 0;
}

.device-item {
  padding: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  cursor: pointer;
}

.device-item:hover {
  background-color: #f5f5f5;
}

.restriction-icon {
  margin-left: 6px;
  font-size: 1rem;
}

.device-name {
  font-weight: bold;
}

.device-type {
  font-size: 0.85rem;
  color: #666;
  margin-left: 8px;
}

.device-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.role-chip {
  background-color: #007bff;
  color: white;
  border-radius: 8px;
  padding: 2px 6px;
  font-size: 0.8rem;
}

.drag-container {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.drag-column {
  flex: 1 1 200px; /* crece de forma proporcional, ancho base 200px */
  max-width: 250px; /* para evitar que se hagan enormes */
}

.drag-column h4 {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0;
  padding: 2px 0;
  font-size: 0.95rem;
  text-align: center;
}

.drag-zone {
  min-height: 100px;
  padding: 8px;
  border: 1px dashed #ccc;
  border-radius: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chip-btn {
  position: relative;
  background-color: #007bff;
  color: white;
  border-radius: 12px;
  padding: 4px 10px;
  font-size: 0.9rem;
  display: inline-block;
  margin: 4px;
}

.remove-chip {
  position: absolute;
  top: -6px;
  right: -6px;
  background-color: red;
  color: white;
  width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
}

/* Spinner overlay */
.device-list-container {
  position: relative;
}

.blocker-overlay {
  position: absolute;
  top: 0;
  left: 0;
  background: rgba(255, 255, 255, 0.85);
  width: 100%;
  height: 100%;
  z-index: 999;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 12px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(0, 0, 0, 0.2);
  border-top: 3px solid #007bff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
