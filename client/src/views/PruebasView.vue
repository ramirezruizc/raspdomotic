<template>
  <div id="app">
    <date-picker
      v-model:value="value" 
      range
      format="DD/MM/YYYY"
      :lang="lang"
      v-model:open="open"
      placeholder="Selecciona un rango"
      :style="{ width: '200px' }">
      <template v-slot:content>
        <calendar-panel
          :value="innerValue"
          :get-classes="getClasses"
          @pick="handleSelect"
        ></calendar-panel>
      </template>
    </date-picker>
  </div>
</template>

<script>
import DatePicker from "vue-datepicker-next";
import "vue-datepicker-next/index.css";
import { es } from 'vue-datepicker-next/locale/es';

const { Calendar: CalendarPanel } = DatePicker;

function isValidDate(date) {
  return date instanceof Date && !isNaN(date);
}

export default {
  components: { DatePicker, CalendarPanel },

  data() {
    return {
      value: [], // Aquí se guarda el rango [start, end]
      innerValue: [new Date(NaN), new Date(NaN)],
      lang: es,
      open: false
    };
  },
  methods: {
    formatDate(date) {
      if (!(date instanceof Date)) return '';
      return date.toLocaleDateString('es-ES');
    },

    getClasses(cellDate, currentDates, classes) {
      if (
        !/disabled|active|not-current-month/.test(classes) &&
        currentDates.length === 2 &&
        cellDate.getTime() > currentDates[0].getTime() &&
        cellDate.getTime() < currentDates[1].getTime()
      ) {
        return "in-range";
      }
      return "";
    },

    handleSelect(date) {
      const [startValue, endValue] = this.innerValue;

      if (isValidDate(startValue) && !isValidDate(endValue)) {
        if (startValue.getTime() > date.getTime()) {
          this.innerValue = [date, startValue];
        } else {
          this.innerValue = [startValue, date];
        }
        this.value = this.innerValue;
        this.open = false;
      } else {
        this.innerValue = [date, new Date(NaN)];
      }
    },
  },
};
</script>