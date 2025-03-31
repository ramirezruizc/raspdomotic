<template>
  <div class="analytics">
    <h1>📊 Analytics</h1>
    
    <div class="chart-container">
      <h2>🔔 Conexiones de la Alarma</h2>
      <BarChart :chart-data="alarmData" />

      <h2>👤 Inicios de Sesión</h2>
      <PieChart :chart-data="loginData" />
    </div>
  </div>
</template>

<script>
import { defineComponent, ref } from "vue";
import { BarChart, PieChart } from "vue-chart-3";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

export default defineComponent({
  components: { BarChart, PieChart },
  setup() {
    // Datos de prueba
    const alarmData = ref({
      labels: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
      datasets: [{ label: "Activaciones", data: [5, 8, 3, 7, 6], backgroundColor: "rgba(255, 99, 132, 0.5)" }]
    });

    const loginData = ref({
      labels: ["User1", "User2", "Admin"],
      datasets: [{ data: [12, 5, 3], backgroundColor: ["#ff6384", "#36a2eb", "#ffce56"] }]
    });

    return { alarmData, loginData };
  }
});
</script>

<style scoped>
.chart-container {
  width: 80%;
  margin: auto;
}
</style>