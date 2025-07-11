<template>
  <div v-if="isRoleReady" class="configuration">
    <h1>⚙️ Configuración</h1>

    <div class="configuration-wrapper">

      <!-- Sección cambio de contraseña -->
      <section class="card password-section">
        <div class="password-header" @click="togglePasswordSection">
          <i :class="['pi', passwordSectionVisible.value ? 'pi-chevron-down' : 'pi-chevron-right']"></i>
          <h2>🔐 Cambiar Contraseña</h2>
        </div>

        <div v-if="isLoading" class="blocker-overlay">
          <div class="spinner"></div>
        </div>
        <transition name="fade">
          <form v-show="passwordSectionVisible" @submit.prevent="handlePasswordChange" class="password-form">
            <input v-model="currentPassword" type="password" placeholder="Contraseña actual" required />
            <input v-model="newPassword" type="password" placeholder="Nueva contraseña" required />
            <input v-model="confirmPassword" type="password" placeholder="Repetir nueva contraseña" required />

            <button type="submit">
              <span>Actualizar</span>
            </button>

            <p v-if="passwordMessage">{{ passwordMessage }}</p>
          </form>
        </transition>
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
          <h3>👮🏾‍♂️ Control de acceso</h3>

          <div class="tabs">
            <button 
              v-for="tab in tabs" 
              :key="tab" 
              :class="{ active: activeTab === tab }" 
              @click="activeTab = tab"
            >
              {{ tab }}
            </button>
          </div>

          <div class="tab-content">
            <div v-if="activeTab === 'Usuarios'">
              <UserManager />
            </div>

            <div v-if="activeTab === 'Roles'">
              <RoleManager />
            </div>

            <div v-if="activeTab === 'Dispositivos'">
              <DeviceManager />
            </div>
          </div>
        </section>

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
import { changePassword, deleteDatabase } from '@/api/auth';
import { useSessionStore, useAuthStore } from '@/store/mainStore';
import UserManager from '@/components/RBAC/UserManager.vue';
import RoleManager from '@/components/RBAC/RoleManager.vue';
import DeviceManager from '@/components/RBAC/DeviceManager.vue';

export default defineComponent({
  components: { UserManager, RoleManager, DeviceManager },

  setup() {
    const authStore = useAuthStore();
    const sessionStore = useSessionStore();

    const isAdmin = computed(() => authStore.role?.includes('admin') ?? false);
    const isSUser = computed(() => authStore.role?.includes('s-user') ?? false);
    const isRoleReady = computed(() => authStore.role !== null);

    const tabs = ['Usuarios', 'Roles', 'Dispositivos'];
    const activeTab = ref('Usuarios');

    // Cambio de contraseña
    const passwordSectionVisible = ref(false);
    const isLoading = ref(false);
    const currentPassword = ref('');
    const newPassword = ref('');
    const confirmPassword = ref('');
    const passwordMessage = ref('');

    function togglePasswordSection() {
      passwordSectionVisible.value = !passwordSectionVisible.value;
    }

    async function handlePasswordChange() {
      isLoading.value = true;

      if (newPassword.value !== confirmPassword.value) {
        passwordMessage.value = '❌ Las contraseñas no coinciden.';
        isLoading.value = false;
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
      } finally {
        isLoading.value = false;
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
      }
    });

    return {
      isLoading,  
      passwordSectionVisible,

      tabs,
      activeTab,

      // Roles
      isAdmin,
      isSUser,
      isRoleReady,

      // Contraseña
      togglePasswordSection,
      currentPassword,
      newPassword,
      confirmPassword,
      passwordMessage,
      handlePasswordChange,

      // Config
      allowRegistration,
      maintenanceMode,
      handleConfigUpdate,

      // BBDD
      confirmDeleteDB,
    };
  },
});
</script>

<style src="@/assets/css/ConfigurationView.css" scoped></style>