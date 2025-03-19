import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: localStorage.getItem("user") || null,  // Cargar usuario almacenado
  }),
  actions: {
    setUser(user) {
      this.user = user;
      localStorage.setItem("user", user);  // Guardar usuario en localStorage
    },
    logout() {
      this.user = null;
      localStorage.removeItem("user");  // Eliminar usuario al cerrar sesión
    }
  }
});