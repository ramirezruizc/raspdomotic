import { createRouter, createWebHistory } from 'vue-router';
import AuthForm from '../views/AuthForm.vue'; // Importa tu formulario de autenticación
import Dashboard from '../views/DashboardPage.vue'; // Asume que tienes un Dashboard
import api from '../api'; // Para las peticiones al servidor

const routes = [
  { path: '/', component: AuthForm }, // Ruta de inicio: Muestra el formulario de login/registro
  { path: '/login', component: AuthForm }, // Ruta de login
  { path: '/dashboard', component: Dashboard, meta: { requiresAuth: true } }, // Ruta del dashboard (protegida)
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
