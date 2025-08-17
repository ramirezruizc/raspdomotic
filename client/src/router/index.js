import { createRouter, createWebHistory } from 'vue-router';
import AuthForm from '../views/AuthFormView.vue'; // Importa tu formulario de autenticación
import Main from '../views/MainView.vue'; // View Main view
import HomeControl from '../views/HomeControlView.vue'; // View Home Control
import Dashboard from '../views/DashboardView.vue'; // View Dashboard
import Configuration from '../views/ConfigurationView.vue'; // View Configuration
import api from '../api/api'; // Para las peticiones al servidor
import { routeRoles } from '@/permissions/routeRoles'; //Proteccion por roles

//View para pruebas aisladas
//import Pruebas from '../views/PruebasView.vue';

//Definicion de posibles rutas para la aplicacion
const routes = [
  { path: '/', component: AuthForm }, // Ruta de inicio: Muestra el formulario de login/registro
  { path: '/login', component: AuthForm }, // Ruta de login
  { path: '/app',
    component: Main,
    children: [
        { path: '', component: HomeControl }, // Página por defecto Home Control
        { path: 'dashboard', component: Dashboard }, // Página de Dashboard
        { path: 'configuration', component: Configuration }, //Página de Configuration
    ],
    meta: { requiresAuth: true }
  },
  //{ path: '/pruebas', component: Pruebas } //Ruta para pruebas unitarias
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  if (to.meta.requiresAuth) {
    try {
      // Validar sesión vía backend (token httpOnly en cookies)
      const response = await api.get('/auth/protected-route');

      const userRoles = response.data.role || [];
      const requiredRoles = routeRoles[to.path]; //Si la ruta está restringida

      console.log("userRoles:", userRoles);
      console.log("requiredRoles:", requiredRoles);

      //Si la ruta tiene restricciones y el usuario no cumple, redirigir
      if (requiredRoles && !requiredRoles.some(r => userRoles.includes(r))) {
        console.warn(`⛔ Acceso denegado a ${to.path} para roles:`, userRoles);
        return next('/login');
      }

      //Autenticado y con rol adecuado (o ruta sin restricción)
      next();
    } catch (error) {
      // Token inválido, sesión caducada, redireccion a login
      console.warn('⚠️ Token inválido o sesión expirada');
      next('/login');
    }
  } else {
    // Ruta pública
    next();
  }
});

export default router;