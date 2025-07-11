<template>
  <div class="user-manager">
    <div class="user-list-container">
      <div v-if="isLoading" class="blocker-overlay">
        <div class="spinner"></div>
      </div>

      <ul class="user-list">
        <li v-if="users.length === 0" class="no-users">No hay usuarios.</li>
        <li
          v-for="user in users"
          :key="user._id"
          class="user-item"
          @click="handleRowClick($event, user)"
        >
          <span class="user-name"
          :class="{ 'blocked-user': user.blocked }">
            <strong>{{ user.username }}</strong>
          </span>
          <div class="user-roles">
            <span
              v-for="role in user.role"
              :key="role"
              class="role-chip"
              :style="getRoleStyle(role)"
            >
              {{ role }}
            </span>
          </div>
          <Button
            icon="pi pi-trash"
            class="p-button-sm p-button-text delete-btn"
            :class="{ 'btn-disabled': user.username === authStore.user }"
            @click="user.username !== authStore.user && confirmDeleteUser(user._id)"
            aria-label="Eliminar"
          />
        </li>
      </ul>
    </div>

    <!-- Modal de configuración -->
    <teleport to="#modals">
      <div v-if="userModalVisible" class="overlay" @click.self="closeModal">
        <div class="modal-container">
          <!-- Spinner interno del modal -->
          <div v-if="isLoading" class="blocker-overlay">
            <div class="spinner"></div>
          </div>
          
          <h3>👤 Usuario:
            <strong :class="{ 'blocked-user': selectedUser?.blocked }">
              {{ selectedUser?.username }}
            </strong>
          </h3>

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
                v-model="selectedUser.role"
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
                      v-if="element !== 'user'"
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

          <p v-if="isSelf" class="self-warning">
            🔒 No puedes editar tu propio rol.
          </p>

          <div class="modal-buttons">
            <button class="modal-button btn-success" @click="saveUserChanges" :disabled="isSelf">Guardar</button>
            <button
              class="modal-button logout-btn"
              @click="invalidateSession"
              :disabled="isSelf"
            >
              <i class="pi pi-sign-out"></i> Logout
            </button>

            <button
              class="modal-button block-btn"
              @click="toggleBlockUser"
              :disabled="isSelf"
            >
              <i class="pi pi-ban"></i>
              {{ selectedUser.blocked ? 'Unblock' : 'Block' }}
            </button>
            <button class="modal-button" @click="closeModal">Cerrar</button>
          </div>
          
        </div>
      </div>  
    </teleport>
  </div>
</template>

<script setup>
import Button from 'primevue/button';
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '@/store/mainStore';
import { getUsersList, getRoles, updateUserRoles, deleteUser, invalidateUser, blockUser } from '@/api/auth';
import draggable from 'vuedraggable';

const users = ref([]);
const allRoles = ref([]);
const userModalVisible = ref(false);
const selectedUser = ref(null);
const isLoading = ref(true);

const authStore = useAuthStore();
//const sessionStore = useSessionStore();

const isSelf = computed(() => {
  return selectedUser.value?.username === authStore.user;
});

const filteredRoles = computed(() =>
  allRoles.value.filter(r => !['system', 's-user'].includes(r.name))
);

const availableRoles = computed(() => {
  return filteredRoles.value.filter(r => !selectedUser.value?.role.includes(r.name));
});

function getRoleStyle(roleNameOrObj) {
  const roleName = typeof roleNameOrObj === 'string' ? roleNameOrObj : roleNameOrObj.name;
  const role = allRoles.value.find(r => r.name === roleName);
  return {
    backgroundColor: role?.color || '#007bff',
    color: '#fff'
  };
}

function removeAssignedRole(index) {
  if (selectedUser.value.role[index] === 'user') return;
  selectedUser.value.role.splice(index, 1);
}

function closeModal() {
  userModalVisible.value = false;
  selectedUser.value = null;
}

async function fetchUsers() {
  try {
    const fetched = await getUsersList();
    users.value = fetched
      .filter(user => !user.isSystem && !(user.role || []).includes('s-user'))
      .map(user => ({
        ...user,
        role: Array.isArray(user.role)
          ? user.role
          : user.role ? [user.role] : []
      }));
  } catch (e) {
    console.error('Error al obtener usuarios', e);
  }
}

async function fetchRoles() {
  try {
    allRoles.value = await getRoles();
  } catch (e) {
    console.error('Error al obtener roles', e);
  }
}

function editUser(user) {
  selectedUser.value = {
    ...user,
    role: Array.isArray(user.role) ? [...user.role] : user.role ? [user.role] : []
  };
  userModalVisible.value = true;
}

async function saveUserChanges() {
  if (!selectedUser.value) return;

  const rolesToSave = selectedUser.value.role.filter(r =>
    !['user', 's-user', 'system'].includes(r)
  );

  try {
    isLoading.value = true;
    await updateUserRoles(selectedUser.value.username, rolesToSave);
    await fetchUsers();
    isLoading.value = false;
    closeModal();
  } catch (e) {
    console.error('No se pudieron actualizar los roles', e);
    alert('Error al actualizar roles: ' + (e.response?.data?.message || e.message));
  }
}

function handleRowClick(event, user) {
  const el = event.target;

  // Evitar abrir modal si el clic provino de un botón o su interior
  if (el.closest('button') || el.closest('.p-button') || el.closest('.delete-btn')) {
    return;
  }

  editUser(user);
}

async function confirmDeleteUser(id) {
  if (!id) return;

  if (!window.confirm('¿Estás seguro de eliminar este usuario?')) return;

  try {
    isLoading.value = true;
    await deleteUser(id);
    await fetchUsers();
    isLoading.value = false;
    closeModal();
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    alert('No se pudo eliminar el usuario: ' + (error.response?.data?.message || error.message));
  }
}

async function invalidateSession() {
  if (!confirm(`¿Cerrar sesión del usuario ${selectedUser.value.username}?`)) return;

  try {
    isLoading.value = true;
    await invalidateUser(selectedUser.value.username);
    alert(`Sesión de ${selectedUser.value.username} invalidada`);
  } catch (e) {
    console.error('Error al invalidar sesión', e);
    alert('No se pudo invalidar la sesión');
  } finally {
    isLoading.value = false;
  }
}

async function toggleBlockUser() {
  if (!selectedUser.value) return;
  const action = selectedUser.value.blocked ? 'desbloquear' : 'bloquear';

  if (!confirm(`¿Deseas ${action} al usuario ${selectedUser.value.username}?`)) return;

  try {
    isLoading.value = true;
    await blockUser(selectedUser.value.username, !selectedUser.value.blocked);
    await fetchUsers();
    selectedUser.value.blocked = !selectedUser.value.blocked;
  } catch (err) {
    console.error(`Error al ${action} usuario`, err);
    alert(`No se pudo ${action} al usuario`);
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  isLoading.value = true;

  try {
    await Promise.all([
      fetchUsers(),
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
  max-width: 500px;
  width: 100%;
}

.modal-container h3 {
  margin-top: 0;
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

.modal-button:disabled,
.modal-button[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}

.logout-btn {
  background-color: #bcba00;
  color: white;
}

.logout-btn:hover {
  background-color: #a8a600;
}

.block-btn {
  background-color: #d32f2f;
  color: white;
}

.block-btn:hover {
  background-color: #b71c1c;
}

.modal-button.btn-success {
  background-color: #28a745;
}

.modal-button.btn-success:hover {
  background-color: #218838;
}

.user-list {
  max-height: 190px;
  overflow-y: auto;
  padding: 0;
}

.user-list li {
  padding: 10px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
}

.user-list li:hover {
  background-color: #f5f5f5;
}

.user-list .user-item:nth-child(odd) {
  background-color: #f9f9f9; /* Color para filas impares */
}

.user-list .user-item:nth-child(even) {
  background-color: #ffffff; /* Color para filas pares */
}

.user-item:hover {
  background-color: #e6f7ff; /* Color al pasar el ratón */
}

.no-users {
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 10px;
}

.btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.blocked-user {
  color: #c0392b; /* rojo oscuro */
}

.user-roles {
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

.delete-btn {
  padding: 4px 8px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  background-color: #e53935;
  color: white;
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

.self-warning {
  color: #b22222;
  margin-top: 1rem;
}

/* Spinner overlay */
.user-list-container {
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
