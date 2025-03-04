const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    allowedHosts: 'all',
    host: '0.0.0.0',
    port: 8081,
  },
  pwa: {
    workboxPluginMode: 'GenerateSW', // Asegura que se genera automáticamente
    workboxOptions: {
      skipWaiting: true,
      clientsClaim: true,
    },
    name: 'Mi PWA',
    themeColor: '#42b983',
    manifestOptions: {
      background_color: '#ffffff'
    }
  }
})
