import { defineAsyncComponent } from 'vue';

const components = ['AlarmDevice', 'CameraDevice', 'BulbDevice', 'SwitchDevice', 'AirConditioningDevice'];

const componentMap = {};
components.forEach(name => {
  componentMap[name] = defineAsyncComponent(() => import(`../components/${name}.vue`));
});

export default componentMap;