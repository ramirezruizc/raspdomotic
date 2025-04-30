import { createApp } from 'vue';
import App from './App.vue';

//Necesario para rutas/endpoints
import router from './router';

//Necesario para poder hacer LocalStorage
import { createPinia } from 'pinia';

//Necesarios para elementos UI (Calendar, MultiSelect,...)
import PrimeVue from 'primevue/config'
//Estilos base de primevue
import 'primevue/resources/primevue.min.css';
//Tema para elementos UI
import 'primevue/resources/themes/saga-blue/theme.css';

//Para uso de iconos minimalistas
import 'primeicons/primeicons.css';

//Necesario para PWA
import './registerServiceWorker';

import Dialog from 'primevue/dialog';

//Configuración global regional para el elemento Calendar
const esLocale = {
    firstDayOfWeek: 1,
    dayNames: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    dayNamesShort: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
    dayNamesMin: ["D", "L", "M", "X", "J", "V", "S"],
    monthNames: [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ],
    monthNamesShort: [
      "ene", "feb", "mar", "abr", "may", "jun",
      "jul", "ago", "sep", "oct", "nov", "dic"
    ],
    today: 'Hoy',
    clear: 'Limpiar',
    dateFormat: 'dd/mm/yy',
    weekHeader: 'Sm'
  };

const app = createApp(App);

app.use(router);
app.use(createPinia());

app.use(PrimeVue, { locale: esLocale });
app.component('DialogModal', Dialog);

app.mount('#app');