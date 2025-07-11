<template>
  <div class="dashboard">
    <h1>📊 Dashboard</h1>

    <div class="dashboard-wrapper">
      <button class="toggle-filters small" @click="filtersVisible = !filtersVisible">
        <i class="pi pi-filter"></i> Filtros
      </button>

      <transition name="fade">
        <div v-if="filtersVisible" class="filters-container">
          <div class="filters-left">
            <div class="filter-group">
              <label>Fecha:</label>
              <!-- 
                :locale="esLocale" ya no es necesario porque la localización se aplica globalmente en main.js
                dateFormat="dd/mm/yy" también está definido en esLocale global
              -->
              <Calendar
                ref="calendarRef"
                v-model="dateRange"
                selectionMode="range"
                showIcon
                placeholder="Selecciona un rango"
                :showButtonBar="true"
                :autoZIndex="true"
                :closeOnDateSelect="false"
                :manualInput="false"
                appendTo="self"
                class="calendar small"
                @show="injectApplyButton"
              />
              <p v-if="!isDateRangeValid" class="field-error">⚠️ Este campo es obligatorio</p>
            </div>

            <div class="filter-group">
              <label>Usuarios:</label>
              <MultiSelect
                v-model="selectedUsers"
                :options="usersList"
                optionLabel="username"
                placeholder="Selecciona usuarios"
                display="comma"
                multiple
                class="multiselect small"
              />
            </div>

            <div class="filter-group">
              <label>Tipos de Evento:</label>
              <MultiSelect
                v-model="selectedEventTypes"
                :options="eventTypesList"
                placeholder="Selecciona tipos de evento"
                display="comma"
                class="multiselect small"
              />
            </div>
          </div>

          <div class="filters-right">
            <button 
              @click="fetchSummary" 
              class="icon-button search-button"
              title="Buscar"
              :disabled="!Array.isArray(dateRange) || 
                dateRange.length !== 2 ||
                !dateRange[0] || 
                !dateRange[1]"
              >
              <i class="pi pi-search"></i>
            </button>
          </div>
        </div>
      </transition>

      <div class="chart-container">
        <h2>📌 Resumen de Eventos</h2>

        <!-- Mostrar gráfico solo si hay datos -->
        <BarChart v-if="summaryChartData" :chart-data="summaryChartData" />

        <!-- Mostrar mensaje de sin resultados si se consultó y no hay datos -->
        <div v-else-if="hasQueried && noDataFound" class="no-data-overlay">
          <span class="info-icon">ℹ️</span>
          <p>No se encontraron datos con el filtro seleccionado.</p>
        </div>

        <!-- Mostrar mensaje inicial si aún no se hizo una consulta -->
        <div v-else class="no-data-overlay">
          <span class="info-icon">ℹ️</span>
          <p>Selecciona un rango de fechas para visualizar eventos.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, computed } from 'vue';
//import { BarChart, PieChart } from 'vue-chart-3';
import { BarChart } from 'vue-chart-3';
import { Chart, registerables } from 'chart.js';
import Calendar from 'primevue/calendar';
import MultiSelect from 'primevue/multiselect';
import { getUsersList } from '@/api/auth';
import { getEventTypes, getEventSummary } from '@/api/events';
import { useSessionStore } from '@/store/mainStore';

Chart.register(...registerables);

function isValidDate(date) {
  return date instanceof Date && !isNaN(date);
}

export default defineComponent({
  components: {
    BarChart,
    //PieChart,
    Calendar,
    MultiSelect,
  },
  setup() {
    const dateRange = ref([]);
    const filtersVisible = ref(false)

    const sessionStore = useSessionStore();

    const usersList = ref([]);
    const eventTypesList = ref([]);
    const selectedUsers = ref([]);
    const selectedEventTypes = ref([]);

    const noDataFound = ref(false);
    const hasQueried = ref(false);
    const summaryChartData = ref(null);

    const isDateRangeValid = computed(() => {
      return (
        Array.isArray(dateRange.value) &&
        dateRange.value.length === 2 &&
        dateRange.value[0] &&
        dateRange.value[1]
      );
    });

    const loadUsers = async () => {
      try {
        const users = await getUsersList();
        usersList.value = users.map(u => ({ username: u.username }));
      } catch (error) {
        console.error('Error al cargar usuarios:', error);
      }
    };

    const loadEventTypes = async () => {
      try {
        const types = await getEventTypes();
        eventTypesList.value = types;
      } catch (error) {
        console.error('Error al cargar tipos de evento:', error);
      }
    };

    const fetchSummary = async () => {
      hasQueried.value = true;
      console.log("Se procesa la consulta");

      /*if (!Array.isArray(dateRange.value) || dateRange.value.length !== 2) return;
      
      if (!startRaw || !endRaw)
      {
        alert('Por favor selecciona un rango de fechas');
        return;
      }*/

      const [startRaw, endRaw] = dateRange.value;
      const start = new Date(startRaw);
      const end = new Date(endRaw);

      if (!isValidDate(start) || !isValidDate(end)) {
        alert('El rango de fechas no es válido');
        return;
      }

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const filters = {
        start: start.toISOString(),
        end: end.toISOString(),
      };

      if (selectedUsers.value.length > 0) {
        filters.users = selectedUsers.value.map(u => u.username);
      }

      if (selectedEventTypes.value.length > 0) {
        filters.eventTypes = selectedEventTypes.value;
      }

      try {
        console.log("Consulta:", filters);
        sessionStore.setLoading(true);
        const data = await getEventSummary(filters);
        sessionStore.setLoading(false);

        console.log("Resumen recibido:", data);

        // Verificamos si la respuesta tiene datos
        if (data && data.length > 0) {
          noDataFound.value = false;  // Hay datos
          summaryChartData.value = {
            labels: data.map(item => item._id),
            datasets: [{
              label: 'Eventos',
              data: data.map(item => item.count),
              backgroundColor: 'rgba(54, 162, 235, 0.5)',
            }],
          };
        } else {
          noDataFound.value = true;  // No hay datos
          summaryChartData.value = null;  // Limpiamos los datos del gráfico
        }
      } catch (error) {
        noDataFound.value = true;
        console.error('Error al obtener datos de la consulta:', error);
      }
    };

    const calendarRef = ref(null);

    const injectApplyButton = () => {
      setTimeout(() => {
        const dp = calendarRef.value && calendarRef.value.$el
          ? calendarRef.value.$el.querySelector('.p-datepicker-buttonbar')
          : null;

        if (dp && !dp.querySelector('.apply-button')) {
          const btn = document.createElement('button');
          btn.textContent = 'Aplicar';
          btn.className = 'p-button p-component p-button-sm apply-button';
          btn.style.marginLeft = 'auto';

          btn.onclick = () => {
            if (calendarRef.value && calendarRef.value.overlayVisible !== undefined) {
              calendarRef.value.overlayVisible = false;
            }
          };

          dp.appendChild(btn);
        }
      }, 50);
    };

    onMounted(async () => {
      sessionStore.setLoading(true);

      try {
        await Promise.all([
          loadUsers(),
          loadEventTypes()
        ]);
      } catch (error) {
        console.error("❌ Error al cargar datos del dashboard:", error);
      } finally {
        sessionStore.setLoading(false);
      }
    });

    return {
      noDataFound,
      hasQueried,
      filtersVisible,
      usersList,
      eventTypesList,
      selectedUsers,
      selectedEventTypes,
      dateRange,
      fetchSummary,
      summaryChartData,
      calendarRef,
      injectApplyButton,
      isDateRangeValid
    };
  }
});
</script>

<style src="@/assets/css/DashboardView.css" scoped></style>