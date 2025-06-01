<template>
  <div v-if="isRoleReady" class="configuration">
    <h1>⚙️ Configuración</h1>

    <div class="configuration-wrapper">
      <!-- Sección cambio de contraseña -->
      <section class="card password-section">
        <h2>🔐 Cambiar Contraseña</h2>
        <form @submit.prevent="handlePasswordChange">
          <input v-model="currentPassword" type="password" placeholder="Contraseña actual" required />
          <input v-model="newPassword" type="password" placeholder="Nueva contraseña" required />
          <input v-model="confirmPassword" type="password" placeholder="Repetir nueva contraseña" required />
          <button type="submit">Actualizar</button>
        </form>
        <p v-if="passwordMessage">{{ passwordMessage }}</p>
      </section>

      <!-- Sección exclusiva para admins -->
      <section v-if="isAdmin" class="card admin-section">
        <h2>👷🏻‍♀️ Panel de Administración</h2>

      <!-- Activar/Desactivar registro de usuarios -->
      <div class="toggle-row">
        <label class="switch-label">
          <input type="checkbox" v-model="allowRegistration" @change="handleConfigUpdate" />
          <span class="slider"></span>
          <span class="toggle-text">Permitir nuevos registros de usuario</span>
        </label>
      </div>

      <!-- Modo mantenimiento -->
      <div class="toggle-row">
        <label class="switch-label">
          <input type="checkbox" v-model="maintenanceMode" @change="handleConfigUpdate" />
          <span class="slider"></span>
          <span class="toggle-text">Activar modo mantenimiento</span>
        </label>
      </div>

        <!-- Administración de Usuarios -->
        <section class="card admin-user-section">
          <h3>👥 Usuarios del sistema</h3>
          <div class="user-list">
            <ul>
              <li v-if="users.length === 0" class="no-users">No hay usuarios.</li>
              <li v-else v-for="user in users" :key="user.id" class="user-item" @click="selectUser(user)">
                <span>{{ user.username }}</span>
                <span class="role-label" v-if="user.role && user.role.length">
                  {{ user.role.join(', ') }}
                </span>
              </li>
            </ul>
          </div>
        </section>

        <!-- Modal para editar usuario -->
        <Dialog v-model:visible="userModalVisible" 
          :modal="true" 
          header="👤 Detalles del Usuario" 
          :closable="true"
          >
          <div v-if="selectedUser">
            <p><strong>Nombre:</strong> {{ selectedUser.username }}</p>
            <p><strong>Rol actual:</strong> {{ selectedUser.role.join(', ') }}</p>

            <div v-if="!isSelf" class="admin-toggle">
              <label class="switch-label">
                <input type="checkbox" v-model="isAdminChecked" />
                <span class="slider"></span>
                <span class="toggle-text">Administrador</span>
              </label>
            </div>

            <p v-if="isSelf" class="self-warning">
              🔒 No puedes editar tu propio rol.
            </p>

            <div class="modal-actions">
              <button
                @click="saveUserChanges"
                :disabled="isSelf"
              >
                Guardar
              </button>

              <button 
                v-if="!isSelf" 
                class="delete-user-btn"
                @click="confirmDeleteUser"
              >
                Eliminar Usuario
              </button>
            </div>
          </div>
        </Dialog>

        <!-- Sección especial para superusuarios -->
        <div v-if="isSUser" class="danger-zone">
          <h3>⚠️ Eliminar Base de Datos</h3>
          <p>¡Este paso eliminará <strong>permanentemente</strong> toda la base de datos!</p>
          <button @click="confirmDeleteDB">ELIMINAR BASE DE DATOS</button>
        </div>
      </section>
    </div>
  </div>

  <!-- Spinner mientras se espera el rol -->
  <div v-else class="loading-role">
    <p>Cargando configuración...</p>
    <div class="spinner"></div>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, computed } from 'vue';
import { getSystemConfig, updateSystemConfig } from '@/api/systemConfig';
import { changePassword, deleteDatabase, getUsersList, updateUserRoles, deleteUser } from '@/api/auth';
import { useSessionStore, useAuthStore } from '@/store/mainStore';
import Dialog from 'primevue/dialog';

export default defineComponent({
  components: { Dialog },

  setup() {
    const authStore = useAuthStore();
    const sessionStore = useSessionStore();

    const isAdmin = computed(() => authStore.role?.includes('admin') ?? false);
    const isSUser = computed(() => authStore.role?.includes('s-user') ?? false);
    const isRoleReady = computed(() => authStore.role !== null);

    // Cambio de contraseña
    const currentPassword = ref('');
    const newPassword = ref('');
    const confirmPassword = ref('');
    const passwordMessage = ref('');

    const isSelf = computed(() => {
      return selectedUser.value?.username === authStore.user;
    });

    async function handlePasswordChange() {
      if (newPassword.value !== confirmPassword.value) {
        passwordMessage.value = '❌ Las contraseñas no coinciden.';
        return;
      }

      try {
        await changePassword({
          currentPassword: currentPassword.value,
          newPassword: newPassword.value,
        });
        passwordMessage.value = '✅ Contraseña actualizada con éxito.';
        currentPassword.value = newPassword.value = confirmPassword.value = '';
      } catch (err) {
        passwordMessage.value =
          '❌ Error al cambiar la contraseña: ' +
          (err.response?.data?.message || err.message);
      }
    }

    // Configuración general
    const allowRegistration = ref(false);
    const maintenanceMode = ref(false);

    async function checkSystemConfig() {
      try {
        sessionStore.setLoading(true);
        const res = await getSystemConfig();
        allowRegistration.value = res.allowRegistration;
        maintenanceMode.value = res.maintenanceMode;
        sessionStore.setLoading(false);
      } catch (e) {
        console.error('No se pudo obtener la configuración del sistema', e);
      }
    }

    async function handleConfigUpdate() {
      try {
        sessionStore.setLoading(true);
        await updateSystemConfig({
          allowRegistration: allowRegistration.value,
          maintenanceMode: maintenanceMode.value,
        });
        sessionStore.setLoading(false);
      } catch (e) {
        console.error('Error actualizando configuración del sistema:', e);
      }
    }

    // Administración de usuarios
    const users = ref([]);
    const selectedUser = ref(null);
    const userModalVisible = ref(false);
    const isAdminChecked = ref(false);

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

    function selectUser(user) {
      selectedUser.value = { ...user };
      isAdminChecked.value = user.role?.includes('admin') ?? false;
      userModalVisible.value = true;
    }

    async function saveUserChanges() {
      if (!selectedUser.value) return;

      const updatedRoles = isAdminChecked.value
        ? [...new Set([...selectedUser.value.role, 'admin'])]
        : selectedUser.value.role.filter(role => role !== 'admin');

      try {
        await updateUserRoles(selectedUser.value.username, updatedRoles);
        await fetchUsers();
        userModalVisible.value = false;
      } catch (e) {
        console.error('No se pudieron actualizar los roles', e);
        alert('Error al actualizar roles: ' + (e.response?.data?.message || e.message));
      }
    }

    async function confirmDeleteUser() {
      if (!selectedUser.value) return;

      const confirm1 = window.confirm(`¿Estás seguro de eliminar al usuario "${selectedUser.value.username}"?`);
      if (!confirm1) return;

      try {
        await deleteUser(selectedUser.value.username);
        await fetchUsers(); // refrescamos la lista de usuarios
        userModalVisible.value = false;
      } catch (error) {
        console.error('Error eliminando usuario:', error);
        alert('No se pudo eliminar el usuario: ' + (error.response?.data?.message || error.message));
      }
    }

    // Gestión de BBDD
    async function confirmDeleteDB() {
      const confirm1 = window.confirm('¿Estás absolutamente seguro? Esto eliminará toda la base de datos.');
      if (!confirm1) return;

      const confirm2 = window.confirm('¡Advertencia! Esto eliminará *permanentemente* todos los datos. ¿Estás seguro?');
      if (!confirm2) return;

      try {
        await deleteDatabase();
        alert('Base de datos eliminada correctamente');
        await authStore.logout();
      } catch (err) {
        console.error('Error al eliminar la base de datos:', err);
        alert('No se pudo eliminar la base de datos');
      }
    }

    onMounted(() => {
      if (isAdmin.value) {
        checkSystemConfig();
        fetchUsers();
      }
    });

    return {
      // Roles
      isAdmin,
      isSUser,
      isRoleReady,

      // Contraseña
      currentPassword,
      newPassword,
      confirmPassword,
      passwordMessage,
      handlePasswordChange,

      // Config
      allowRegistration,
      maintenanceMode,
      handleConfigUpdate,

      // Usuarios
      isSelf,
      users,
      selectedUser,
      userModalVisible,
      isAdminChecked,
      selectUser,
      saveUserChanges,
      confirmDeleteUser,

      // BBDD
      confirmDeleteDB,
    };
  },
});
</script>

<style src="@/assets/css/ConfigurationView.css" scoped></style>