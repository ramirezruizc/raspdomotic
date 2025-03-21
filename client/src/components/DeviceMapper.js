import { defineAsyncComponent } from 'vue';

const components = ['AlarmDevice', 'CameraDevice', 'BulbDevice', 'SwitchDevice'];

const componentMap = {};
components.forEach(name => {
  componentMap[name] = defineAsyncComponent(() => import(`../components/${name}.vue`));
});

export default componentMap;