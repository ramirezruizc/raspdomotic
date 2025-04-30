<template>
  <div id="app">
    <router-view></router-view> <!-- Esto renderiza el componente correspondiente según la ruta -->
  </div>
</template>

<script>
export default {
  name: 'App',
}
</script>

<style>
html, body {
  touch-action: manipulation; /* Evita zoom por doble tap */
  user-select: none; /* Evita selección accidental de texto */
  overflow-x: hidden; /* Previene scroll lateral, pero deja scroll vertical */
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  /*margin-top: 60px;*/
}

/* Evita el autozoom en móviles al tocar inputs */
input, textarea {
  font-size: 16px; /* Previene el autozoom en dispositivos móviles */
}
</style>