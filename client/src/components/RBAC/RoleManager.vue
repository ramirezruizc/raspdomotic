<template>
  <div class="role-manager">
    <div class="role-list-container">
      <div v-if="isLoading" class="blocker-overlay">
        <div class="spinner"></div>
      </div>
      <ul class="role-list">
        <li
          v-for="role in roles"
          :key="role._id"
          class="role-item"
          @click="!isReserved(role.name) && editRole(role)"
          :class="{ reserved: isReserved(role.name) }"
        >
          <div
            class="role-chip"
            :style="{ backgroundColor: role.color || '#007bff', color: '#fff' }"
          >
            {{ role.name }}
          </div>
          <span class="role-desc">{{ role.description }}</span>
          <Button
            icon="pi pi-trash"
            class="p-button-sm p-button-text delete-btn"
            @click.stop="deleteRole(role._id, role.name)"
            :disabled="isReserved(role.name)"
            aria-label="Eliminar"
          />
        </li>
      </ul>

      <button class="modal-button btn-success" @click="openModal">Crear nuevo rol</button>
    </div>

    <!-- Modal -->
    <teleport to="#modals">
      <div v-if="showModal" class="overlay" @click.self="closeModal">
        <div class="modal-container">
          <!-- Spinner interno del modal -->
          <div v-if="isLoading" class="blocker-overlay">
            <div class="spinner"></div>
          </div>

          <h3>{{ form._id ? 'Editar rol' : 'Crear nuevo rol' }}</h3>

          <form @submit.prevent="saveRole">
            <div class="control-group">
              <input v-model="form.name" placeholder="Nombre del rol" :disabled="!!form._id" required />
            </div>
            <div class="control-group">
              <input v-model="form.description" placeholder="Descripción" required />
            </div>
            <div class="control-group">
              <label>Color del rol:</label>
              <div class="color-palette">
                <span
                  v-for="c in predefinedColors"
                  :key="c"
                  :style="{ backgroundColor: c, border: form.color === c ? '2px solid black' : '1px solid #ccc' }"
                  class="color-dot"
                  @click="form.color = c"
                ></span>
              </div>
            </div>

            <div class="modal-buttons">
              <button type="submit" class="modal-button btn-success">Guardar</button>
              <button class="modal-button" @click="closeModal">Cerrar</button>
            </div>
          </form>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import Button from 'primevue/button';
import { ref, onMounted } from 'vue';
import { getRoles, createRole, updateRole, removeRole } from '@/api/auth';

const roles = ref([]);
const form = ref({ name: '', description: '', color: '#007bff', _id: null });
const showModal = ref(false);
const predefinedColors = ['#007bff', '#28a745', '#ffc107', '#17a2b8', '#dc3545', '#6f42c1'];
const isLoading = ref(true);

async function fetchRoles() {
  const all = await getRoles();
  roles.value = all.filter(r => !['system', 's-user'].includes(r.name));
}

function isReserved(name) {
  return ['admin', 'user', 'dashboard'].includes(name);
}

function editRole(role) {
  if (isReserved(role.name)) return;
  form.value = { ...role, color: role.color || '#007bff' };
  showModal.value = true;
}

function openModal() {
  form.value = { name: '', description: '', color: '#007bff', _id: null };
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  form.value = { name: '', description: '', color: '#007bff', _id: null };
}

async function saveRole() {
  const name = form.value.name.trim().toLowerCase();
  if (['system', 's-user'].includes(name)) {
    alert('Este nombre de rol está reservado y no se puede usar.');
    return;
  }

  isLoading.value = true;

  if (form.value._id) {
    await updateRole(form.value._id, form.value);
  } else {
    await createRole(form.value);
  }

  await fetchRoles();
  isLoading.value = false;
  closeModal();
}

async function deleteRole(id, roleName) {
  if (isReserved(roleName)) {
    alert('Este rol no se puede eliminar.');
    return;
  }

  isLoading.value = true;

  if (confirm('¿Eliminar este rol?')) {
    await removeRole(id);
    await fetchRoles();
  }
  
  isLoading.value = false;
}

onMounted(async () => {
  isLoading.value = true;

  try {
    await Promise.all([
      fetchRoles()
    ]);
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
  max-width: 400px;
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

.control-group {
  margin-bottom: 10px;
}

.control-group input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.color-palette {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.color-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  border: 1px solid #ccc;
}

.color-dot:hover {
  border-color: #000;
}

.role-list .role-item:nth-child(odd) {
  background-color: #f9f9f9; /* Color para filas impares */
}

.role-list .role-item:nth-child(even) {
  background-color: #ffffff; /* Color para filas pares */
}

.role-item:hover {
  background-color: #e6f7ff; /* Color al pasar el ratón */
}

.role-list {
  max-height: 190px;
  overflow-y: auto;
  padding: 0;
}

.role-list li {
  padding: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  cursor: pointer;
}

.role-list li:hover {
  background-color: #f5f5f5;
}

.role-list li.reserved {
  cursor: default;
}

.role-chip {
  background-color: #007bff;
  color: white;
  border-radius: 8px;
  padding: 2px 6px;
  font-size: 0.8rem;
}

.role-name {
  font-weight: bold;
}

.role-desc {
  color: #666;
  font-size: 0.85rem;
  margin-left: 8px;
  flex: 1;
}

.delete-btn {
  padding: 4px 8px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  background-color: #e53935;
  color: white;
}

.delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Spinner overlay */
.role-list-container {
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
