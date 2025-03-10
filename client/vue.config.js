const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    allowedHosts: 'all',
    host: '0.0.0.0',
    port: 8081,
  },
  pwa: {
    name: 'RaspDomotic', // Aquí cambia el título
    workboxPluginMode: 'GenerateSW', // Asegura que se genera automáticamente
    workboxOptions: {
      skipWaiting: true,
      clientsClaim: true,
    },
    name: 'RaspDomotic',
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
      args[0].title = 'RaspDomotic'; // ✅ Cambia el título correctamente
      return args;
    });
  }
})
