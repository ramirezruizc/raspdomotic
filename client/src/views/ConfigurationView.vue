<template>
  <div class="configuration">
    <h1>⚙️ Configuración</h1>

    <div class="configuration-wrapper">

      <!-- Sección cambio de contraseña -->
      <section class="card password-section">
        <div class="password-header" @click="togglePasswordSection">
          <i :class="['pi', passwordSectionVisible.value ? 'pi-chevron-down' : 'pi-chevron-right']"></i>
          <h2>🔐 Cambiar Contraseña</h2>
        </div>

        <div v-if="isSectionLoading" class="section-overlay">
          <div class="section-spinner"></div>
        </div>
        <transition name="fade">
          <form v-show="passwordSectionVisible" @submit.prevent="handlePasswordChange" class="password-form">
            <input v-model="currentPassword" type="password" placeholder="Contraseña actual" required />
            <!-- <input v-model="newPassword" type="password" placeholder="Nueva contraseña" required /> -->

            <!-- Nueva contraseña -->
            <div class="input-wrapper">
              <input
                :type="showPassword ? 'text' : 'password'"
                v-model="newPassword"
                placeholder="Nueva contraseña"
                @focus="passwordFocused = true"
                @blur="passwordFocused = false"
                required
              />
              <span class="toggle-password" @click="showPassword = !showPassword">
                <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
              </span>
            </div>

            <!-- Requisitos compactos -->
            <ul v-if="passwordFocused && passwordHints.length" class="password-hints">
              <li v-for="(hint, i) in passwordHints" :key="i">{{ hint }}</li>
            </ul>

            <!-- <input v-model="confirmPassword" type="password" placeholder="Repetir nueva contraseña" required /> -->

            <!-- Confirmar contraseña -->
            <div class="input-wrapper">
              <input
                :type="showConfirmPassword ? 'text' : 'password'"
                v-model="confirmPassword"
                placeholder="Repetir nueva contraseña"
                required
              />
              <span class="toggle-password" @click="showConfirmPassword = !showConfirmPassword">
                <i :class="showConfirmPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
              </span>
            </div>

            <button type="submit" :disabled="isSubmitDisabled">
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
            <input type="checkbox" v-model="allowRegistration" @change="handleConfigUpdate()" />
            <span class="slider"></span>
            <span class="toggle-text">Permitir nuevos registros de usuario</span>
          </label>
        </div>

        <!-- Modo mantenimiento -->
        <div class="toggle-row">
          <label class="switch-label">
            <input type="checkbox" v-model="maintenanceMode" @change="handleConfigUpdate()" />
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
              <UserManager ref="userManagerRef" />
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
        <!-- Configuración de números de teléfono para llamadas automaticas -->
        <div v-if="isSUser">
          <section class="card phone-section">
            <h3>📞 Números de teléfono para llamadas</h3>

            <div class="phone-list">
              <div
                v-for="(num, index) in phoneNumbers"
                :key="index"
                class="number-entry"
              >
                <input v-model="phoneNumbers[index]" placeholder="+34..." />
                <button @click="removePhoneNumber(index)" class="delete-btn" title="Eliminar">
                  <i class="pi pi-trash"></i>
                </button>
              </div>
              <div class="phone-actions">
                <button class="phone-action" @click="addPhoneNumber">➕ Añadir</button>
                <button class="phone-action btn-success" @click="savePhoneNumbers">Guardar</button>
              </div>
            </div>

            <p v-if="numberError" class="error-msg">{{ numberError }}</p>
          </section>
        </div>

        <div v-if="isSUser" class="danger-zone">
          <h3>⚠️ Eliminar Base de Datos</h3>
          <p>¡Este paso eliminará <strong>permanentemente</strong> toda la base de datos!</p>
          <button @click="confirmDeleteDB">ELIMINAR BASE DE DATOS</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, computed } from 'vue';
import { getSystemConfig, updateSystemConfig } from '@/api/systemConfig';
import { getPhoneNumbers } from '@/api/devices';
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

    const tabs = ['Usuarios', 'Roles', 'Dispositivos'];
    const activeTab = ref('Usuarios');

    // Cambio de contraseña
    const passwordSectionVisible = ref(false);
    const isSectionLoading = ref(false);
    const currentPassword = ref('');
    const newPassword = ref('');
    const confirmPassword = ref('');
    const passwordMessage = ref('');
    const passwordFocused = ref(false);
    const showPassword = ref(false);
    const showConfirmPassword = ref(false);

    const phoneNumbers = ref([]);
    const numberError = ref('');

    const userManagerRef = ref(null);

    function togglePasswordSection() {
      passwordSectionVisible.value = !passwordSectionVisible.value;
    }

    async function handlePasswordChange() {
      isSectionLoading.value = true;

      if (newPassword.value !== confirmPassword.value) {
        passwordMessage.value = '❌ Las contraseñas no coinciden.';
        isSectionLoading.value = false;
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
        isSectionLoading.value = false;
      }
    }

    const passwordHints = computed(() => {
      const p = newPassword.value || '';
      const hints = [];
      if (p.length < 3) hints.push('Mínimo 3 caracteres.');
      if (!/[a-z]/.test(p)) hints.push('Debe tener una minúscula.');
      if (!/[A-Z]/.test(p)) hints.push('Debe tener una mayúscula.');
      if (!/[0-9]/.test(p)) hints.push('Debe tener un número.');
      return hints;
    });

    const isPasswordValid = computed(() => passwordHints.value.length === 0);
    const isSubmitDisabled = computed(() => !isPasswordValid.value || newPassword.value !== confirmPassword.value);

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
        const currentConfig = await getSystemConfig();
        const wasMaintenance = currentConfig.maintenanceMode;

        await updateSystemConfig({
          allowRegistration: allowRegistration.value,
          maintenanceMode: maintenanceMode.value,
        });

        // Si activamos modo mantenimiento, se expulsan a todos los usuarios salvo admin's
        if (!wasMaintenance && maintenanceMode.value) {
          if (activeTab.value === 'Usuarios' && userManagerRef.value?.refreshUserList) {
            alert("Todos los usuarios han sido expulsados");
            await userManagerRef.value.refreshUserList();
          }
        }
      } catch (e) {
        console.error('Error actualizando configuración del sistema:', e);
      } finally {
        sessionStore.setLoading(false);
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
        await sessionStore.logout();
      } catch (err) {
        console.error('Error al eliminar la base de datos:', err);
        alert('No se pudo eliminar la base de datos');
      }
    }

    function addPhoneNumber() {
      // Si ya existe un campo vacío, no dejar añadir más
      if (phoneNumbers.value.includes('')) {
        numberError.value = '❌ Ya hay un campo vacío. Complétalo antes de añadir otro.';
        return;
      }

      // Si es duplicado, no agregar
      const duplicates = phoneNumbers.value.some((num, idx, arr) => arr.indexOf(num) !== idx);
      if (duplicates) {
        numberError.value = '❌ Existen números duplicados. Corrige antes de añadir más.';
        return;
      }

      numberError.value = '';
      phoneNumbers.value.push('');
    }

    function removePhoneNumber(index) {
      phoneNumbers.value.splice(index, 1);
      numberError.value = '';
    }

    async function savePhoneNumbers() {
      const cleaned = phoneNumbers.value.map(n => n.trim()).filter(n => n !== '');

      const hasDuplicates = new Set(cleaned).size !== cleaned.length;
      if (hasDuplicates) {
        numberError.value = '❌ No se permiten números duplicados.';
        return;
      }

      if (cleaned.some(n => !/^\+?\d{8,15}$/.test(n))) {
        numberError.value = '❌ Algún número tiene formato inválido.';
        return;
      }

      try {
        sessionStore.setLoading(true);
        await updateSystemConfig({ phoneNumbers: cleaned });
        numberError.value = '✅ Números actualizados correctamente.';
      } catch (err) {
        console.error('Error al guardar números:', err);
        numberError.value = '❌ Error al guardar números.';
      } finally {
        sessionStore.setLoading(false);
      }
    }

    onMounted(async ()=> {
      if (isAdmin.value) {
        checkSystemConfig();
      }

      if (isSUser.value) {
        phoneNumbers.value = await getPhoneNumbers();
      }
    });

    /*
    watch(maintenanceMode, async (newVal, oldVal) => {
      if (!oldVal && newVal) {
        console.log("Activado modo mantenimiento. Refrescando usuarios...");
        if (activeTab.value === 'Usuarios' && userManagerRef.value?.refreshUserList) {
          await userManagerRef.value.refreshUserList();
        }
      }
    });
    */

    return {
      isSectionLoading,  
      passwordSectionVisible,

      tabs,
      activeTab,

      // Roles
      isAdmin,
      isSUser,

      // Contraseña
      togglePasswordSection,
      currentPassword,
      newPassword,
      confirmPassword,
      passwordMessage,
      handlePasswordChange,
      passwordFocused,
      showPassword,
      showConfirmPassword,
      passwordHints,
      isSubmitDisabled,

      // Config
      allowRegistration,
      maintenanceMode,
      handleConfigUpdate,

      // BBDD
      confirmDeleteDB,

      phoneNumbers,
      numberError,
      addPhoneNumber,
      removePhoneNumber,
      savePhoneNumbers,

      // Referencia a UserManager
      userManagerRef
    };
  },
});
</script>

<style src="@/assets/css/ConfigurationView.css" scoped></style>