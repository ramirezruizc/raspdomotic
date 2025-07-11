import { defineAsyncComponent } from 'vue';

//Listado de componentes diposnibles en el sistema
const components = ['AlarmDevice', 'CameraDevice', 'BulbRGBDevice', 
                    'BulbDevice', 'SwitchDevice', 'AirConditioningDevice'];

const componentMap = {};

//Definicion dinamica de componentes en base al nombre del archivo fuente
components.forEach(name => {
  componentMap[name] = defineAsyncComponent(() => import(`./${name}.vue`));
});

export default componentMap;