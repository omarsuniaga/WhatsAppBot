# 🎯 Guía Completa: Sistema de Triggers

## Descripción General

El **sistema de Triggers** permite activar automáticamente el bot de WhatsApp basándose en palabras clave que coincidan con los mensajes recibidos. Es ideal para:

- Activar respuestas automáticas basadas en patrones
- Controlar cuándo el bot debe procesar mensajes
- Organizar por categorías y prioridades
- Monitorear qué palabras clave generan más activaciones

---

## 📍 Cómo Acceder

### Opción 1: Acceso Directo (Recomendado)
1. Haz clic en **⋯** (tres puntitos) en la esquina superior derecha
2. Selecciona **"Triggers ⚡"**
3. ¡Listo! Se abre la gestión de triggers

### Opción 2: A través de Configuración
1. Haz clic en **⋯** → **"Ajustes generales"**
2. Se abre el panel de **Configuración**
3. En la lista de la izquierda, haz clic en **"Triggers ⚡"**

---

## 🎮 Interfaz de Usuario

### Estadísticas (Arriba)
```
┌─────────────────────────────────┐
│ Total | Activos | Inactivos     │
│  15   │   12    │      3        │
└─────────────────────────────────┘
```
Muestra:
- **Total**: Cantidad de triggers creados
- **Activos**: Triggers habilitados (en uso)
- **Inactivos**: Triggers deshabilitados

### Controles Globales
Botones para:
- **Activar todos**: Habilita todos los triggers de una vez
- **Desactivar todos**: Desactiva todos los triggers
- **Exportar triggers**: Descarga los triggers como archivo JSON

### Listener de Triggers
- Toggle para **habilitar/deshabilitar** el sistema completo
- Si está deshabilitado, ningún trigger funcionará
- Útil para pausar el bot temporalmente

### Probador de Triggers
```
Ingresa un mensaje... [ENVIAR]

Resultados:
✓ hola (contains)
✓ ayuda (contains)
```
Permite probar si un mensaje coincidiría con algún trigger activo.

### Lista de Triggers
Triggers organizados en dos secciones:
1. **Activos** (verde) - Se procesan cuando se recibe un mensaje
2. **Inactivos** (gris) - Se ignoran

---

## ➕ Crear un Nuevo Trigger

### Pasos
1. Haz clic en **"Nuevo Trigger"** (botón verde)
2. Completa el formulario:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Keyword** | Palabra clave a buscar | `hola`, `info`, `ayuda` |
| **Tipo de Coincidencia** | Cómo buscar la palabra | `exact`, `contains`, `startsWith`, `regex` |
| **Prioridad** | Orden de evaluación (mayor = primero) | `1`, `5`, `10` |
| **Categoría** | Agrupación (opcional) | `saludo`, `consulta` |
| **Descripción** | Notas sobre el trigger | `Resp. a saludos básicos` |
| **Distinguir mayúsculas** | ¿Diferenciar Hola/hola? | ✓ o ✗ |
| **Habilitado** | ¿Activar inmediatamente? | ✓ o ✗ |

3. Haz clic en **"Crear Trigger"**

### Tipos de Coincidencia

**exact** - Coincidencia exacta
```
Mensaje: "hola"
Trigger: "hola" ✓
Trigger: "hola mundo" ✗
```

**contains** - La palabra está en el mensaje
```
Mensaje: "hola mundo"
Trigger: "hola" ✓
Trigger: "mundo" ✓
```

**startsWith** - El mensaje comienza con la palabra
```
Mensaje: "hola mundo"
Trigger: "hola" ✓
Trigger: "mundo" ✗
```

**regex** - Patrón de expresión regular
```
Mensaje: "hola123"
Trigger: "hola\d+" ✓ (hola seguido de números)
```

---

## ✏️ Editar un Trigger

1. Haz clic en el trigger en la lista
2. Se expande mostrando detalles
3. Haz clic en **"Editar"**
4. Modifica los campos
5. Haz clic en **"Actualizar Trigger"**

---

## 🗑️ Eliminar un Trigger

1. Haz clic en el trigger en la lista
2. Se expande
3. Haz clic en **"Eliminar"** (botón rojo)
4. Confirma la acción

---

## 🔘 Activar/Desactivar

### Individual
1. Haz clic en el trigger
2. Haz clic en el icono **⚡** (Power)
3. Se activa/desactiva interactivamente

### Global
- Botón **"Activar todos"** en controles globales
- Botón **"Desactivar todos"** en controles globales

---

## 📊 Estadísticas y Monitoreo

Cada trigger muestra:
- **Coincidencias**: Cuántas veces se activó
- **Última activación**: Cuándo fue la última vez
- **Prioridad**: Orden de evaluación

Botones en la sección de estadísticas:
- **Botón "Estadísticas"**: Ver métricas globales
- **Botón "Resetear"**: Borrar contadores

---

## 📤 Importar/Exportar

### Exportar
1. Haz clic en **"Exportar triggers"**
2. Se descarga un archivo `triggers-YYYY-MM-DD.json`
3. Guarda para backup o compartir

### Importar
*Disponible en próximas versiones*

Formato esperado:
```json
[
  {
    "keyword": "hola",
    "matchType": "contains",
    "caseSensitive": false,
    "enabled": true,
    "description": "Saludo",
    "category": "greetings",
    "priority": 1
  }
]
```

---

## ⚙️ Casos de Uso Comunes

### Caso 1: Bot que responde a saludos
```
Trigger: "hola"
Tipo: contains
Habilitado: ✓

Cuando alguien escriba "Hola!", el bot responde automáticamente
```

### Caso 2: Filtrar solo consultas académicas
```
Trigger: "calificaciones|horario|tareas"
Tipo: regex
Habilitado: ✓

Solo responde a mensajes sobre temas académicos
```

### Caso 3: Sistema con prioridades
```
Priority 10: "emergencia|urgente"      ← Se evalúa primero
Priority 5:  "consulta|pregunta"
Priority 1:  "hola|buenos días"        ← Se evalúa al final
```

---

## 🔍 Solución de Problemas

**P: El bot no responde a mis mensajes**
- Verifica que el listener esté habilitado (toggle en verde)
- Comprueba que los triggers estén activos (verde en la lista)
- Usa el probador de triggers para verificar coincidencias
- Revisa la consola del servidor para errores

**P: El trigger regex no funciona**
- Verifica la sintaxis de expresión regular
- Prueba con una herramienta online (regex101.com)
- Usa `/` solo en los endpoints, no en el panel

**P: Demasiados triggers se activan**
- Aumenta la **prioridad** de los más importantes
- Usa **regex** para más especificidad
- Considera cambiar tipo a **exact** o **startsWith**

**P: Quiero pausar todo sin eliminar**
- Haz clic en **"Desactivar todos"**
- O desactiva el listener desde el toggle global

---

## 📱 Respuestas Automáticas

Los triggers funcionan con el sistema de **Respuestas Automáticas** del bot:

1. **Se recibe un mensaje**
2. **Sistema de Triggers** verifica coincidencias
3. Si hay coincidencia → **BotService** procesa automáticamente
4. Se envía respuesta según configuración de KB

---

## 🚀 Tips Avanzados

### Optimizar con Prioridades
```
Priority 100: Palabras exactas de emergencia
Priority 50:  Palabras clave principales
Priority 10:  Palabras de interés general
Priority 1:   Palabras de fallback
```

### Combinar con Categorías
```
Categoría "soporte":    ayuda, problema, error
Categoría "ventas":     precio, presupuesto, costo
Categoría "académico":  calificación, asignatura
```

### Usar Regex para Contexto
```
Patrón: "bot\s+(on|off)"
Coincide: "bot on", "bot  on", "bot off"
No coincide: "botobot", "boton"
```

---

## 📞 Soporte

Para reportar problemas o sugerencias, contacta al equipo de desarrollo.

**Versión**: 1.0  
**Última actualización**: Febrero 2026
