const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    allowedHosts: 'all',
    host: '0.0.0.0',
    port: 8081,
    client: {
      webSocketURL: {
        hostname: "192.168.1.4", // IP del servidor
        pathname: "/hmr",         // Cambia la ruta WebSocket de WDS a /hmr
        port: 8081
      }
    },
    
    //Para poder operar bien con IP local en entorno 
    //de desarrollo, eliminar comentarios siguientes
    
    
    proxy: {
      '/api/v1': {
        target: 'http://192.168.1.4:7000', // IP del backend en la Raspberry Pi
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://192.168.1.4:7000',
        ws: true
      },
      '/ws': {
        target: 'http://192.168.1.4:7000/ws/',
        ws: true
      }
    }
    
    
  },
  pwa: {
    name: 'RaspDomotic', // Aquí cambia el título
    /*workboxPluginMode: 'GenerateSW', // Asegura que se genera automáticamente
    workboxOptions: {
      skipWaiting: true,
      clientsClaim: true,
    },*/
    workboxPluginMode: "InjectManifest",
    workboxOptions: {
      swSrc: "./src/service-worker.js" // Aquí crearemos nuestro SW personalizado
    },
    iconPaths: {
      favicon32: 'RD.ico',
      favicon16: 'RD.ico',
      appleTouchIcon: 'RD.ico',
      maskIcon: 'RD.ico',
      msTileImage: 'RD.ico'
    },
    themeColor: '#42b983',
    manifestOptions: {
      background_color: '#ffffff'
    }
  },
  chainWebpack: config => {
    config.plugin('html').tap(args => {
      args[0].title = 'RaspDomotic';
      return args;
    });
  },
  // Habilita los source maps en el entorno de desarrollo
  configureWebpack: {
    devtool: 'source-map',
  },
})