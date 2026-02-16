/**
 * viewDescriptions.ts - Proporciona descripciones e información de ayuda para cada vista
 * Este archivo centraliza toda la información de ayuda del sistema
 */

export interface ViewInfo {
  title: string;
  description: string;
  tips?: string[];
  shortcut?: string;
}

export const VIEW_DESCRIPTIONS: Record<string, ViewInfo> = {
  // ===== DASHBOARD =====
  dashboard: {
    title: '📊 Panel Principal',
    description:
      'Este es el corazón del sistema. Aquí encontrarás un resumen rápido de todas las actividades, estadísticas importantes y accesos directos a las herramientas más utilizadas.',
    tips: [
      'Haz clic en cualquier tarjeta para acceder a esa sección',
      'Los números en rojo indican alertas o tareas pendientes',
      'Puedes refrescar los datos haciendo clic en el botón de circular',
      'Las gráficas se actualizan automáticamente cada 5 minutos',
    ],
    shortcut: 'Ctrl + H',
  },

  // ===== CHATS =====
  chats: {
    title: '💬 Chats y Conversaciones',
    description:
      'Aquí puedes ver y gestionar todas las conversaciones con usuarios a través de WhatsApp. Incluye tickets de soporte, preguntas frecuentes respondidas automáticamente y conversaciones pendientes.',
    tips: [
      'Los mensajes sin leer aparecen con un punto azul',
      'Usa la barra de búsqueda para encontrar conversaciones por nombre o número',
      'Puedes asignar chats a diferentes miembros del equipo',
      'Las respuestas automáticas se marcan con un icono de 🤖',
    ],
  },

  // ===== ESTUDIANTES =====
  students: {
    title: '👨‍🎓 Gestión de Estudiantes',
    description:
      'Panel completo para administrar información de estudiantes, incluyendo datos personales, asistencia, evaluaciones y estado académico. Puedes agregar, editar o eliminar registros de estudiantes.',
    tips: [
      'Haz clic en un estudiante para ver su perfil completo',
      'Usa filtros por nivel, estado o grupo para encontrar rápidamente',
      'Puedes exportar listados a Excel usando el botón de descarga',
      'Los estudiantes en rojo están en estado de alerta académica',
    ],
  },

  // ===== ASISTENCIA =====
  attendance: {
    title: '✅ Registro de Asistencia',
    description:
      'Controla la asistencia de estudiantes en clases y actividades. Marca presentes, ausentes, tardes o justificadas. Visualiza reportes y estadísticas de asistencia por período.',
    tips: [
      'Puedes marcar asistencia manualmente o importar de un archivo Excel',
      'El botón "Marcar Todos" te ahorra tiempo en clases grandes',
      'Los inconsisten incorrectos pueden descartarse con el ícono de X',
      'Genera reportes mensuales para enviar a padres',
    ],
  },

  // ===== ALERTAS DE ASISTENCIA =====
  attendanceAlerts: {
    title: '🚨 Alertas de Asistencia',
    description:
      'Monitorea alertas automáticas sobre estudiantes con baja asistencia o patrones sospechosos. El sistema identifica automáticamente problemas y genera notificaciones.',
    tips: [
      'Las alertas roja requieren acción inmediata',
      'Puedes marcar alertas como "resuelta" cuando tomes acción',
      'Usa los filtros para enfocarte en un grupo específico',
      'Exporta reportes de alertas para documentación',
    ],
  },

  // ===== DOCENTES =====
  teachers: {
    title: '👨‍🏫 Gestión de Docentes',
    description:
      'Panel para administrar información de docentes, horarios, asignaciones de clases y evaluaciones que realizan. Incluye contacto y disponibilidad.',
    tips: [
      'Cada docente tiene un perfil con su especialidad y horarios',
      'Puedes ver el historial de clases impartidas',
      'Las evaluaciones pendientes aparecen en el cuadro de pendientes',
      'Sincroniza calendarios para evitar conflictos de horarios',
    ],
  },

  // ===== CLASES =====
  classes: {
    title: '📚 Gestión de Clases',
    description:
      'Organiza y administra todas las clases, incluyendo schedule, docentes asignados, estudiantes inscritos y contenido. Puedes crear nuevas clases o modificar existentes.',
    tips: [
      'El código de clase es único y se usa para inscribir estudiantes',
      'Cada clase debe tener un docente responsable asignado',
      'Puedes duplicar clases semestres anteriores para ahorrar tiempo',
      'Las clases sin estudiantes aparecen marcadas en gris',
    ],
  },

  // ===== HORARIOS =====
  schedule: {
    title: '📅 Gestión de Horarios',
    description:
      'Visualiza y administra horarios de clases, actividades y eventos. Asegúrate de que no haya conflictos y que todos sepan cuándo ocurren las actividades.',
    tips: [
      'Los conflictos de horario se resaltan en color rojo',
      'Puedes cambiar la vista a día, semana o mes según necesites',
      'Arrastra eventos para reprogramarlos rápidamente',
      'Exporta el horario para imprimirlo o compartirlo',
    ],
  },

  // ===== SALAS =====
  rooms: {
    title: '🏛️ Gestión de Salas/Espacios',
    description:
      'Administra los espacios físicos disponibles: aulas, laboratorios, salas de música, etc. Incluyen capacidad, recursos y disponibilidad.',
    tips: [
      'Verifica la capacidad antes de asignar una sala a una clase grande',
      'Las salas están marcadas en rojo si tienen mantenimiento',
      'Puedes reservar salas para actividades especiales',
      'Cada sala debe tener un responsable de limpieza asignado',
    ],
  },

  // ===== BASE DE CONOCIMIENTO =====
  knowledgeBase: {
    title: '📖 Base de Conocimiento (FAQs)',
    description:
      'Crea y administra las preguntas frecuentes que el sistema responde automáticamente. El bot busca en esta base para responder preguntas de WhatsApp sin intervención humana.',
    tips: [
      'Organiza preguntas por categorías para mejor comprensión',
      'Usa palabras clave relevantes para que el sistema encuentre respuestas',
      'Agrega múltiples variaciones de la misma pregunta para mejorar la detección',
      'El sistema aprende automáticamente de las respuestas humanas a alertas',
      'Las FAQs con mayor "usageCount" son las más consultadas — revísalas periódicamente',
    ],
  },

  // ===== BROADCAST =====
  broadcast: {
    title: '📢 Mensajes Masivos (Broadcast)',
    description:
      'Envía mensajes a múltiples usuarios simultáneamente. Puedes crear campañas, programarlas para una fecha/hora específica, y el sistema las ejecutará automáticamente.',
    tips: [
      'Crea una LISTA DE CONTACTOS antes de crear una campaña',
      'Programa campañas con la opción "Programar" para envío automático (horario permitido: 8am-8pm)',
      'Las campañas programadas se ejecutan automáticamente — no necesitas estar conectado',
      'Si el servidor se reinicia, las campañas perdidas (menos de 24h) se ejecutan al arrancar',
      'Los mensajes se envían con delay de 2-5 segundos entre cada uno para evitar bloqueos de WhatsApp',
      'Usa PLANTILLAS para mensajes frecuentes con variables como {nombre}',
    ],
  },

  // ===== TICKETS/ESCALACIÓN =====
  tickets: {
    title: '🎫 Tickets / Preguntas Sin Responder',
    description:
      'Cuando el bot no puede responder una pregunta de WhatsApp, crea automáticamente un ticket aquí. Al responder un ticket, el mensaje se envía al cliente Y el sistema puede aprender la respuesta para futuras consultas.',
    tips: [
      'Los tickets se crean automáticamente cuando el bot no encuentra respuesta en la KB',
      'Al responder, marca "Aprender de esta respuesta" para que el bot aprenda automáticamente',
      'Los tickets con prioridad ALTA (quejas, emergencias) aparecen primero',
      'Los tickets expiran después de 24 horas si no se responden',
      'Usa "Ver agrupadas" para identificar preguntas frecuentes sin respuesta',
      'Máximo 5 alertas por chat por hora (protección anti-spam)',
    ],
  },

  // ===== CONTACTOS =====
  contacts: {
    title: '📇 Gestión de Contactos',
    description:
      'Directorio centralizado de todos los contactos: estudiantes, docentes, padres, administrativos. Incluye teléfonos, emails y información de contacto adicional.',
    tips: [
      'Los contactos sin número de WhatsApp aparecen en gris',
      'Puedes importar contactos masivamente desde Excel',
      'Usa la búsqueda para encontrar rápidamente por nombre o número',
      'Exporta grupos de contactos para comunicaciones específicas',
    ],
  },

  // ===== CONFIGURACIÓN =====
  settings: {
    title: '⚙️ Configuración del Sistema',
    description:
      'Configura opciones globales del sistema, incluyendo la clave de Gemini AI, nombre del negocio, tono de respuestas y sistema de escalación.',
    tips: [
      'Configura la API Key de Gemini para habilitar respuestas inteligentes por IA',
      'Sin Gemini, el bot solo responde desde la Base de Conocimiento (FAQs)',
      'El "Tono de Respuestas" afecta cómo el bot se comunica (profesional, amigable, formal)',
      'La "Asignación Automática" asigna tickets a administradores automáticamente',
      'Asegúrate de guardar cambios con el botón al final de la página',
    ],
  },

  // ===== EVALUACIÓN =====
  evaluations: {
    title: '📝 Evaluaciones y Calificaciones',
    description:
      'Registra evaluaciones de estudiantes incluyendo calificaciones, rúbricas y retroalimentación. El sistema calcula promedios automáticamente.',
    tips: [
      'Puedes subir evaluaciones en lote importando un archivo Excel',
      'Las rúbricas ayudan a mantener consistencia en calificaciones',
      'Descarga reportes de calificaciones para entregarlos a padres',
      'El sistema previene cambios de calificaciones anteriores automáticamente',
    ],
  },

  // ===== AUTOMATIZACIONES =====
  automations: {
    title: '🤖 Automatizaciones (Flujos)',
    description:
      'Configura reglas automáticas que ejecutan acciones cuando ocurren ciertos eventos. Por ejemplo: enviar alerta cuando un estudiante falta 3 días seguidos.',
    tips: [
      'Las automatizaciones se verifican cada 5 minutos',
      'Puedes desactivar una automatización sin borrarla',
      'Prueba con un grupo pequeño antes de generalizar',
      'Mantén un log de automatización activas para referencia',
    ],
  },

  // ===== PLANTILLAS =====
  templates: {
    title: '📄 Plantillas de Mensajes',
    description:
      'Crea y administra plantillas de mensajes reutilizables. Úsalas en broadcast, respuestas automáticas o comunicaciones frecuentes.',
    tips: [
      'Las variables como {nombre} se reemplazan automáticamente',
      'Prueba plantillas antes de usarlas en producción',
      'Agrupa plantillas por categoría para encontrar fácilmente',
      'El historial muestra cuántas veces se ha usado cada plantilla',
    ],
  },

  // ===== CONFLICTOS DE RESOLUCIÓN =====
  conflictResolution: {
    title: '⚖️ Resolución de Conflictos',
    description:
      'Registra y gestiona conflictos o discrepancias reportadas en el sistema. Útil para documentar y resolver problemas administrativos.',
    tips: [
      'Documenta todos los detalles del conflicto con fecha y hora',
      'Asigna responsables de resolver cada conflicto',
      'Genera reportes mensuales de conflictos para análisis',
      'Mantén comunicación clara con todas las partes involucradas',
    ],
  },

  // ===== PÁGINA DE DIAGNÓSTICO =====
  diagnostic: {
    title: '🔧 Herramientas de Diagnóstico',
    description:
      'Panel de diagnóstico técnico para verificar el estado del sistema, revisar logs y solucionar problemas. Acceso solo para administradores.',
    tips: [
      'Revisa los logs regularmente para identificar problemas temprano',
      'La comprobación de estado muestra si hay servicios caídos',
      'Exporta logs para análisis detallado',
      'Usa esta herramienta para reportar problemas al equipo técnico',
    ],
  },

  // ===== LOGIN =====
  login: {
    title: '🔐 Inicio de Sesión',
    description:
      'Accede al sistema con tus credenciales. Si olvidaste tu contraseña, puedes usar la opción de recuperación.',
    tips: [
      'Tus credenciales son personales y confidenciales',
      'No compartas tu contraseña con nadie',
      'Si olvidas tu contraseña, contacta al administrador del sistema',
      'Tu sesión expira después de 30 minutos de inactividad',
    ],
  },

  // ===== REGISTRO =====
  register: {
    title: '📝 Registro de Nueva Cuenta',
    description:
      'Crea una nueva cuenta en el sistema. Necesitarás proporcionar información básica y esperar aprobación del administrador.',
    tips: [
      'Usa un email válido y activo',
      'Tu contraseña debe tener al menos 8 caracteres',
      'Incluye números y caracteres especiales en la contraseña',
      'Recibirás un email de confirmación cuando tu cuenta sea aprobada',
    ],
  },
};
