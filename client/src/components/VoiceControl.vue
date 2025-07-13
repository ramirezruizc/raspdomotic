<template>
    <div class="voice-control">
      <div class="mic-wrapper">
        <!-- Botón de ayuda -->
          <button class="help-icon" @click="showHelp = true">
              <i class="pi pi-info-circle"></i>
          </button>

        <!-- Botón de micrófono -->
        <button
          @click="startRecognition"
          class="voice-btn"
          :class="{ breathing: isListening }"
          :disabled="isButtonDisabled"
        >
          <i class="pi pi-microphone"></i>
        </button>
      </div>

    <!-- Modal de ayuda -->
    <div v-if="showHelp" class="modal-overlay" @click.self="showHelp = false">
      <div class="modal-content">
        <h3>Comandos de voz disponibles:</h3>
          <ul>
            <li>"Encender salón"</li>
            <li>"Apagar salón"</li>
            <li>"Salón al 25%"</li>
            <li>"Salón al 50%"</li>
            <li>"Salón al 75%"</li>
            <li>"Salón al 100%"</li>
            <li>"Encender salón frío"</li>
            <li>"Conectar alarma"</li>
            <li>"Desconectar alarma"</li>
            <li>"Llamar emergencias"</li>
          </ul>
        <button @click="showHelp = false">Cerrar</button>
      </div>
    </div>

    <!-- Mensaje de comando ejecutado -->
    <div
      v-if="showCommandMessage"
      class="command-message"
      :class="{
        success: commandStatus === 'success',
        error: commandStatus === 'error',
        warning: commandStatus === 'warning'
      }"
    >
      {{ commandMessage }}  
    </div>
  </div>
</template>

<script>
import api from '../api/api';
import { normalizeCommand } from "@/utils/normalizeCommand.js";

export default {
  data() {
    return {
      showHelp: false,
      command: '',
      isListening: false,
      isButtonDisabled: false,
      recognition: null,
      recognitionTimeout: null,
      showCommandMessage: false,
      commandMessage: '',
    };
  },
  methods: {
    async startRecognition() {
      if (this.isListening) return; // Evita doble inicio
      this.isButtonDisabled = true; // Deshabilita el botón

      // Cancelar reconocimiento, de existir
      if (this.recognition) {
        this.recognition.abort();
        clearTimeout(this.recognitionTimeout);
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error('🎙️ API de reconocimiento de voz no soportada');
        alert("⚠️ Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.");
        this.isButtonDisabled = false;
        return;
      }

      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-ES';
      this.isListening = true;

      this.recognition.start();

      // Timeout de 5 segundos para cancelar si no se dice nada
      this.recognitionTimeout = setTimeout(() => {
        console.warn('⏳ No se detectó voz, deteniendo escucha...');
        this.stopRecognition();
      }, 5000); // 5 segundos

      this.recognition.onresult = async (event) => {
        clearTimeout(this.recognitionTimeout); // Si detecta voz, cancelamos timeout

        const originalCommand = event.results[0][0].transcript;

        this.command = normalizeCommand(originalCommand);

        //alert(`Comando de voz detectado: ${this.command}`);
        console.log("🎙️ Comando de voz detectado:", this.command);

        try {
          const response = await api.post("/devices/command", { command: this.command });

          if (!response.data.success) {
            throw new Error(response.data.message || "Error desconocido");
          }

          console.log("✅ Comando enviado con éxito");

          this.commandMessage = response.data.message;
          this.showCommandMessage = true;
        } catch (error) {
          console.error("❌ Error al enviar el comando:", error);

          const status = error.response?.status;
          const message = error.response?.data?.message || error.message || "Error desconocido";

          this.commandMessage = message;

          if (status === 400) {
            this.commandStatus = 'error';
          } else if (status === 403) {
            this.commandStatus = 'warning';
          } else {
            this.commandStatus = 'error';
          }
        }

        // Cancelar timeout anterior si existe
        if (this.messageTimeout) {
          clearTimeout(this.messageTimeout);
        }
        
        //Mostrar mensaje flotante y establecer timeout del mismo
        this.showCommandMessage = true;
        this.messageTimeout = setTimeout(() => {
          this.showCommandMessage = false;
          this.commandMessage = '';
          this.commandStatus = '';
          this.messageTimeout = null;
        }, 3000);

        this.stopRecognition();
      };

      this.recognition.onerror = (event) => {
        console.error("❌ Error de reconocimiento:", event.error);
        this.stopRecognition();
      };

      this.recognition.onend = () => {
        this.stopRecognition();
      };
    },

    stopRecognition() {
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch (e) {
          console.warn('⚠️ Intento de parar reconocimiento fallido:', e);
        }
      }
      clearTimeout(this.recognitionTimeout);
      this.isListening = false;
      this.recognition = null;
      this.isButtonDisabled = false; // Vuelve a habilitar el botón
    },
  }
};
</script>

<style scoped>
.voice-control {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  text-align: center;
}

.mic-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px; /* Espacio vertical entre iconos */
}

.help-icon {
  all: unset; /* Borra todos los estilos heredados o default */
  color: #666;
  font-size: 1.4rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition: transform 0.2s ease;
}

.help-icon:hover {
  transform: scale(1.1);
}

button {
  font-size: 1.2em;
  padding: 10px 20px;
  cursor: pointer;
}

/* Botón principal del micrófono */
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
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  transition: background 0.3s ease, box-shadow 0.3s ease;

  /* Mejoras para móviles */
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

/* Hover solo visible en escritorio */
.voice-btn:hover {
  background: #0056b3;
}

/* Elimina efectos de foco no deseados */
.voice-btn:focus {
  outline: none;
  box-shadow: none;
}

/* Estado "escuchando" con efecto breathing */
.breathing {
  background: #28a745 !important; /* Prioridad máxima para PWAs */
  animation: breathing 1.2s ease-in-out infinite;
}

@keyframes breathing {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 12px;
  max-width: 90%;
  width: 300px;
  text-align: left;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.modal-content h3 {
  margin-top: 0;
  margin-bottom: 10px;
}

.modal-content ul {
  list-style: none;
  padding: 0;
  font-size: 0.95rem;
}

.modal-content li {
  margin-bottom: 6px;
}

.modal-content button {
  margin-top: 15px;
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

/* Mensaje flotante de comando */
.command-message {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: #28a745;
  color: white;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
  animation: fadeInOut 3s forwards;
  z-index: 1001;
}

@keyframes fadeInOut {
  0%   { opacity: 0; transform: translateX(-50%) translateY(20px); }
  10%  { opacity: 1; transform: translateX(-50%) translateY(0); }
  90%  { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
}

.command-message.success {
  background: #28a745;
}

.command-message.error {
  background: #dc3545;
}

.command-message.warning {
  background: #ffc107;
  color: black;
}
</style>