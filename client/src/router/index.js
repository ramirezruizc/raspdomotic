import { createRouter, createWebHistory } from 'vue-router';
import AuthForm from '../views/AuthFormView.vue'; // Importa tu formulario de autenticación
import Main from '../views/MainView.vue'; // Main view
import Dashboard from '../views/DashboardView.vue'; // Main view
import Analytics from '../views/AnalyticsView.vue'; // Main view
import Configuration from '../views/ConfigurationView.vue'; // Main view
import api from '../api'; // Para las peticiones al servidor

const routes = [
  { path: '/', component: AuthForm }, // Ruta de inicio: Muestra el formulario de login/registro
  { path: '/login', component: AuthForm }, // Ruta de login
  { path: '/app',
    component: Main,
    children: [
        { path: '', component: Dashboard }, // Página por defecto Dashboard
        { path: 'analytics', component: Analytics }, // Página de analytics
        { path: 'configuration', component: Configuration }, //Página de configuration
    ],
    meta: { requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Protección de rutas: Redirigir al login si no hay token
router.beforeEach(async (to, from, next) => {
  if (to.meta.requiresAuth)
    //&& !localStorage.getItem('token')) 
  {
    try{
      // Aquí estamos enviando una solicitud al servidor para verificar si el token en las cookies es válido.
      const response = await api.get('/auth/protected-route'); // El token se manda automáticamente con las cookies
      if (response.status === 200) {
        //next('/login'); // Si no hay token, redirige al login
        next();
    }
    } catch (error) {
    // Si el token no es válido o ha expirado
    next('/login'); // Redirige al login
    }
  } else {
    next();
  }
});

export default router;