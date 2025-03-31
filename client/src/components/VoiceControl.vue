<template>
    <div class="voice-control">
        <button @click="startRecognition" class="voice-btn">
            <i class="pi pi-microphone"></i>
        </button>
        <p v-if="command">Comando: {{ command }}</p>
    </div>
  </template>
  
  <script>
  import api from '../api';

  export default {
    data() {
      return {
        command: ''
      };
    },
    methods: {
      async startRecognition() {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'es-ES';
        recognition.start();
  
        recognition.onresult = async (event) => {
            this.command = event.results[0][0].transcript;
  
            try {
                const response = await api.post("/devices/command", { command: this.command });

                if (!response.data.success) {
                    throw new Error(response.data.message || "Error desconocido");
            }
            console.log("✅ Comando enviado con éxito");
            } catch (error) {
                console.error("❌ Error al enviar el comando:", error);
            }
        };
      }
    }
  };
  </script>
  
  <style scoped>
  .voice-control {
    text-align: center;
    margin: 20px;
  }
  button {
    font-size: 1.2em;
    padding: 10px 20px;
    cursor: pointer;
  }

  .voice-btn {
  font-size: 1.5rem;
  padding: 10px;
  border: none;
  background: #007bff;
  color: white;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: 0.3s;
}

.voice-btn:hover {
  background: #0056b3;
}
  </style>  