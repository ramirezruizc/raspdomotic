module.exports = {
  apps: [
    {
      name: "raspdomotic-backend",
      script: "./server.js",
      watch: true, //detecta cambios de código y reinicia automático
      cwd: "./server", //Directorio de trabajo para backend
      /*env: {
        NODE_ENV: "production"
      }*/
    }
  ]
};
