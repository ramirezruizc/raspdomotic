# Diff Details

Date : 2025-08-02 17:52:56

Directory /Users/cramirez/mnt/raspi.local/modules/raspdomotic/client

Total : 66 files,  3971 codes, -162 comments, 437 blanks, all 4246 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [client/README.md](/client/README.md) | Markdown | 19 | 0 | 6 | 25 |
| [client/babel.config.js](/client/babel.config.js) | JavaScript | 5 | 0 | 1 | 6 |
| [client/jsconfig.json](/client/jsconfig.json) | JSON with Comments | 19 | 0 | 1 | 20 |
| [client/package.json](/client/package.json) | JSON | 56 | 0 | 1 | 57 |
| [client/public/img/icons/safari-pinned-tab.svg](/client/public/img/icons/safari-pinned-tab.svg) | XML | 3 | 0 | 1 | 4 |
| [client/public/index.html](/client/public/index.html) | HTML | 22 | 1 | 1 | 24 |
| [client/src/App.vue](/client/src/App.vue) | vue | 34 | 0 | 4 | 38 |
| [client/src/api/api.js](/client/src/api/api.js) | JavaScript | 26 | 32 | 9 | 67 |
| [client/src/api/auth.js](/client/src/api/auth.js) | JavaScript | 138 | 10 | 22 | 170 |
| [client/src/api/devices.js](/client/src/api/devices.js) | JavaScript | 34 | 1 | 5 | 40 |
| [client/src/api/events.js](/client/src/api/events.js) | JavaScript | 13 | 2 | 2 | 17 |
| [client/src/api/systemConfig.js](/client/src/api/systemConfig.js) | JavaScript | 19 | 2 | 2 | 23 |
| [client/src/assets/css/AuthFormView.css](/client/src/assets/css/AuthFormView.css) | PostCSS | 115 | 7 | 17 | 139 |
| [client/src/assets/css/ConfigurationView.css](/client/src/assets/css/ConfigurationView.css) | PostCSS | 278 | 13 | 49 | 340 |
| [client/src/assets/css/DashboardView.css](/client/src/assets/css/DashboardView.css) | PostCSS | 146 | 14 | 23 | 183 |
| [client/src/assets/css/HomeControlView.css](/client/src/assets/css/HomeControlView.css) | PostCSS | 111 | 21 | 17 | 149 |
| [client/src/assets/css/MainView.css](/client/src/assets/css/MainView.css) | PostCSS | 97 | 7 | 14 | 118 |
| [client/src/components/BurguerMenu.vue](/client/src/components/BurguerMenu.vue) | vue | 113 | 2 | 15 | 130 |
| [client/src/components/RBAC/DeviceManager.vue](/client/src/components/RBAC/DeviceManager.vue) | vue | 389 | 2 | 58 | 449 |
| [client/src/components/RBAC/RoleManager.vue](/client/src/components/RBAC/RoleManager.vue) | vue | 292 | 2 | 52 | 346 |
| [client/src/components/RBAC/UserManager.vue](/client/src/components/RBAC/UserManager.vue) | vue | 612 | 4 | 101 | 717 |
| [client/src/components/SchedulePlanner.vue](/client/src/components/SchedulePlanner.vue) | vue | 148 | 0 | 20 | 168 |
| [client/src/components/VoiceControl.vue](/client/src/components/VoiceControl.vue) | vue | 301 | 4 | 49 | 354 |
| [client/src/components/devices/AirConditioningDevice.vue](/client/src/components/devices/AirConditioningDevice.vue) | vue | 378 | 5 | 58 | 441 |
| [client/src/components/devices/AlarmDevice.vue](/client/src/components/devices/AlarmDevice.vue) | vue | 170 | 2 | 24 | 196 |
| [client/src/components/devices/BulbDevice.vue](/client/src/components/devices/BulbDevice.vue) | vue | 308 | 3 | 57 | 368 |
| [client/src/components/devices/BulbRGBDevice.vue](/client/src/components/devices/BulbRGBDevice.vue) | vue | 434 | 6 | 78 | 518 |
| [client/src/components/devices/CameraDevice.vue](/client/src/components/devices/CameraDevice.vue) | vue | 132 | 0 | 19 | 151 |
| [client/src/components/devices/DeviceMapper.js](/client/src/components/devices/DeviceMapper.js) | JavaScript | 8 | 2 | 4 | 14 |
| [client/src/components/devices/SwitchDevice.vue](/client/src/components/devices/SwitchDevice.vue) | vue | 368 | 3 | 56 | 427 |
| [client/src/main.js](/client/src/main.js) | JavaScript | 34 | 8 | 11 | 53 |
| [client/src/permissions/routeRoles.js](/client/src/permissions/routeRoles.js) | JavaScript | 3 | 1 | 0 | 4 |
| [client/src/registerServiceWorker.js](/client/src/registerServiceWorker.js) | JavaScript | 33 | 6 | 4 | 43 |
| [client/src/router/index.js](/client/src/router/index.js) | JavaScript | 47 | 9 | 9 | 65 |
| [client/src/service-worker.js](/client/src/service-worker.js) | JavaScript | 20 | 0 | 5 | 25 |
| [client/src/store/mainStore.js](/client/src/store/mainStore.js) | JavaScript | 136 | 12 | 25 | 173 |
| [client/src/utils/normalizeCommand.js](/client/src/utils/normalizeCommand.js) | JavaScript | 33 | 10 | 10 | 53 |
| [client/src/views/AuthFormView.vue](/client/src/views/AuthFormView.vue) | vue | 134 | 8 | 24 | 166 |
| [client/src/views/ConfigurationView.vue](/client/src/views/ConfigurationView.vue) | vue | 292 | 7 | 57 | 356 |
| [client/src/views/DashboardView.vue](/client/src/views/DashboardView.vue) | vue | 243 | 7 | 40 | 290 |
| [client/src/views/HomeControlView.vue](/client/src/views/HomeControlView.vue) | vue | 179 | 2 | 30 | 211 |
| [client/src/views/MainView.vue](/client/src/views/MainView.vue) | vue | 93 | 3 | 15 | 111 |
| [client/src/views/PruebasView.vue](/client/src/views/PruebasView.vue) | vue | 71 | 0 | 8 | 79 |
| [client/vue.config.js](/client/vue.config.js) | JavaScript | 43 | 24 | 4 | 71 |
| [server/middleware/auth.js](/server/middleware/auth.js) | JavaScript | -62 | -7 | -16 | -85 |
| [server/models/Device.js](/server/models/Device.js) | JavaScript | -9 | 0 | -2 | -11 |
| [server/models/DeviceSchedule.js](/server/models/DeviceSchedule.js) | JavaScript | -15 | 0 | -3 | -18 |
| [server/models/Event.js](/server/models/Event.js) | JavaScript | -25 | 0 | -2 | -27 |
| [server/models/Role.js](/server/models/Role.js) | JavaScript | -7 | 0 | -2 | -9 |
| [server/models/SystemConfig.js](/server/models/SystemConfig.js) | JavaScript | -7 | 0 | -2 | -9 |
| [server/models/User.js](/server/models/User.js) | JavaScript | -27 | -3 | -4 | -34 |
| [server/package.json](/server/package.json) | JSON | -33 | 0 | -1 | -34 |
| [server/routes/auth.js](/server/routes/auth.js) | JavaScript | -438 | -79 | -122 | -639 |
| [server/routes/devices.js](/server/routes/devices.js) | JavaScript | -462 | -121 | -141 | -724 |
| [server/routes/events.js](/server/routes/events.js) | JavaScript | -88 | -29 | -18 | -135 |
| [server/routes/schedule.js](/server/routes/schedule.js) | JavaScript | -34 | -2 | -8 | -44 |
| [server/routes/systemConfig.js](/server/routes/systemConfig.js) | JavaScript | -87 | -14 | -19 | -120 |
| [server/server.js](/server/server.js) | JavaScript | -85 | -28 | -21 | -134 |
| [server/services/device/deviceLoader.js](/server/services/device/deviceLoader.js) | JavaScript | -47 | -4 | -12 | -63 |
| [server/services/device/deviceRegistry.js](/server/services/device/deviceRegistry.js) | JavaScript | -78 | -2 | -22 | -102 |
| [server/services/mqtt/mqttClient.js](/server/services/mqtt/mqttClient.js) | JavaScript | -243 | -60 | -65 | -368 |
| [server/services/scheduler/schedulerExecutor.js](/server/services/scheduler/schedulerExecutor.js) | JavaScript | -114 | -6 | -30 | -150 |
| [server/services/webSocket/shared/cameraState.js](/server/services/webSocket/shared/cameraState.js) | JavaScript | -39 | -8 | -10 | -57 |
| [server/services/webSocket/socketIoManager.js](/server/services/webSocket/socketIoManager.js) | JavaScript | -172 | -29 | -48 | -249 |
| [server/services/webSocket/wssManager.js](/server/services/webSocket/wssManager.js) | JavaScript | -92 | -12 | -21 | -125 |
| [server/utils/logEvent.js](/server/utils/logEvent.js) | JavaScript | -14 | 0 | -2 | -16 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details