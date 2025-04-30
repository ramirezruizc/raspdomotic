// Normalización de comandos de voz

// Reemplazos comunes de "por ciento"
const PERCENT_VARIANTS = [
    /\bporciento\b/gi,
    /\bpor ciento\b/gi,
    /\bpor\s*cien(to)?\b/gi
  ];
  
  // Números en letras a dígitos
  const NUMBER_WORDS = {
    "veinticinco": "25",
    "cincuenta": "50",
    "setenta y cinco": "75",
    "cien": "100",
    "ciento": "100"
  };
  
  // Reemplaza números escritos con palabras por sus equivalentes numéricos
  function replaceNumberWords(command) {
    for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      command = command.replace(regex, digit);
    }
    return command;
  }
  
  // Quitar acentos y espacios innecesarios
  function removeAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  
  // Normaliza el comando
  export function normalizeCommand(rawCommand) {
    let command = rawCommand.toLowerCase();
    command = removeAccents(command);
  
    // Reemplazo de expresiones de porcentaje
    PERCENT_VARIANTS.forEach(regex => {
      command = command.replace(regex, "%");
    });
  
    // Reemplazo de números escritos con palabras
    command = replaceNumberWords(command);
  
    // Eliminar espacios innecesarios entre número y símbolo
    command = command.replace(/(\d+)\s*%/g, "$1%");
  
    // Eliminar dobles espacios, si los hubiera
    command = command.replace(/\s\s+/g, " ").trim();
  
    return command;
  }