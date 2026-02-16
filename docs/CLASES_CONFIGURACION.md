# Script para Crear Clases de Prueba

Este script añadirá clases de ejemplo para probar el sistema de recordatorios diarios.

## Clases de Prueba para Hoy (Lunes)

### 1. Violín Básico
- **Profesor:** María González
- **Horario:** Lunes y Miércoles 3:00 PM - 4:00 PM
- **Salón:** A-101
- **Instrumento:** Violín
- **Grupo:** Iniciación Musical

### 2. Piano Intermedio
- **Profesor:** Carlos Rodríguez
- **Horario:** Lunes y Viernes 4:00 PM - 5:00 PM
- **Salón:** B-205
- **Instrumento:** Piano
- **Grupo:** Programa Piano

### 3. Guitarra Avanzada
- **Profesor:** Ana Martínez
- **Horario:** Lunes y Jueves 5:00 PM - 6:00 PM
- **Salón:** C-150
- **Instrumento:** Guitarra
- **Grupo:** Programa Guitarra

### 4. Canto Coral
- **Profesor:** Luis Hernández
- **Horario:** Lunes y Miércoles 6:00 PM - 7:00 PM
- **Salón:** Auditorio
- **Instrumento:** Voz
- **Grupo:** Programa Coral

### 5. Percusión Básica
- **Profesor:** Pedro Sánchez
- **Horario:** Martes y Jueves 3:00 PM - 4:00 PM
- **Salón:** D-301
- **Instrumento:** Percusión
- **Grupo:** Iniciación Musical

### 6. Teoría Musical
- **Profesor:** Sofía López
- **Horario:** Miércoles 5:00 PM - 6:00 PM
- **Salón:** E-200
- **Instrumento:** Teoría
- **Grupo:** General

## Mensaje de Recordatorio Esperado

Con estas clases, el sistema debería generar un mensaje como:

```
🎻 *RECORDATORIO GENERAL - El Sistema Punta Cana*

📅 Lunes 9 de febrero de 2026

🎵 *Clases del Día:*
• Violín Básico - 3:00 PM - Salón A-101
• Piano Intermedio - 4:00 PM - Salón B-205
• Guitarra Avanzada - 5:00 PM - Salón C-150
• Canto Coral - 6:00 PM - Auditorio

📚 *Recordatorios Importantes:*
• Llegar 10 minutos antes de cada clase
• Traer sus instrumentos y materiales
• Practicar en casa diariamente

💪 *Motivación:*
"La música es el lenguaje universal del espíritu. ¡Sigue adelante!"

🎶 *El Sistema Punta Cana - Transformando vidas a través de la música*
```

## Estado Actual del Sistema

✅ **Backend API:** Funcionando en http://localhost:3001
✅ **Frontend:** Funcionando en http://localhost:3001 (servido estáticamente)
✅ **Generación de mensajes:** Funcionando (con fallback cuando no hay clases)
⚠️ **Datos de clases:** Vacíos (necesita configuración)
✅ **Groq API:** Configurada pero necesita validación
✅ **Sistema de aprendizaje:** Funcionando pero sin datos

## Pasos para Completar Configuración

1. **Añadir clases** al sistema a través del dashboard de administración
2. **Probar Groq** con un mensaje simple
3. **Validar el flujo completo** con las nuevas clases
4. **Configurar grupos** de WhatsApp objetivos
5. **Activar modo automático** después de pruebas manuales

## Ubicación de Componentes de Testing

Los componentes de testing están disponibles en:
- **AttendanceControlPage.tsx** - Página principal con pestañas
- **Live Test Tab** - Dashboard de monitoreo en tiempo real
- **Testing Tab** - Suite de pruebas automatizadas
- **Debug Tab** - Herramientas de diagnóstico

Para acceder:
1. Ir a http://localhost:5174 (o el puerto que esté usando)
2. Navegar a "Control de Asistencias"
3. Las pestañas deberían aparecer en la parte superior de la página