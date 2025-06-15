<template>
  <div class="schedule-planner">
    <div class="control-group">
      <label>Días activos:</label>
      <div class="days-selector">
        <label v-for="(day, index) in daysOfWeek" :key="index">
          <input type="checkbox" v-model="localSchedule.days" :value="day" /> {{ day }}
        </label>
      </div>
    </div>

    <div class="control-group">
      <label>
        <input type="checkbox" v-model="localSchedule.enforceOutsideSlot" />
        Forzar apagado fuera de franja horaria
      </label>
    </div>

    <div class="control-group">
      <label>Franjas horarias:</label>
      <div v-for="(slot, index) in localSchedule.slots" :key="index" class="time-range">
        <input type="time" v-model="slot.start" step="1800" />
        <span>-</span>
        <input type="time" v-model="slot.end" step="1800" />
        <button class="btn-danger" @click="removeSlot(index)">🗑️</button>
      </div>
      <button @click="addSlot">+ franja</button>
    </div>

    <button class="modal-button btn-success" @click="emitSchedule">Guardar planificación</button>
  </div>
</template>

<script>
export default {
  name: "SchedulePlanner",
  props: {
    value: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      daysOfWeek: ["L", "M", "X", "J", "V", "S", "D"],
      localSchedule: JSON.parse(JSON.stringify(this.value))
    };
  },
  methods: {
    addSlot() {
      this.localSchedule.slots.push({ start: "07:00", end: "07:30" });
    },
    removeSlot(index) {
      this.localSchedule.slots.splice(index, 1);
    },
    emitSchedule() {
      this.$emit("update", this.localSchedule);
      this.$emit("save");
    }
  }
};
</script>

<style scoped>
.schedule-planner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: left;
  padding: 10px;
}

.control-group {
  width: 100%;
  max-width: 500px;
  margin-bottom: 15px;
}

.days-selector {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.time-range {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  justify-content: center;
}

.time-range button {
  margin-left: 10px !important;
}

.schedule-planner button {
  padding: 8px 12px;
  font-size: 14px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.schedule-planner button:hover {
  background-color: #0056b3;
}

.modal-button {
  display: block;
  width: 100%;
  max-width: 200px;
  padding: 10px 15px;
  font-size: 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  text-align: center;
}

.modal-button:hover {
  background-color: #0056b3;
}

.btn-success {
  background-color: #28a745 !important;
  color: white;
}

.btn-success:hover {
  background-color: #218838;
}

.btn-danger {
  background-color: #f8d7da !important;
  border: 1px solid #f5c6cb;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-danger:hover {
  background-color: #f1b0b7;
}
</style>