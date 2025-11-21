# RaspDomotic

**RaspDomotic** es un sistema domótico integrado basado en tecnologías abiertas.  
Nace como proyecto de fin de grado en Ingeniería Informática y tiene como objetivo
ofrecer una plataforma flexible para monitorizar y controlar una vivienda desde
una **Raspberry Pi** y una **PWA** accesible desde navegador o móvil.

---

## Características principales

- Panel web (PWA) para:
  - Ver el estado de sensores y actuadores.
  - Controlar relés, luces y otros dispositivos.
  - Gestionar usuarios y roles (RBAC básico).
- Integración con **MQTT** (Mosquitto) y **Node-RED** para la lógica domótica.
- Soporte para dispositivos basados en:
  - ESP8266 / ESP32 (Tasmota, Espurna, etc.).
  - Sensores cableados y sensores Zigbee (vía Zigbee2MQTT).
- Sistema de **notificaciones**:
  - Eventos en tiempo real vía WebSocket.
  - (Opcional) Llamadas de aviso usando Twilio.
- Despliegue orientado a **contenedores Docker**.

---

## Arquitectura a alto nivel

- **Servidor central**: Raspberry Pi con Docker/Compose.
- **Backend**: Node.js + Express + WebSocket.
- **Bus de integración**: Mosquitto (MQTT) + Node-RED.
- **Frontend**: PWA en Vue (SPA), responsive.
- **Base de datos**: MongoDB (configuración, usuarios, eventos, etc.).

---

## Requisitos mínimos

- Raspberry Pi 3B+ (o superior) con sistema basado en Debian.
- Docker y Docker Compose instalados.
- Conexión de red (LAN; opcionalmente acceso remoto).
- Dispositivos domóticos compatibles (ESP8266/ESP32, Tasmota/Espurna, Zigbee2MQTT, etc.).

---

## Puesta en marcha rápida

> ⚠️ Los pasos concretos pueden variar según tu entorno.  
> WIP
