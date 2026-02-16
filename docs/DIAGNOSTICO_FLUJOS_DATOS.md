# 🔍 DIAGNÓSTICO: Flujos de Datos del Sistema Completo

> **Objetivo:** Evaluar qué está DEFINIDO, qué está VAGO y qué FALTA en nuestro diseño
> **Fecha:** 2025-01-29
> **Estado:** ANÁLISIS DE INTEGRIDAD

---

## 📊 MATRIZ DE EVALUACIÓN: FLUJOS DE DATOS

### ESCALA
```
🟢 DEFINIDO    = Claro, paso a paso, en documentos
🟡 VAGO        = Mencionado pero sin detalles
🔴 FALTA       = No está en documentos, necesita diseño
```

---

## 1️⃣ FLUJO DIARIO: ANTES DE CLASE

### 1.1 Comunicación de Horario Diario (Guillermo → FLOTA)

**¿QUÉ ES?**
Guillermo envía mensaje a FLOTA con clases del día (horarios, salones, maestros, alumnos)

```
ESTADO: 🟢 DEFINIDO (en Doc #1, #6)

FLUJO DEFINIDO:
├─ 08:50 AM: Guillermo revisa cambios en plataforma
├─ Sistema sugiere mensaje (personalizado por grupo)
├─ Guillermo aprueba
├─ Bot envía a las 09:00 AM
└─ Representantes reciben

DETALLE:
├─ ¿Qué datos incluye el mensaje?
│  └─ ✅ Clases del día, horarios, salones, maestros, lista alumnos
│
├─ ¿De dónde obtiene esa información?
│  └─ 🟡 VAGO: ¿De una base de datos? ¿De un formulario de Guillermo?
│
├─ ¿Cómo detecta cambios desde ayer?
│  └─ 🟡 VAGO: ¿Hay sistema de versiones? ¿Comparación automática?
│
└─ ¿Qué pasa si hay cambios urgentes a las 12:00?
   └─ 🟡 VAGO: ¿Envía otro mensaje? ¿Cómo avisa a maestros?

ACCIONES NECESARIAS:
├─ [ ] Definir estructura de "CLASE DEL DÍA" en Firebase
├─ [ ] Definir cómo se detectan cambios
├─ [ ] Definir protocolo para cambios urgentes
└─ [ ] Definir si maestros reciben mensaje separado
```

### 1.2 Obtención de Lista de Alumnos

**¿QUÉ ES?**
Sistema obtiene lista de alumnos para cada clase

```
ESTADO: 🔴 FALTA DEFINIR

FLUJO FALTANTE:
├─ ¿De dónde vienen los alumnos inscritos?
│  ├─ ¿Firebase?
│  ├─ ¿Tabla de inscripciones?
│  └─ ¿Admin manual?
│
├─ ¿Cómo sabe cuál alumno va a qué clase?
│  ├─ ¿Relación maestro-grupo-alumno?
│  └─ ¿Cómo se actualiza si hay cambio?
│
├─ ¿Qué pasa si alumno se inscribe a última hora?
│  └─ ¿Aparece en lista del día siguiente o mismo día?
│
├─ ¿Qué pasa si alumno cancela?
│  └─ ¿Se remueve de lista? ¿A qué hora?
│
└─ ¿Maestro ve lista diferente a la que Guillermo envía?
   └─ 🤔 PROBLEMA POTENCIAL

ACCIONES NECESARIAS:
├─ [ ] Definir estructura de "INSCRIPCIÓN" en Firebase
├─ [ ] Definir relaciones: Grupo-Maestro-Alumno
├─ [ ] Definir cuándo se genera "lista del día"
├─ [ ] Definir cómo cambios de última hora se reflejan
└─ [ ] Definir si lista de Guillermo = lista de maestro
```

---

## 2️⃣ FLUJO DIARIO: DURANTE CLASE

### 2.1 Maestro Llena Asistencia en App

**¿QUÉ ES?**
Maestro marca presentes/ausentes/tardíos en app, agrega notas

```
ESTADO: 🟢 DEFINIDO (en Doc #5, #6)

FLUJO DEFINIDO:
├─ Maestro abre app
├─ Clase se activa automáticamente
├─ Sistema carga lista de alumnos
├─ Maestro marca estado (presente, ausente, tardío, justificado)
├─ Maestro agrega notas
└─ Maestro presiona "Guardar"

DETALLE PENDIENTE:
├─ ¿Cuál es la estructura JSON EXACTA?
│  └─ 🟡 VAGO: Tenemos ejemplo general, pero ¿propiedades exactas?
│
├─ ¿Cómo el maestro SABE cuáles están justificados ANTES de marcar?
│  └─ 🟡 VAGO: ¿App busca en Firebase? ¿API sincroniza?
│
├─ ¿Qué pasa si hay discrepancia entre lista esperada y alumnos reales?
│  └─ 🔴 FALTA: ¿Protocolo de acción?
│
├─ ¿Cuándo el maestro agrega etiquetas, a quién se asignan?
│  └─ 🟡 VAGO: ¿Etiqueta global de clase O etiqueta por alumno?
│
├─ ¿Cómo se almacenan las "notas de clase" (descripción, observaciones)?
│  └─ 🟡 VAGO: ¿En un campo texto? ¿Con estructura?
│
└─ ¿Qué validaciones hay antes de guardar?
   └─ 🟡 VAGO: ¿Todos deben tener estado? ¿O solo los presentes/ausentes?

ACCIONES NECESARIAS:
├─ [ ] Definir estructura JSON EXACTA (de tu app maestros)
├─ [ ] Definir cómo app maestros obtiene justificaciones
├─ [ ] Definir validaciones antes de guardar
├─ [ ] Definir si etiquetas son globales o por alumno
├─ [ ] Definir almacenamiento de notas libres
└─ [ ] Definir protocolos si hay alumnos inesperados
```

### 2.2 Maestro Agrega Evaluación/Observaciones Individual

**¿QUÉ ES?**
Maestro deja registro de cómo estuvo cada alumno (progreso, comportamiento, etc.)

```
ESTADO: 🟡 VAGO

FLUJO VAGO:
├─ ¿Cuándo se agrega? (¿durante clase o después?)
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Qué campos incluye?
│  ├─ Calificación (1-5)?
│  ├─ Comentario libre?
│  ├─ Etiquetas predefinidas?
│  └─ 🔴 SIN DEFINIR ESTRUCTURA
│
├─ ¿Se ve en tiempo real en dashboard de Guillermo?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Los representantes ven esa información?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Se acumula para un "reporte de progreso"?
│  └─ 🟡 MENCIONADO pero sin detalles de cómo
│
└─ ¿Hay relación con las calificaciones formales?
   └─ 🔴 SIN DEFINIR

ACCIONES NECESARIAS:
├─ [ ] Definir estructura de "ReporteMaestro"
├─ [ ] Definir qué campos son obligatorios vs opcionales
├─ [ ] Definir cuándo se agrega
├─ [ ] Definir quién tiene acceso a leerlo
├─ [ ] Definir si genera alertas automáticas
└─ [ ] Definir periodicidad (por clase, acumulado, etc)
```

---

## 3️⃣ FLUJO DIARIO: AUSENCIAS EN WHATSAPP

### 3.1 Representante Reporta Ausencia en FLOTA

**¿QUÉ ES?**
Representante escribe en grupo que su hijo no viene

```
ESTADO: 🟢 DEFINIDO (en Doc #2, #6)

FLUJO DEFINIDO:
├─ Bot detecta palabras clave ("no viene", "enfermo", etc.)
├─ Bot envía privado al representante
├─ Bot pide detalles (motivo)
├─ Representante responde
├─ Bot guarda en Firebase
└─ Alerta creada automáticamente

DETALLE PENDIENTE:
├─ ¿Si el representante responde en el grupo (no privado), qué pasa?
│  └─ 🟡 VAGO: ¿El bot aún lo captura? ¿Qué prioridad?
│
├─ ¿Si hay múltiples representantes del mismo alumno?
│  └─ 🔴 FALTA: ¿Cuál se prioriza? ¿Se duplica?
│
├─ ¿Cómo se marca como "resuelto" si el alumno asiste finalmente?
│  └─ 🟡 VAGO: ¿Bot acepta "actualización"?
│
└─ ¿Qué datos EXACTOS se guardan en Firebase?
   └─ 🟡 VAGO: Tenemos estructura pero no todas las propiedades

ACCIONES NECESARIAS:
├─ [ ] Definir protocolo si reporta en grupo vs privado
├─ [ ] Definir qué hacer con múltiples representantes
├─ [ ] Definir cómo se actualiza si cambia la ausencia
└─ [ ] Confirmar estructura JSON exacta en Firebase
```

### 3.2 Bot Busca Automáticamente Justificaciones Si Alumno Está Ausente

**¿QUÉ ES?**
Si no hay reporte en WhatsApp pero maestro marca ausente, bot contacta representante

```
ESTADO: 🟢 DEFINIDO (en Doc #5, #6)

FLUJO DEFINIDO:
├─ Maestro marca alumno ausente
├─ Sistema verifica: ¿Hay justificación en WhatsApp?
├─ Si NO hay: Bot contacta representante automáticamente
├─ Representante responde
└─ Se actualiza registró

DETALLE PENDIENTE:
├─ ¿Cuándo exactamente se envía el mensaje?
│  ├─ ¿Inmediatamente después de que maestro guarda?
│  ├─ ¿15 minutos después de clase?
│  └─ 🟡 VAGO: Timing no está claro
│
├─ ¿Qué ocurre si representante no responde?
│  ├─ ¿Guillermo ve alerta?
│  ├─ ¿Hay segundo intento?
│  └─ 🔴 FALTA: Protocolo de follow-up
│
└─ ¿Se suma al contador de ausencias SIN justificar hasta que responda?
   └─ 🟡 VAGO: ¿Cuándo se actualiza el estado?

ACCIONES NECESARIAS:
├─ [ ] Definir timing exacto del mensajebot
├─ [ ] Definir protocolo si no responde
├─ [ ] Definir si contador es dinámico o definitivo
└─ [ ] Definir cuándo se marca como "resuelta"
```

---

## 4️⃣ FLUJO: SINCRONIZACIÓN AUSENCIAS ↔️ ASISTENCIA

### 4.1 Comparación Automática

**¿QUÉ ES?**
Sistema compara lo que dice WhatsApp vs lo que dice maestro

```
ESTADO: 🟢 DEFINIDO (en Doc #5, #6)

FLUJO DEFINIDO:
├─ Maestro guarda asistencia
├─ Sistema busca ausencias en WhatsApp
├─ Compara estados:
│  ├─ Caso A: Coinciden (ambos ausente) → Marcar como confirmada
│  ├─ Caso B: Discrepancia (ausencia reportada, pero asistió) → ALERTA
│  └─ Caso C: Ausencia sin reportar → ALERTA
│
└─ Guilllermo ve alerta en dashboard

DETALLE PENDIENTE:
├─ ¿Cuál toma prioridad: Bot o Maestro?
│  └─ 🟡 VAGO: Si contradicen, ¿quién gana?
│
├─ ¿Cómo se resuelven discrepancias?
│  ├─ ¿Guillermo decide manualmente?
│  ├─ ¿Hay lógica automática?
│  └─ 🔴 FALTA: Protocolo de resolución
│
├─ ¿Se crea un AUDIT TRAIL de cambios?
│  └─ 🔴 FALTA: ¿Quién cambió qué y cuándo?
│
└─ ¿Representante es notificado de discrepancias?
   └─ 🔴 FALTA: ¿Comunicación de vuelta al representante?

ACCIONES NECESARIAS:
├─ [ ] Definir jerarquía: ¿Quién tiene razón? ¿Maestro o bot?
├─ [ ] Definir protocolo de resolución
├─ [ ] Definir quién ve audit trail
├─ [ ] Definir notificaciones a representantes
└─ [ ] Definir si discrepancia bloquea ciertos procesos
```

---

## 5️⃣ FLUJO: CONTADORES Y ALERTAS INTELIGENTES

### 5.1 Conteo de Ausencias por Alumno

**¿QUÉ ES?**
Sistema mantiene registro de cuántas veces falte cada alumno

```
ESTADO: 🟡 VAGO

FLUJO VAGO:
├─ ¿Cuándo se actualiza el contador?
│  ├─ ¿Cada vez que maestro marca ausente?
│  ├─ ¿Solo si está confirmada (sincronizada)?
│  ├─ ¿Al final del día?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Se cuentan diferente ausencias justificadas vs no justificadas?
│  └─ 🟡 MENCIONED pero sin detalles
│
├─ ¿Período de análisis?
│  ├─ ¿Por semana?
│  ├─ ¿Por mes?
│  ├─ ¿Por trimestre?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Cómo se inicializa? (¿enero empieza en 0 o hereda del año anterior?)
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Se guardan datos históricos para comparación?
│  └─ 🔴 FALTA: "Enero 2024 vs Enero 2025"
│
└─ ¿Existen tasas de asistencia por grupo?
   └─ 🔴 FALTA: Agregación de datos

ACCIONES NECESARIAS:
├─ [ ] Definir estructura de ContadorAusencias en Firebase
├─ [ ] Definir cuándo se actualiza
├─ [ ] Definir periodicidad (semana, mes, etc.)
├─ [ ] Definir si se diferencian justificadas/no justificadas
├─ [ ] Definir almacenamiento histórico
└─ [ ] Definir reportes de asistencia por grupo
```

### 5.2 Disparadores de Alertas (Reglas Inteligentes)

**¿QUÉ ES?**
Sistema crea alertas cuando se cumplen ciertas condiciones

```
ESTADO: 🟡 VAGO

ALERTAS DEFINIDAS (en Doc #1):
├─ 🔴 Ausencias excesivas (4+ en 2 semanas) → ALERTA
├─ 🟡 Patrón sospechoso (solo lunes, ej.) → ALERTA
├─ 🟡 Cambio de patrón (cambio repentino) → ALERTA
└─ 🟡 Asistencia no llenada (30 min después clase) → ALERTA

DETALLE FALTANTE:
├─ ¿Umbrales exactos?
│  ├─ ¿4 en 2 semanas, 5 en 4, 10 en mes? ¿Flexible?
│  └─ 🔴 SIN CONFIRMAR
│
├─ ¿Patrón sospechoso = qué exactamente?
│  ├─ ¿Solo lunes?
│  ├─ ¿Antes de fin de semana?
│  ├─ ¿Alternado?
│  └─ 🔴 NECESITA DEFINICIÓN MÁS CLARA
│
├─ ¿Cambio de patrón = variación de qué porcentaje?
│  ├─ ¿De 1 ausencia/mes a 3/mes es cambio?
│  ├─ ¿Necesita aumento de 50%?
│  └─ 🔴 SIN NÚMERO
│
├─ ¿Hay otras alertas que falta definir?
│  ├─ ¿Ausencia NO justificada > X días?
│  ├─ ¿Ausencias de múltiples alumnos (epidemia)?
│  ├─ ¿Maestro llena mal asistencia (patrones)?
│  └─ 🔴 POSIBLES pero no mencionadas
│
├─ ¿Quién ve cada alerta?
│  ├─ ¿Guillermo?
│  ├─ ¿Maestro?
│  ├─ ¿Representante?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Qué acción se recomienda automáticamente?
│  └─ 🔴 VAGO: "Sugerir contacto" no es específico
│
└─ ¿Se cierra alerta automáticamente o manual?
   └─ 🔴 SIN DEFINIR

ACCIONES NECESARIAS:
├─ [ ] Definir umbrales exactos para CADA tipo de alerta
├─ [ ] Definir criterios matemáticos para patrones
├─ [ ] Enumerar TODAS las alertas posibles
├─ [ ] Definir quién ve cada alerta
├─ [ ] Definir acciones recomendadas específicas
├─ [ ] Definir cómo se resuelven (manual o automática)
└─ [ ] Definir notificaciones (qué, a quién, cuándo)
```

---

## 6️⃣ FLUJO: MODERATION DE FLOTA

### 6.1 Clasificación Automática de Mensajes

**¿QUÉ ES?**
Bot detecta tipo de mensaje y toma acción apropiada

```
ESTADO: 🟢 DEFINIDO (en Doc #2, #6)

FLUJO DEFINIDO:
├─ 8 categorías: Ausencia, FAQ, Inscripción, Pago, Problema, Spam, Ruido, Indeterminado
├─ Cada categoría tiene acción diferente
└─ Se registra para análisis

DETALLE PENDIENTE:
├─ ¿Confianza de clasificación?
│  ├─ ¿Qué ocurre si confianza = 50%?
│  ├─ ¿Crear ticket o esperar?
│  └─ 🟡 VAGO: Threshold no está claro
│
├─ ¿Aprendizaje del bot?
│  ├─ ¿Se mejora con tiempo?
│  ├─ ¿Guillermo puede corregir clasificaciones?
│  └─ 🔴 MENCIONADO en doc pero sin detalles
│
├─ ¿False positives/negatives?
│  ├─ ¿Qué pasa si bot responde FAQ pero era ticket importante?
│  ├─ ¿Quién lo detecta?
│  └─ 🔴 FALTA: Protocolo de recuperación
│
└─ ¿Rate limiting?
   ├─ ¿Si persona envía 10 mensajes seguidos?
   ├─ ¿Bot responde a todos?
   └─ 🟡 MENCIONADO pero sin detalle

ACCIONES NECESARIAS:
├─ [ ] Definir umbrales de confianza para cada categoría
├─ [ ] Definir qué pasa en zona gris (confianza 50-70%)
├─ [ ] Definir protocolo de aprendizaje
├─ [ ] Definir cómo detectar y recuperarse de errores
├─ [ ] Definir rate limiting exacto
└─ [ ] Definir monitoring de bot accuracy
```

### 6.2 Respuestas Automáticas (FAQs)

**¿QUÉ ES?**
Bot responde preguntas frecuentes sin intervención

```
ESTADO: 🟡 VAGO

FLUJO VAGO:
├─ ¿Base de conocimiento centralizada?
│  ├─ 15 FAQs iniciales mencionadas
│  ├─ ¿Cómo se organiza? (Por categoría? Tags?)
│  └─ 🔴 ESTRUCTURA SIN DEFINIR
│
├─ ¿Búsqueda de FAQ?
│  ├─ ¿Palabra clave exacta?
│  ├─ ¿Similitud semántica (Gemini)?
│  └─ 🟡 MENCIONADO pero sin algoritmo exacto
│
├─ ¿Confianza en respuesta?
│  ├─ ¿Si confianza < 0.85 no responde?
│  ├─ ¿Qué pasa entonces?
│  └─ 🟡 MENCIONADO en doc pero vago
│
├─ ¿Personalización por grupo?
│  ├─ ¿Respuesta diferente según grupo?
│  ├─ ¿Ton diferente para Orquesta vs Iniciación?
│  └─ 🟡 MENCIONADO pero sin ejemplos
│
├─ ¿Control de calidad?
│  ├─ ¿Guillermo aprueba respuestas?
│  ├─ ¿O se envían directamente?
│  └─ 🔴 SIN DEFINIR
│
└─ ¿Uso de respuestas?
   ├─ ¿Se registra cuál FAQ se usó más?
   ├─ ¿Para análisis y mejora?
   └─ 🟡 MENCIONADO pero sin detalles

ACCIONES NECESARIAS:
├─ [ ] Definir estructura KB exacta (JSON schema)
├─ [ ] Definir algoritmo de búsqueda
├─ [ ] Definir umbrales de confianza por categoría
├─ [ ] Definir personalización por grupo
├─ [ ] Definir si hay aprobación manual
├─ [ ] Definir métricas de uso de FAQs
└─ [ ] Crear lista de 15+ FAQs iniciales
```

### 6.3 Creación de Tickets

**¿QUÉ ES?**
Problemas importantes se convierten en tickets para Guillermo

```
ESTADO: 🟡 VAGO

FLUJO VAGO:
├─ ¿Cuándo se crea ticket?
│  ├─ ¿Categoría = PROBLEMA, TICKET, INDETERMINADO?
│  ├─ ¿Confianza < threshold?
│  └─ 🔴 CRITERIOS SIN DEFINIR
│
├─ ¿Estructura de ticket?
│  ├─ ¿Quién reporta?
│  ├─ ¿Qué dice el problema?
│  ├─ ¿Clasificación del problema?
│  ├─ ¿Prioridad?
│  └─ 🟡 VAGO: Campos no definidos completamente
│
├─ ¿Dónde vive el ticket?
│  ├─ ¿Firebase?
│  ├─ ¿JSON?
│  ├─ ¿App Guillermo?
│  └─ 🟡 MENCIONADO pero sin estructura clara
│
├─ ¿Notificación a Guillermo?
│  ├─ ¿WhatsApp?
│  ├─ ¿Dashboard?
│  ├─ ¿Email?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Cómo Guillermo responde?
│  ├─ ¿Desde dashboard?
│  ├─ ¿Respuesta vuelve a representante?
│  └─ 🔴 FLUJO DE RESPUESTA SIN DEFINIR
│
└─ ¿Cierre de ticket?
   ├─ ¿Manual?
   ├─ ¿Automático después de X tiempo?
   └─ 🔴 PROTOCOLO SIN DEFINIR

ACCIONES NECESARIAS:
├─ [ ] Definir criterios exactos para crear ticket
├─ [ ] Definir estructura JSON de ticket
├─ [ ] Definir prioridades (baja, media, alta)
├─ [ ] Definir asignación automática
├─ [ ] Definir notificaciones a Guillermo
├─ [ ] Definir flujo de respuesta
├─ [ ] Definir métricas de SLA (cuánto tarda respuesta)
└─ [ ] Definir cierre de tickets
```

---

## 7️⃣ FLUJO: DASHBOARD DE GUILLERMO

### 7.1 Vista Principal (Resumen del Día)

**¿QUÉ ES?**
Guillermo ve resumen de qué pasó hoy

```
ESTADO: 🟡 VAGO

FLUJO VAGO:
├─ ¿Qué datos exactos se muestran?
│  ├─ Clases: 7 (de plan)
│  ├─ Clases completadas: 6 (maestro llenó)
│  ├─ Clases pendientes: 1 (falta llenar)
│  ├─ Mensajes procesados: 47
│  ├─ FAQs auto-respondidas: 12
│  ├─ Tickets creados: 3
│  ├─ Ausencias capturadas: 8
│  ├─ Discrepancias encontradas: 1
│  ├─ Alertas activas: 5
│  └─ Tiempo ahorrado: 45 minutos
│
│  Todos estos PARECEN razonables pero...
│  🔴 ¿Son TODAS las métricas que quiere?
│  🔴 ¿Cómo se calculan exactamente?
│
├─ ¿Actualización?
│  ├─ ¿En tiempo real (WebSocket)?
│  ├─ ¿Cada 5 minutos?
│  ├─ ¿Manual (click refresh)?
│  └─ 🟡 MENCIONADO pero sin definir
│
├─ ¿Drilling down?
│  ├─ ¿Click en "Clases completadas" muestra lista?
│  ├─ ¿Dónde aparece esa información?
│  └─ 🔴 FLUJO DE NAVEGACIÓN SIN DEFINIR
│
└─ ¿Reportes automáticos?
   ├─ ¿11:59 PM se genera resumen diario?
   ├─ ¿Dónde se guarda?
   ├─ ¿Quién lo recibe?
   └─ 🟡 MENCIONADO pero sin detalles

ACCIONES NECESARIAS:
├─ [ ] Definir EXACTAMENTE qué métricas aparecen
├─ [ ] Definir cómo se calculan
├─ [ ] Definir frecuencia de actualización
├─ [ ] Definir jerarquía de navegación
├─ [ ] Definir estructura de reportes automáticos
└─ [ ] Definir cuándo y a quién se envían reportes
```

### 7.2 Panel de Alertas

**¿QUÉ ES?**
Guillermo ve lista de problemas que necesitan atención

```
ESTADO: 🟡 VAGO

FLUJO VAGO:
├─ ¿Qué alertas exactas aparecen?
│  ├─ Ausencias excesivas (alumno X)
│  ├─ Patrón sospechoso (alumno Y)
│  ├─ Asistencia no llenada (clase Z)
│  ├─ Discrepancia detectada (alumno A)
│  ├─ Ausencia sin justificar (alumno B)
│  └─ 🔴 ¿HAY MÁS?
│
├─ ¿Cómo se ordena?
│  ├─ ¿Por prioridad (rojo > naranja > amarillo)?
│  ├─ ¿Por antigüedad?
│  ├─ ¿Por severidad?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Qué pasa cuando hace click en alerta?
│  ├─ ¿Ve detalles?
│  ├─ ¿Puede tomar acción?
│  ├─ ¿Envía WhatsApp?
│  └─ 🔴 FLUJO DE ACCIÓN SIN DEFINIR
│
├─ ¿Resolución de alerta?
│  ├─ ¿Manual?
│  ├─ ¿Automática?
│  ├─ ¿Después de qué evento?
│  └─ 🔴 SIN DEFINIR
│
└─ ¿Historial de alertas?
   ├─ ¿Guillermo ve alertas resueltas?
   ├─ ¿Por cuánto tiempo?
   └─ 🔴 SIN DEFINIR

ACCIONES NECESARIAS:
├─ [ ] Enumerar TODAS las alertas posibles
├─ [ ] Definir cálculo de severidad/prioridad
├─ [ ] Definir orden de aparición
├─ [ ] Definir acciones posibles por alerta
├─ [ ] Definir protocolos de cada acción
├─ [ ] Definir cuándo se resuelve alerta
└─ [ ] Definir retención histórica de alertas
```

### 7.3 Panel de Asistencias

**¿QUÉ ES?**
Guillermo ve estado de asistencias de hoy

```
ESTADO: 🔴 FALTA DEFINIR

FLUJO FALTANTE:
├─ ¿Qué datos se muestran?
│  ├─ Lista de clases con estado (completa/incompleta)?
│  ├─ Resumen por grupo (asistencia %)?
│  ├─ Detalles por alumno (histórico)?
│  └─ 🔴 ESTRUCTURA SIN DEFINIR
│
├─ ¿Cómo se sincroniza con ausencias WhatsApp?
│  └─ 🔴 VISUALIZACIÓN SIN DEFINIR
│
├─ ¿Puede exportar/imprimir?
│  ├─ ¿PDF?
│  ├─ ¿Excel?
│  ├─ ¿Por grupo?
│  └─ 🔴 OPCIONES SIN DEFINIR
│
└─ ¿Filtros?
   ├─ ¿Por grupo?
   ├─ ¿Por maestro?
   ├─ ¿Por fecha?
   └─ 🔴 SIN DEFINIR

ACCIONES NECESARIAS:
├─ [ ] Definir estructura de vista de asistencias
├─ [ ] Definir agregaciones (por grupo, por maestro)
├─ [ ] Definir exportación (formatos, opciones)
├─ [ ] Definir filtros
├─ [ ] Definir búsqueda (alumno específico)
└─ [ ] Definir cómo se ve sincronización bot-maestro
```

### 7.4 Panel de Tickets

**¿QUÉ ES?**
Guillermo ve problemas pendientes de resolver

```
ESTADO: 🟡 VAGO

FLUJO VAGO:
├─ ¿Qué estados de ticket existen?
│  ├─ Pendiente?
│  ├─ En progreso?
│  ├─ Resuelto?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Cómo responde Guillermo?
│  ├─ ¿Escribe respuesta en dashboard?
│  ├─ ¿Se envía automáticamente a representante?
│  ├─ ¿Por WhatsApp o por otro canal?
│  └─ 🔴 FLUJO DE RESPUESTA SIN DEFINIR
│
├─ ¿SLA (tiempo de respuesta)?
│  ├─ ¿Objetivo de respuesta en 24h?
│  ├─ ¿Se muestra contador?
│  └─ 🔴 SIN DEFINIR
│
└─ ¿Historial?
   ├─ ¿Guillermo ve tickets resueltos?
   ├─ ¿Por cuánto tiempo?
   └─ 🔴 SIN DEFINIR

ACCIONES NECESARIAS:
├─ [ ] Definir estado machine de tickets
├─ [ ] Definir flujo de respuesta
├─ [ ] Definir SLA y alertas de expiración
├─ [ ] Definir retención de historial
├─ [ ] Definir asignación (¿a Guillermo o a maestro?)
└─ [ ] Definir métricas (tiempo promedio, resolución %)
```

---

## 8️⃣ FLUJO: REPORTES AUTOMÁTICOS

### 8.1 Reporte Diario

**¿QUÉ ES?**
Sistema genera resumen del día automáticamente

```
ESTADO: 🟡 VAGO

FLUJO VAGO:
├─ ¿Cuándo se genera?
│  ├─ ¿11:59 PM exactamente?
│  ├─ ¿Al día siguiente a las 6 AM?
│  └─ 🟡 MENCIONADO pero sin detalle
│
├─ ¿Qué incluye?
│  ├─ Resumen de métricas (clases, asistencias, etc.)?
│  ├─ Alertas del día?
│  ├─ Tickets resueltos?
│  ├─ Cambios en base de datos?
│  └─ 🔴 CONTENIDO SIN DEFINIR
│
├─ ¿Formato?
│  ├─ ¿PDF?
│  ├─ ¿JSON?
│  ├─ ¿HTML?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Destino?
│  ├─ ¿Email a Guillermo?
│  ├─ ¿Guardado en Firebase?
│  ├─ ¿Disponible en dashboard?
│  └─ 🔴 SIN DEFINIR
│
└─ ¿Accesibilidad?
   ├─ ¿Representantes lo ven?
   ├─ ¿Maestros lo ven?
   └─ 🔴 SIN DEFINIR

ACCIONES NECESARIAS:
├─ [ ] Definir timing exacto
├─ [ ] Definir contenido (qué métricas, qué alertas)
├─ [ ] Definir formato(s)
├─ [ ] Definir distribución
├─ [ ] Definir permiso de acceso
├─ [ ] Definir plantilla exacta
└─ [ ] Definir almacenamiento histórico
```

### 8.2 Reporte Semanal

**¿QUÉ ES?**
Sistema genera resumen semanal (tendencias, análisis)

```
ESTADO: 🔴 FALTA DEFINIR

FLUJO FALTANTE:
├─ ¿Cuándo?
│  ├─ Cada lunes?
│  ├─ Cada domingo?
│  ├─ Fin de semana?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Período?
│  ├─ Lunes-domingo?
│  ├─ Domingo-sábado?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Qué análisis?
│  ├─ Tendencias de asistencia?
│  ├─ Cambios en patrones?
│  ├─ Top alertas de la semana?
│  ├─ Maestros con más tickets?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Comparación?
│  ├─ Esta semana vs semana pasada?
│  ├─ Mes a la fecha?
│  └─ 🔴 SIN DEFINIR
│
└─ ¿Recomendaciones automáticas?
   ├─ ¿"Llamar a estos 3 representantes"?
   ├─ ¿"Estos alumnos necesan atención"?
   └─ 🔴 SIN DEFINIR

ACCIONES NECESARIAS:
├─ [ ] Definir timing y período exacto
├─ [ ] Definir análisis específicos a incluir
├─ [ ] Definir comparaciones (vs qué?)
├─ [ ] Definir recomendaciones automáticas
├─ [ ] Definir visualización (gráficos, tablas)
└─ [ ] Definir destinatarios
```

---

## 9️⃣ FLUJO: DATOS HISTÓRICOS Y ANÁLISIS

### 9.1 Almacenamiento de Historial

**¿QUÉ ES?**
Sistema guarda datos para análisis futuro

```
ESTADO: 🔴 FALTA DEFINIR

FLUJO FALTANTE:
├─ ¿Qué se guarda?
│  ├─ Todas las asistencias (cada clase)?
│  ├─ Todas las ausencias (cada reporte)?
│  ├─ Todas las alertas (todas)?
│  ├─ Todos los cambios (audit trail)?
│  └─ 🔴 POLÍTICA DE RETENCIÓN SIN DEFINIR
│
├─ ¿Por cuánto tiempo?
│  ├─ 1 año?
│  ├─ 3 años?
│  ├─ Perpetuo?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Estructura?
│  ├─ ¿Datos crudos en Firebase?
│  ├─ ¿Data warehouse separado?
│  ├─ ¿Agregaciones precalculadas?
│  └─ 🔴 ARQUITECTURA DE DATA SIN DEFINIR
│
├─ ¿Acceso?
│  ├─ ¿Solo Guillermo?
│  ├─ ¿Maestros ven su datos?
│  ├─ ¿Representantes ven su datos?
│  └─ 🔴 POLÍTICA DE ACCESO SIN DEFINIR
│
└─ ¿Búsqueda?
   ├─ ¿"Mostrar ausencias de Juan en octubre"?
   ├─ ¿"Gráfico de asistencia de Orquesta mes a mes"?
   └─ 🔴 FUNCIONALIDAD DE BÚSQUEDA SIN DEFINIR

ACCIONES NECESARIAS:
├─ [ ] Definir qué eventos se registran
├─ [ ] Definir retención de datos
├─ [ ] Definir estructura de almacenamiento
├─ [ ] Definir índices para búsqueda rápida
├─ [ ] Definir archiving de datos antiguos
├─ [ ] Definir permiso de acceso por rol
└─ [ ] Definir capacidades de búsqueda y filtrado
```

### 9.2 Análisis y Reportería

**¿QUÉ ES?**
Sistema genera insights a partir de datos históricos

```
ESTADO: 🔴 FALTA DEFINIR

FLUJO FALTANTE:
├─ ¿Qué reportes están disponibles?
│  ├─ "Asistencia por alumno (período)"?
│  ├─ "Ausencias por grupo (semana)"?
│  ├─ "Tendencia de asistencia (año)"?
│  ├─ "Alumnos en riesgo (predicción)"?
│  └─ 🔴 LISTA SIN DEFINIR
│
├─ ¿Quién los genera?
│  ├─ ¿A pedido (usuario clica botón)?
│  ├─ ¿Programado (cada semana)?
│  ├─ ¿Automático (cuando hay cambio)?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Visualización?
│  ├─ ¿Gráficos (tendencias)?
│  ├─ ¿Tablas (detalles)?
│  ├─ ¿Mapas de calor (patrones)?
│  └─ 🔴 OPCIONES SIN DEFINIR
│
├─ ¿Exportación?
│  ├─ ¿PDF?
│  ├─ ¿Excel (datos raw)?
│  ├─ ¿Imagen (gráfico)?
│  └─ 🔴 SIN DEFINIR
│
└─ ¿Predicción?
   ├─ ¿Sistema predice quién va a faltar?
   ├─ ¿Sistema predice quién está en riesgo?
   └─ 🔴 SIN DEFINIR

ACCIONES NECESARIAS:
├─ [ ] Enumerar todos los reportes necesarios
├─ [ ] Definir quién puede generarlos
├─ [ ] Definir frecuencia
├─ [ ] Definir visualizaciones
├─ [ ] Definir exportación
├─ [ ] Definir algoritmos de predicción (si hay)
└─ [ ] Definir notificaciones de reportes
```

---

## 🔟 FLUJO: NOTIFICACIONES

### 10.1 ¿A Quién se Notifica de Qué?

**¿QUÉ ES?**
Sistema envía notificaciones a diferentes usuarios sobre eventos

```
ESTADO: 🔴 FALTA MATRIZ COMPLETA

MATRIZ FALTANTE:

┌──────────────┬──────────────┬─────────────┬────────────────┐
│ EVENTO       │ A GUILLERMO  │ A MAESTRO   │ A REPRESENTANT │
├──────────────┼──────────────┼─────────────┼────────────────┤
│ Asistencia   │ ¿Sí? ¿Cómo?  │ ¿Sí? ¿Cómo? │ ¿Sí? ¿Cómo?    │
│ incompleta   │ 🔴           │ 🔴          │ 🔴             │
├──────────────┼──────────────┼─────────────┼────────────────┤
│ Alerta       │ ✅ Dashboard │ ¿Sí?        │ ¿Sí?           │
│ ausencias    │ 🟡 (vago)    │ 🔴          │ 🔴             │
├──────────────┼──────────────┼─────────────┼────────────────┤
│ Discrepancia │ ✅ Dashboard │ ¿Sí?        │ ¿Sí?           │
│ encontrada   │ 🟡 (vago)    │ 🔴          │ 🔴             │
├──────────────┼──────────────┼─────────────┼────────────────┤
│ Ausencia sin │ ✅ Dashboard │ ¿Sí?        │ ✅ Bot privado │
│ justificar   │ 🟡 (vago)    │ 🔴          │ (mencionado)   │
├──────────────┼──────────────┼─────────────┼────────────────┤
│ Respuesta a  │ ¿Sí?         │ ¿Sí?        │ ✅ Debería     │
│ ticket       │ 🔴           │ 🔴          │ 🟡 (vago cómo) │
├──────────────┼──────────────┼─────────────┼────────────────┤
│ Reportes     │ 📧ó WhatsApp │ ¿Sí?        │ ¿Sí?           │
│ automáticos  │ 🟡 (vago)    │ 🔴          │ 🔴             │
└──────────────┴──────────────┴─────────────┴────────────────┘
```

### 10.2 Canales de Notificación

**¿QUÉ ES?**
Cómo se envían notificaciones (WhatsApp, email, dashboard, etc.)

```
ESTADO: 🔴 FALTA DEFINIR CANALES POR EVENTO

MATRIZ DE CANALES:

¿Guillermo recibe notificaciones por...
├─ Dashboard (WebSocket en tiempo real)? 🟢 Sí (mencionado)
├─ WhatsApp? 🔴 ¿A número personal?
├─ Email? 🔴 No mencionado
└─ App móvil? 🔴 No mencionado

¿Maestro recibe notificaciones por...
├─ App (notificación push)? 🔴 No mencionado
├─ WhatsApp? 🔴 No mencionado
├─ Email? 🔴 No mencionado
└─ Dashboard? 🔴 ¿Maestro tiene dashboard?

¿Representante recibe notificaciones por...
├─ WhatsApp? 🟢 Sí (bot mencionado)
├─ Email? 🔴 No mencionado
├─ SMS? 🔴 No mencionado
└─ Portal? 🔴 No mencionado (aunque mencionado portal de lectura)

ACCIONES NECESARIAS:
├─ [ ] Definir canales disponibles por rol
├─ [ ] Definir qué eventos usa qué canal
├─ [ ] Definir urgencia (inmediato vs batch)
├─ [ ] Definir frecuencia máxima (no spam)
├─ [ ] Definir formato de notificación
└─ [ ] Definir opt-out / preferencias
```

---

## 1️⃣1️⃣ FLUJO: INTEGRACIONES EXTERNAS

### 11.1 Exportación para Archivos Físicos

**¿QUÉ ES?**
Sistema puede exportar a PDF para archivo físico (aunque no es necesario)

```
ESTADO: 🟡 MENCIONADO pero vago

FLUJO VAGO:
├─ ¿PDF de qué?
│  ├─ Hoja de asistencia por clase?
│  ├─ Resumen diario?
│  ├─ Reporte mensual?
│  └─ 🔴 OPCIONES SIN DEFINIR
│
├─ ¿Cuándo se genera?
│  ├─ A pedido (click botón)?
│  ├─ Automático (fin de día)?
│  ├─ Ambos?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Quién puede descargarlo?
│  ├─ ¿Guillermo?
│  ├─ ¿Maestro?
│  ├─ ¿Ambos?
│  └─ 🔴 SIN DEFINIR
│
├─ ¿Dónde se almacena?
│  ├─ ¿Firebase Storage?
│  ├─ ¿Carpeta local?
│  ├─ ¿Descarga directa?
│  └─ 🔴 SIN DEFINIR
│
└─ ¿Firma?
   ├─ ¿PDF incluye firma digital?
   ├─ ¿O Guillermo firma después?
   └─ 🔴 SIN DEFINIR

ACCIONES NECESARIAS:
├─ [ ] Definir qué PDFs están disponibles
├─ [ ] Definir cuándo se generan
├─ [ ] Definir acceso por rol
├─ [ ] Definir almacenamiento
└─ [ ] Definir firma digital vs papel
```

---

## RESUMEN: MATRIZ DE ESTADO GENERAL

```
VERDE (DEFINIDO)       | AMARILLO (VAGO)      | ROJO (FALTA)
─────────────────────────────────────────────────────────────
Mensaje diario         | Justificaciones      | Alertas específicas
Asistencia en app      |   pre-llenadas       | Umbrales exactos
Sincronización básica  | FAQ confidence       | Estructura KB JSON
Dashboard visual       | Reporte PDF          | Protocolos resolve
Automatizaciones       | Notificaciones       | Data warehouse
  recordatorio         | Tickets SLA          | Análisis predictivo
                       | Rate limiting        | Permisos por rol
                       | Histórico de datos   | Matriz de notificaciones
                       |                      | Documentación de APIs
```

---

## DIAGNÓSTICO FINAL

### ÁREAS CRÍTICAS SIN DEFINIR

```
🔴 CRÍTICO (Bloquea implementación):
1. Estructura JSON EXACTA (app maestros ↔ Firebase)
2. Matriz completa de notificaciones (quién ve qué)
3. Umbrales exactos de alertas (números específicos)
4. Protocolo de resolución de discrepancias
5. Flujo de respuesta de tickets (cómo vuelve a representante)

🟡 IMPORTANTE (Afecta UX pero no bloquea):
1. Orden/prioridad de alertas
2. Periodicidad de reportes automáticos
3. Retención de datos históricos
4. Personalización de mensajes por grupo
5. Métricas exactas a mostrar en dashboard

🟢 MENOR (Mejoras después de lanzamiento):
1. Análisis predictivo
2. Gráficos de tendencias
3. Exportaciones adicionales
4. Integraciones con otros sistemas
```

---

## RESPUESTA A TU PREGUNTA

### ¿Está suficientemente definido el sistema?

**RESPUESTA: NO.**

Hemos definido:
- ✅ **Estructura general** (procesos, fases, flujos alto nivel)
- ✅ **Intenciones** (qué queremos lograr)
- ✅ **Arquitectura** (cómo se conectan las piezas)

Pero falta:
- ❌ **Detalles operacionales** (números, umbrales, criterios específicos)
- ❌ **Matriz de datos** (quién recibe qué, cuándo, cómo)
- ❌ **Especificaciones técnicas** (JSON exacto, APIs, formatos)
- ❌ **Protocolos de resolución** (qué hacer ante cada situación)
- ❌ **Integración con app maestros** (cómo hablan exactamente)

### ¿Necesitamos conocer la app maestros?

**RESPUESTA: SÍ, ABSOLUTAMENTE.**

Pero no es lo PRIMERO. Lo primero es **completar los flujos lógicos** sin preocuparnos por JSON. Una vez tengamos todo el mapa de datos y decisiones, ENTONCES extraemos el modelo de la app maestros.

---

## 🎯 LO QUE DEBERÍAMOS HACER AHORA

**OPCIÓN A: Continuar con documentación lógica (RECOMENDADO)**
```
1. Completar TODOS los flujos faltantes
2. Crear matriz de notificaciones
3. Definir umbrales exactos
4. Definir protocolos de resolución
5. LUEGO: Extraer modelo de app maestros
6. LUEGO: Crear documento #7 técnico
```

**OPCIÓN B: Saltarse a app maestros**
```
1. Mirar código de app maestros
2. Extraer estructura JSON
3. Diseñar en base a eso
4. RIESGO: Podríamos descubrir "el JSON no permite X"
   → Volver a redesign completo
```

---

Mi recomendación: **OPCIÓN A.**

¿Estás de acuerdo con este diagnóstico?
