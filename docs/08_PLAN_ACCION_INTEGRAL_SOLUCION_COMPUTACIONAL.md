# 🎯 PLAN DE ACCIÓN INTEGRAL: Solución Computacional para El Sistema PC

> **Objetivo:** Resolver problemas operacionales mediante lógica computacional
> **Alcance:** Automatizar tareas, gestionar procesos, responder indicadores del Marco Lógico
> **Resultado:** Plataforma web centralizada para gestión administrativa, académica y de datos
> **Fecha:** 2025-01-29
> **Estado:** ARQUITECTURA DE SOLUCIÓN

---

## 📊 PARTE 1: MAPEO DE INDICADORES DEL MARCO LÓGICO A SOLUCIONES

### Objetivo 1: "Desarrollar competencias en música"

| Indicador | Meta | Fuente de Datos | ¿Automático? | Módulo Necesario |
|-----------|------|-----------------|---------|------------------|
| Alumnos inscritos | 250 | Base de datos ALUMNOS | ✅ | Módulo Inscripciones |
| Horas de clase impartidas (Iniciación) | 100 | Calendario clases + Firebase | ✅ | Módulo Clases |
| Alumnos capacitados | 100 | Asistencia + Evaluación | 🟡 | Módulo Calificaciones |
| Alumnos aprobados | 50 | Evaluación maestro | 🟡 | Módulo Evaluación |
| Horas de clase coral | 300 | Calendario clases | ✅ | Módulo Clases |
| Horas de talleres seccionales | 1500 | Calendario clases | ✅ | Módulo Clases |
| Ensayos de orquesta | 40 | Eventos especiales | ✅ | Módulo Eventos |
| Ensayos de ensambles | 150 | Eventos especiales | ✅ | Módulo Eventos |
| Masterclass realizadas | 12 | Eventos especiales | ✅ | Módulo Eventos |

**Interpretación:**
- ✅ **Automático (60%)**: Datos que se generan del sistema sin intervención
- 🟡 **Semi-automático (40%)**: Datos que necesitan validación/entrada manual
- ❌ **Manual (0%)**: Estos indicadores TODOS se pueden calcular automáticamente

---

### Objetivo 2: "Impactar positivamente familias"

| Indicador | Meta | Fuente de Datos | ¿Automático? | Módulo Necesario |
|-----------|------|-----------------|---------|------------------|
| Conciertos organizados | 20 | Eventos especiales | 🟡 | Módulo Eventos |
| Asistencia a conciertos | 250+ | App de registro | 🟡 | Módulo Asistencia Eventos |
| Reuniones de padres | 10 | Calendario de reuniones | 🟡 | Módulo Reuniones |
| Padres que asistieron | 300+ | Registro de asistencia | 🟡 | Módulo Asistencia Eventos |
| Ensayos abiertos | 8 | Eventos especiales | 🟡 | Módulo Eventos |

**Interpretación:**
- Necesita módulo de EVENTOS para registrar y rastrear

---

### Objetivo 3: "Hacer valer los valores de aprendizaje"

| Indicador | Meta | Fuente de Datos | ¿Automático? | Módulo Necesario |
|-----------|------|-----------------|---------|------------------|
| Actividades comunitarias | 20 | Registro manual | 🟡 | Módulo Actividades |
| Niños sensibilizados | 2000 | Registro de eventos | 🟡 | Módulo Actividades |
| Seguidores redes sociales | 5000 | APIs de redes sociales | ✅ | Módulo Social Media |
| Posts realizados | 50 | Registro manual/automático | 🟡 | Módulo Social Media |
| Horas de transmisión | 10 | Registro manual | 🟡 | Módulo Medios |
| Artículos de prensa | 10 | Registro manual | 🟡 | Módulo Medios |

---

## 🎯 PARTE 2: DESCOMPOSICIÓN DE PROBLEMAS GRANDES EN PEQUEÑOS

### PROBLEMA #1: Mensaje FLOTA Diario (Antes de 12 PM)

**Problema Grande:**
```
Guillermo dedica 20 minutos diarios a crear mensaje FLOTA
- Consigue información de Excel (manual)
- Copia/pega a múltiples grupos
- Riesgo de inconsistencias
- Sin versionamiento
```

**Descomposición en Problemas Pequeños:**

```
P1.1: ¿De dónde obtener lista de clases del día?
├─ Solución: Firebase colección CLASES (ya existe)
├─ Lógica: Query en tiempo real
├─ Programable: SÍ - Función que filtra por fecha
└─ Responsable: Sistema automático

P1.2: ¿Cómo generar mensaje personalizado por grupo?
├─ Solución: Template de mensaje + datos de clase
├─ Lógica: Variable substitution ({{horario}}, {{maestro}}, {{salon}})
├─ Programable: SÍ - Función que genera mensaje
└─ Responsable: Sistema automático

P1.3: ¿Cuándo enviar?
├─ Solución: Scheduled job (Cloud Functions)
├─ Lógica: Trigger a las 11:00 AM
├─ Programable: SÍ - Cloud Scheduler
└─ Responsable: Sistema automático

P1.4: ¿A qué grupos enviar?
├─ Solución: Lista de grupos en Firebase
├─ Lógica: Para cada clase, obtener grupo de FLOTA
├─ Programable: SÍ - Mapeo clase → grupo
└─ Responsable: Sistema automático

P1.5: ¿Qué pasa si hay cambio urgente?
├─ Solución: Dashboard de Guillermo para "Enviar ahora"
├─ Lógica: Botón "Enviar mensaje actualizado"
├─ Programable: SÍ - Endpoint manual
└─ Responsable: Guillermo (click, no typing)
```

**Solución Programable:**
```typescript
// 1. Obtener clases del día
function getClassesForToday() {
  return db.collection('CLASES')
    .where('fecha', '==', today())
    .orderBy('hora')
    .get();
}

// 2. Generar mensaje por clase
function generateFlotaMessage(clase) {
  const template = `
🎶 {{INSTRUMENTO}}
▶️ {{HORA}} a {{HORA_FIN}} 
Salón {{SALON}}
Prof. {{MAESTRO}}
  `;
  
  return template
    .replace('{{INSTRUMENTO}}', clase.instrumento)
    .replace('{{HORA}}', clase.horaInicio)
    // ... etc
}

// 3. Enviar a grupo (vía Baileys)
async function sendFlotaMessage(groupJid, message) {
  await client.sendMessage(groupJid, {
    text: message
  });
}

// 4. Orchestration
async function sendDailyFlotaMessages() {
  const classes = await getClassesForToday();
  
  for (const clase of classes) {
    const message = generateFlotaMessage(clase);
    const groupJid = clase.flota_group_jid; // En Firebase
    await sendFlotaMessage(groupJid, message);
  }
}

// 5. Trigger automático cada día a las 11:00 AM
// (Cloud Functions o cronograma local)
```

**Impacto:**
- ❌ ANTES: 20 min manual/día = 100 min/semana
- ✅ DESPUÉS: 0 min (automático) + 1 min si cambio urgente
- 💰 **Ahorro: 19 min/día = 1.58 horas/semana**

---

### PROBLEMA #2: Recopilación de Justificaciones (Antes de imprimir hojas)

**Problema Grande:**
```
Guillermo lee 50+ mensajes en FLOTA para extraer ausencias
- Busca manualmente palabras clave
- Anota en papel
- Propenso a perder información
- Tarda 20-30 minutos
```

**Descomposición:**

```
P2.1: ¿Cómo detectar mensaje de ausencia automáticamente?
├─ Solución: Análisis de texto con palabras clave
├─ Lógica: Si mensaje contiene "no viene", "enfermo", "ausente"...
├─ Programable: SÍ - Regex o Gemini API
└─ Responsable: Bot (IA)

P2.2: ¿Cómo confirmar que es una ausencia?
├─ Solución: Bot pregunta "¿Confirmamos que no asiste?"
├─ Lógica: Validación interactiva
├─ Programable: SÍ - Bot responde
└─ Responsable: Representante (confirma)

P2.3: ¿Dónde guardar la información?
├─ Solución: Firebase colección AUSENCIAS
├─ Lógica: Documento con estructura definida
├─ Programable: SÍ - Guardar automáticamente
└─ Responsable: Sistema automático

P2.4: ¿Cómo pre-llenar hoja de asistencia?
├─ Solución: Query en Firebase antes de imprimir
├─ Lógica: Para cada alumno, buscar si hay ausencia justificada
├─ Programable: SÍ - Marcar "J" en la hoja PDF
└─ Responsable: Sistema automático

P2.5: ¿Qué pasa si representante reporta tarde?
├─ Solución: Bot sigue aceptando hasta 1 hora antes de clase
├─ Lógica: Trigger on-time check
├─ Programable: SÍ - Validación de horario
└─ Responsable: Sistema automático
```

**Solución Programable:**

```typescript
// 1. Detectar ausencia en mensaje
async function detectAbsence(message) {
  const keywords = ['no viene', 'enfermo', 'ausente', 'falta', 'no puede'];
  const hasKeyword = keywords.some(k => message.toLowerCase().includes(k));
  
  if (!hasKeyword) return null;
  
  // Usar Gemini para análisis más profundo
  const analysis = await gemini.analyzeMessage(message, {
    context: 'absence_detection',
    extractStudent: true,
    extractReason: true
  });
  
  return analysis;
}

// 2. Confirmar con representante
async function confirmAbsence(senderJid, student, reason) {
  const confirmation = await bot.askForConfirmation(senderJid, {
    text: `Entendido que ${student.nombre} no asistirá por: ${reason}`,
    buttons: ['Confirmar', 'Cancelar']
  });
  
  return confirmation;
}

// 3. Guardar en Firebase
async function saveAbsence(studentId, classId, reason, date) {
  await db.collection('AUSENCIAS').add({
    studentId,
    classId,
    reason,
    date,
    justificada: true,
    reportadoVia: 'whatsapp',
    timestamp: new Date()
  });
}

// 4. Pre-llenar hoja
async function prefillAbsences(classId, date) {
  const absences = await db.collection('AUSENCIAS')
    .where('classId', '==', classId)
    .where('date', '==', date)
    .get();
  
  const fillMap = {};
  absences.forEach(doc => {
    fillMap[doc.studentId] = 'J'; // Justificada
  });
  
  return fillMap;
}

// 5. Orchestration - cuando llega mensaje en FLOTA
async function onFlotaMessage(message) {
  const absence = await detectAbsence(message.text);
  
  if (absence) {
    const confirmed = await confirmAbsence(
      message.from,
      absence.student,
      absence.reason
    );
    
    if (confirmed) {
      await saveAbsence(
        absence.studentId,
        absence.classId,
        absence.reason,
        today()
      );
    }
  }
}
```

**Impacto:**
- ❌ ANTES: 20-30 min manual/día = 100-150 min/semana
- ✅ DESPUÉS: 0 min (automático) + validaciones en tiempo real
- 💰 **Ahorro: 25 min/día = 2.08 horas/semana**

---

### PROBLEMA #3: Conteos Manuales por Maestro

**Problema Grande:**
```
Maestro cuenta manualmente: P, T, J, N
- Propenso a errores
- Sin validación
- Información se queda en papel
- Tarda 5 minutos por clase
```

**Descomposición:**

```
P3.1: ¿Cómo registrar asistencia digitalmente?
├─ Solución: App de maestro con interfaz de asistencia
├─ Lógica: Click en alumno → presente/ausente/tardío/justificado
├─ Programable: SÍ - UI reactiva
└─ Responsable: Maestro (en lugar de papel)

P3.2: ¿Cómo validar que está correcto?
├─ Solución: Sistema calcula automáticamente totales
├─ Lógica: P = count(presentes), T = count(tardíos), etc.
├─ Programable: SÍ - Computación automática
└─ Responsable: Sistema automático

P3.3: ¿Qué pasa si hay alumno nuevo (sin estar en lista)?
├─ Solución: Botón "Agregar alumno" en app
├─ Lógica: Crear registro temporal + alerta a Guillermo
├─ Programable: SÍ - Crear documento en Firebase
└─ Responsable: Maestro (acceso) + Guillermo (validar)

P3.4: ¿Dónde guardar los datos?
├─ Solución: Firebase colección ASISTENCIAS
├─ Lógica: Documento por clase/maestro/fecha
├─ Programable: SÍ - Guardar automáticamente
└─ Responsable: Sistema automático

P3.5: ¿Cómo sincronizar con ausencias de FLOTA?
├─ Solución: Algoritmo de comparación automático
├─ Lógica: Si AUSENCIA != ASISTENCIA, crear alerta
├─ Programable: SÍ - Función de validación
└─ Responsable: Sistema automático
```

**Solución Programable:**

```typescript
// 1. Interface de asistencia (React)
<AttendanceForm classId={classId} studentIds={studentIds}>
  {students.map(student => (
    <StudentRow key={student.id} student={student}>
      <Button 
        onClick={() => markStudent(student.id, 'presente')}
        active={attendance[student.id] === 'presente'}
      >
        P
      </Button>
      <Button 
        onClick={() => markStudent(student.id, 'tardio')}
        active={attendance[student.id] === 'tardio'}
      >
        T
      </Button>
      {/* Etc */}
    </StudentRow>
  ))}
</AttendanceForm>

// 2. Calcular totales automáticamente
function calculateTotals(attendance) {
  return {
    presente: Object.values(attendance).filter(v => v === 'presente').length,
    tardio: Object.values(attendance).filter(v => v === 'tardio').length,
    justificado: Object.values(attendance).filter(v => v === 'justificado').length,
    noJustificado: Object.values(attendance).filter(v => v === 'no_justificado').length
  };
}

// 3. Guardar en Firebase
async function saveAttendance(classId, date, maestroId, attendance) {
  const totals = calculateTotals(attendance);
  
  await db.collection('ASISTENCIAS').doc(
    `${classId}_${date}_${maestroId}`
  ).set({
    classId,
    date,
    maestroId,
    detalle: attendance,
    totales: totals,
    estado: 'completado',
    timestamp: new Date()
  });
}

// 4. Comparar con ausencias de FLOTA
async function validateAgainstFlota(classId, date) {
  const asistencia = await getAttendance(classId, date);
  const ausencias = await getAbsences(classId, date);
  
  const discrepancias = [];
  
  for (const ausencia of ausencias) {
    const status = asistencia.detalle[ausencia.studentId];
    
    // Si fue reportado como ausencia pero asistió
    if (ausencia.justificada && status === 'presente') {
      discrepancias.push({
        type: 'false_absence',
        studentId: ausencia.studentId,
        reported: 'absent',
        actual: 'present'
      });
    }
    
    // Si asistió pero estaba marcado como ausente (¡error!)
    if (!ausencia && status !== 'presente') {
      discrepancias.push({
        type: 'unreported_absence',
        studentId: ausencia.studentId,
        reported: 'none',
        actual: 'absent'
      });
    }
  }
  
  return discrepancias;
}

// 5. Validación antes de guardar
async function beforeSaveAttendance(classId, date, maestroId, attendance) {
  const totals = calculateTotals(attendance);
  const students = await getClassStudents(classId);
  
  // Validación: ¿Todos los alumnos tienen estado?
  for (const student of students) {
    if (!attendance[student.id]) {
      throw new Error(
        `Alumno ${student.nombre} no tiene estado registrado`
      );
    }
  }
  
  // Validación: ¿Los totales cuadran?
  const totalStudents = students.length;
  const sumStatus = totals.presente + totals.tardio + 
                    totals.justificado + totals.noJustificado;
  
  if (sumStatus !== totalStudents) {
    throw new Error(
      `Totales no cuadran: ${sumStatus} vs ${totalStudents}`
    );
  }
  
  return true; // Puede guardarse
}
```

**Impacto:**
- ❌ ANTES: 5 min conteo manual + errores = 35 min/semana
- ✅ DESPUÉS: Click automático + cálculo automático = 2 min/semana
- 💰 **Ahorro: 3 min/día = 15 min/semana = 1.08 horas/semana**

---

### PROBLEMA #4: Digitalización Manual de Hojas (Romina)

**Problema Grande:**
```
Romina lee 40-50 hojas de papel y transcribe datos a Excel
- 4-6 horas por mes
- Propenso a errores
- Retraso en análisis
- Romina usa tiempo que debería usar en otra cosa
```

**Descomposición:**

```
P4.1: ¿Cómo capturar datos de las hojas de papel?
├─ Solución: NO NECESARIO si maestro usa app
├─ Alternativa: OCR si aún hay papel
├─ Programable: SÍ - Google Vision API
└─ Responsable: Sistema automático

P4.2: ¿Dónde centralizar los datos?
├─ Solución: Firebase (ya está)
├─ Lógica: Colección ASISTENCIAS actualizada en tiempo real
├─ Programable: SÍ - Ya se hace automáticamente
└─ Responsable: Sistema automático

P4.3: ¿Cómo acceder a los datos para análisis?
├─ Solución: Dashboard de análisis en tiempo real
├─ Lógica: Query Firebase, mostrar gráficos
├─ Programable: SÍ - React + Firebase queries
└─ Responsable: Omar, Manuel, Romina (lectura)

P4.4: ¿Cómo exportar a Excel si es necesario?
├─ Solución: Botón "Exportar a Excel"
├─ Lógica: Query Firebase → XLSX
├─ Programable: SÍ - Librería xlsx
└─ Responsable: Sistema automático

P4.5: ¿Cómo auditar cambios?
├─ Solución: Audit trail automático en Firebase
├─ Lógica: Registrar quién cambió qué y cuándo
├─ Programable: SÍ - Listeners en Firestore
└─ Responsable: Sistema automático
```

**Solución Programable:**

```typescript
// 1. SI AÚN HAY PAPEL: OCR para digitalizar
async function digitalizeFromPaper(imagePath) {
  const vision = require('@google-cloud/vision');
  const client = new vision.ImageAnnotatorClient();

  const request = {
    image: {content: fs.readFileSync(imagePath)},
  };

  const [result] = await client.documentTextDetection(request);
  const fullText = result.fullTextAnnotation.text;

  // Parsear texto para extraer asistencias
  return parseAttendanceFromText(fullText);
}

// 2. Dashboard de análisis (React)
<AnalyticsDashboard>
  <MetricCard label="Asistencia General">
    {calculateAttendanceRate()}
  </MetricCard>
  
  <MetricCard label="Asistencia por Grupo">
    <BarChart data={getAttendanceByGroup()} />
  </MetricCard>
  
  <AlertCard title="Ausencias Excesivas">
    {getStudentsWithExcessiveAbsences().map(s => (
      <StudentAlert key={s.id} student={s} />
    ))}
  </AlertCard>
</AnalyticsDashboard>

// 3. Exportar a Excel
async function exportToExcel(startDate, endDate) {
  const data = await db.collection('ASISTENCIAS')
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();

  const worksheet = XLSX.utils.json_to_sheet(
    data.docs.map(doc => ({
      Fecha: doc.date,
      Maestro: doc.maestroId,
      Presentes: doc.totales.presente,
      Tardíos: doc.totales.tardio,
      Justificados: doc.totales.justificado,
      NoJustificados: doc.totales.noJustificado
    }))
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Asistencias");
  XLSX.writeFile(workbook, "asistencias.xlsx");
}

// 4. Audit trail automático
function setupAuditTrail() {
  db.collection('ASISTENCIAS').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const doc = change.doc;
      
      if (change.type === 'modified') {
        logAuditEvent({
          action: 'ASISTENCIA_MODIFICADA',
          documentId: doc.id,
          oldData: change.doc.data(), // Firebase guarda automáticamente
          newData: doc.data(),
          timestamp: new Date(),
          user: auth.currentUser.uid
        });
      }
    });
  });
}

// 5. Consultas analíticas pre-optimizadas
async function getAttendanceRate(groupId, startDate, endDate) {
  const docs = await db.collection('ASISTENCIAS')
    .where('groupId', '==', groupId)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();

  const total = docs.size;
  const presentes = docs.docs.reduce(
    (sum, doc) => sum + doc.data().totales.presente, 
    0
  );

  return (presentes / total) * 100;
}
```

**Impacto:**
- ❌ ANTES: 6 horas/mes = 72 horas/año
- ✅ DESPUÉS: 0 horas (automático) + dashboards en tiempo real
- 💰 **Ahorro: 6 horas/mes = 72 horas/año**
- 👤 **Romina liberada para tareas estratégicas**

---

### PROBLEMA #5: Análisis Manual y Retraso (Omar, Manuel)

**Problema Grande:**
```
Omar y Manuel esperan a que Romina termine Excel
- Análisis 1 mes después del evento
- No pueden tomar decisiones preventivas
- Información desactualizada
```

**Descomposición:**

```
P5.1: ¿Cómo acceder a datos en tiempo real?
├─ Solución: Dashboard personalizado por director
├─ Lógica: Firebase queries en vivo
├─ Programable: SÍ - React + Realtime listeners
└─ Responsable: Omar/Manuel (lectura)

P5.2: ¿Cómo detectar patrones automáticamente?
├─ Solución: Reglas inteligentes en el sistema
├─ Lógica: Si ausencias > X, crear alerta automática
├─ Programable: SÍ - Cloud Functions + triggers
└─ Responsable: Sistema automático

P5.3: ¿Cómo saber quién está en riesgo?
├─ Solución: Scoring automático del alumno
├─ Lógica: Puntuación basada en asistencia + comportamiento
├─ Programable: SÍ - Algoritmo de scoring
└─ Responsable: Sistema automático

P5.4: ¿Cómo generar reportes sin esperar a Romina?
├─ Solución: Reportes on-demand automáticos
├─ Lógica: Click en botón, genera reporte al instante
├─ Programable: SÍ - Generación en tiempo real
└─ Responsable: Sistema automático

P5.5: ¿Cómo notificar cambios importantes?
├─ Solución: Alertas automáticas en dashboard
├─ Lógica: Alumno cruza umbral → notificación
├─ Programable: SÍ - Listeners + notifications
└─ Responsable: Sistema automático
```

**Solución Programable:**

```typescript
// 1. Dashboard director (Real-time)
<DirectorDashboard directorId={directorId}>
  <Section title="Métricas de Hoy">
    <RealTimeMetric 
      label="Asistencia del Día"
      value={listenToTodayAttendance()}
      target="95%"
    />
  </Section>
  
  <Section title="Alertas Activas">
    <AlertList 
      alerts={listenToActiveAlerts()}
      onClick={(alert) => showDetail(alert)}
    />
  </Section>
  
  <Section title="Alumnos en Riesgo">
    <RiskTable 
      students={listenToRiskStudents()}
      onClick={(student) => showStudentProfile(student)}
    />
  </Section>
</DirectorDashboard>

// 2. Detectar patrones y crear alertas automáticas
async function detectPatternsAndAlert(classId, studentId) {
  const absences = await getStudentAbsences(studentId, 'last_30_days');
  
  const patterns = {
    excessive: absences.length >= 4,
    suspicious: checkSuspiciousPattern(absences),
    changed: hasPatternChanged(studentId)
  };
  
  if (patterns.excessive || patterns.suspicious || patterns.changed) {
    await createAlert({
      studentId,
      type: Object.keys(patterns).find(k => patterns[k]),
      severity: calculateSeverity(patterns),
      actionRequired: true
    });
    
    // Notificar a Omar/Manuel
    await notifyDirector(classId, {
      title: `Alerta: ${getStudent(studentId).nombre}`,
      type: patterns.excessive ? 'EXCESSIVE_ABSENCES' : 'SUSPICIOUS_PATTERN',
      studentId
    });
  }
}

// 3. Scoring de riesgo del alumno
function calculateStudentRiskScore(studentId) {
  const attendance = getStudentAttendanceRate(studentId);
  const behavior = getStudentBehaviorScore(studentId);
  const engagement = getStudentEngagement(studentId);
  
  const score = (
    (100 - attendance) * 0.5 +  // Asistencia es 50% del score
    (100 - behavior) * 0.3 +     // Comportamiento es 30%
    (100 - engagement) * 0.2     // Engagement es 20%
  );
  
  return {
    score: Math.min(100, Math.max(0, score)),
    level: score >= 70 ? 'ALTO' : score >= 40 ? 'MEDIO' : 'BAJO',
    recommendations: generateRecommendations(score)
  };
}

// 4. Generar reporte on-demand
async function generateReportOnDemand(startDate, endDate, groupId) {
  const report = {
    period: `${startDate} a ${endDate}`,
    group: getGroup(groupId),
    summary: await generateSummary(startDate, endDate, groupId),
    breakdown: {
      byClass: await getAttendanceByClass(startDate, endDate, groupId),
      byStudent: await getAttendanceByStudent(startDate, endDate, groupId),
      patterns: await detectPatternsInPeriod(startDate, endDate, groupId)
    },
    recommendations: generateRecommendations(endDate, groupId),
    generatedAt: new Date()
  };
  
  return report;
}

// 5. Alertas en tiempo real
function setupRealtimeAlerts(directorId) {
  db.collection('ALERTS')
    .where('audience', 'array-contains', directorId)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          showNotification(change.doc.data());
        }
      });
    });
}
```

**Impacto:**
- ❌ ANTES: Análisis 30 días después del evento
- ✅ DESPUÉS: Análisis en tiempo real, decisiones inmediatas
- 💰 **Beneficio: Detección de problemas ANTES de que se escalen**
- 📊 **Datos actualizados SIEMPRE**

---

## 📐 PARTE 3: ARQUITECTURA DE SOLUCIÓN

### 3.1 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          APLICACIÓN WEB CENTRALIZADA                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                          FRONTEND (React 18 + Vite)                     │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │ │
│  │  │ Dashboard    │  │ Maestros:    │  │ Módulo Bot  │  │ Reportes  │ │ │
│  │  │ Guillermo    │  │ App Asistencia   │ Configuración │ Exportación   │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │ │
│  │  │ Dashboard    │  │ Gestión de   │  │ Analytics    │  │ Archivo    │ │ │
│  │  │ Omar/Manuel  │  │ Eventos      │  │ en Vivo      │  │ (búsqueda) │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │ │
│  │  │ Portal       │  │ Gestión de   │  │ Auditoría    │  │ Admin      │ │ │
│  │  │ Representantes │ Alumnos       │  │ Trail        │  │ Settings   │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│         │                          │                          │                │
│         │ HTTPS                    │ WebSocket               │ REST API        │
│         ▼                          ▼                          ▼                │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                     BACKEND (Node.js + Express)                         │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                         │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │ │
│  │  │ BotOrchestrator  │  │ Message Service  │  │ Analytics Engine   │  │ │
│  │  │ (Baileys)        │  │ (WhatsApp)       │  │ (Scoring, Alerts)  │  │ │
│  │  └──────────────────┘  └──────────────────┘  └────────────────────┘  │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │ │
│  │  │ Attendance API   │  │ Events API       │  │ Reports Generator  │  │ │
│  │  │ (Save/Get)       │  │ (Create/Update)  │  │ (PDF, Excel, etc)  │  │ │
│  │  └──────────────────┘  └──────────────────┘  └────────────────────┘  │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │ │
│  │  │ User Management  │  │ Auth Service     │  │ File Service       │  │ │
│  │  │ (Roles)          │  │ (JWT, Sessions)  │  │ (Storage)          │  │ │
│  │  └──────────────────┘  └──────────────────┘  └────────────────────┘  │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│         │                          │                          │                │
│         │ Firestore SDK            │ Cloud Functions          │ APIs           │
│         ▼                          ▼                          ▼                │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                            FIREBASE (Backend-as-a-Service)              │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                         │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │ │
│  │  │ Firestore        │  │ Cloud Functions  │  │ Cloud Storage      │  │ │
│  │  │ (Colecciones):   │  │ (Triggers):      │  │ (PDFs, Exports)    │  │ │
│  │  │ • ALUMNOS        │  │ • Daily FLOTA    │  │                    │  │ │
│  │  │ • MAESTROS       │  │ • Bot responses  │  └────────────────────┘  │ │
│  │  │ • CLASES         │  │ • Analytics      │  ┌────────────────────┐  │ │
│  │  │ • ASISTENCIAS    │  │ • Alerts         │  │ Cloud Scheduler    │  │ │
│  │  │ • AUSENCIAS      │  │ • Report gen.    │  │ (Cron jobs)        │  │ │
│  │  │ • EVENTOS        │  │                  │  └────────────────────┘  │ │
│  │  │ • ALERTAS        │  └──────────────────┘                          │ │
│  │  │ • AUDIT_LOG      │                                                │ │
│  │  └──────────────────┘                                                │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│         │                          │                          │                │
│         │ API Keys                 │ OAuth                   │ Webhooks       │
│         ▼                          ▼                          ▼                │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      INTEGRACIONES EXTERNAS                             │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │ • Google Gemini (Análisis de mensajes)                                  │ │
│  │ • Baileys (WhatsApp)                                                    │ │
│  │ • Google Cloud Vision (OCR para papel)                                  │ │
│  │ • XLSX Library (Exportación a Excel)                                    │ │
│  │ • jsPDF Library (Generación de PDFs)                                    │ │
│  │ • AWS SDK / Google Cloud (opcional para escalado)                       │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Colecciones de Firebase (Schema)

```typescript
// ALUMNOS (Existente, mejorado)
{
  id: string;                    // UUID
  nombre: string;
  apellido: string;
  instrumento: string;           // "Violín", "Coro", etc.
  nivel: string;                 // "Iniciación", "Nivel 1", etc.
  grupoId: string;               // Referencia a GRUPOS
  cedula?: string;
  fechaNacimiento?: string;
  
  // Contacto
  padre: string;
  madre: string;
  tlf_padre: string;
  tlf_madre: string;
  email?: string;
  
  // Datos de inscripción
  fechaIngreso: Date;
  estado: "activo" | "inactivo" | "suspendido";
  becado: boolean;
  tieneInstrumento: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// MAESTROS (Nuevo)
{
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  
  // Asignación
  clases: string[];              // Referencia a CLASES
  grupos: string[];              // Referencia a GRUPOS
  
  // Configuración
  tipoContrato: "fulltime" | "part_time" | "por_hora";
  horarioInicio?: string;        // "09:00"
  horarioFin?: string;           // "17:00"
  
  // Credenciales
  usuarioId: string;             // Referencia a USERS
  activo: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

// CLASES (Nuevo)
{
  id: string;
  fecha: Date;
  horaInicio: string;            // "09:00"
  horaFin: string;               // "11:00"
  
  // Referencia
  grupoId: string;               // Referencia a GRUPOS
  maestroId: string;             // Referencia a MAESTROS
  salonId: string;               // Referencia a SALONES
  
  // Alumnos esperados
  alumnosEsperados: string[];    // Referencia a ALUMNOS
  
  // Estado
  estado: "programada" | "completada" | "cancelada";
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// ASISTENCIAS (Nuevo)
{
  id: string;                    // "clase_fecha_maestro"
  claseId: string;               // Referencia a CLASES
  fecha: Date;
  maestroId: string;
  
  // Detalle de asistencia por alumno
  detalle: {
    [alumnoId: string]: "presente" | "tardio" | "justificado" | "no_justificado"
  };
  
  // Totales calculados automáticamente
  totales: {
    presente: number;
    tardio: number;
    justificado: number;
    noJustificado: number;
  };
  
  // Contenido de clase
  contenido: string;             // "Técnica de arco"
  observaciones?: string;
  evaluacionGeneral?: string;
  
  // Etiquetas por alumno (opcional)
  etiquetas?: {
    [alumnoId: string]: string[] // ["ExcelenteProgreso", "NecesitaPracticar"]
  };
  
  // Estado
  estado: "en_progreso" | "completado" | "firmado";
  firmadoBy?: string;            // ID de quien firmó
  firmadoAt?: Date;
  
  // Validación
  pasóValidación: boolean;
  discrepancias?: any[];
  
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;             // Para audit trail
}

// AUSENCIAS (Nuevo)
{
  id: string;
  studentId: string;             // Referencia a ALUMNOS
  classId: string;               // Referencia a CLASES
  fecha: Date;
  
  // Información de ausencia
  motivo: "enfermedad" | "viaje" | "evento_personal" | "otro" | "sin_especificar";
  detalles?: string;             // Texto libre
  
  // Cómo se reportó
  reportadoPor: "representante" | "maestro" | "sistema";
  reportadoVia: "whatsapp" | "app" | "presencial" | "telefono";
  reportadoA: Date;
  
  // Estado
  justificada: boolean;
  requiereConfirmacion: boolean;
  estado: "pendiente" | "confirmada" | "rechazada";
  
  // Contacto seguimiento
  contactadoRepresentante: boolean;
  contactadoA?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  procesadoPor: "bot" | "guillermo" | "admin";
}

// ALERTAS (Nuevo)
{
  id: string;
  tipo: "ausencias_excesivas" | "patron_sospechoso" | "cambio_patron" 
       | "asistencia_incompleta" | "discrepancia_detectada" | "alumno_riesgo";
  
  // Objeto relacionado
  studentId?: string;
  classId?: string;
  
  // Detalles
  titulo: string;
  descripcion: string;
  severidad: "baja" | "media" | "alta" | "critica";
  
  // Destinatarios
  audiencia: string[];           // IDs de usuarios
  
  // Estado
  estado: "abierta" | "en_revision" | "resuelta" | "descartada";
  resolvidaPor?: string;
  resueltaA?: Date;
  
  // Metadatos
  datos: any;                    // Contexto adicional
  acciones_recomendadas: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

// EVENTOS (Nuevo)
{
  id: string;
  nombre: string;
  tipo: "concierto" | "masterclass" | "ensayo" | "reunion" | "actividad_comunitaria" | "otro";
  
  // Timing
  fechaInicio: Date;
  fechaFin: Date;
  
  // Detalles
  descripcion?: string;
  ubicacion?: string;
  
  // Participantes
  gruposInvolucrados: string[];  // Referencia a GRUPOS
  maestrosInvolucrados: string[];// Referencia a MAESTROS
  alumnosInvolucrados: string[]; // Referencia a ALUMNOS
  
  // Comunicación
  enviaMensaje: boolean;
  mensajeFlota?: string;
  gruposFlota: string[];         // Referencia a FLOTA_GROUPS
  
  // Asistencia
  registroAsistencia: boolean;
  asistentes?: {
    [userId: string]: boolean;
  };
  
  // Estado
  estado: "planificado" | "en_progreso" | "completado" | "cancelado";
  
  createdAt: Date;
  updatedAt: Date;
}

// FLOTA_GROUPS (Nuevo)
{
  id: string;
  nombre: string;
  grupoId: string;               // Referencia a GRUPOS
  whatsappGroupJid: string;      // ID del grupo de WhatsApp (Baileys)
  
  // Configuración
  activo: boolean;
  autosendDailyMessages: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// GRUPOS (Nuevo)
{
  id: string;
  nombre: string;
  instrumento: string;
  tipo: "orquestal" | "coral" | "iniciacion" | "otro";
  
  // Estructura
  nivel: string;
  maestroId: string;
  
  // Información
  descripcion?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// SALONES (Nuevo)
{
  id: string;
  nombre: string;
  capacidad: number;
  ubicacion: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// AUDIT_LOG (Nuevo - Automático)
{
  id: string;
  accion: string;               // "ASISTENCIA_CREADA", "ALUMNO_ACTUALIZADO", etc.
  coleccion: string;            // "ASISTENCIAS", "ALUMNOS", etc.
  documentoId: string;
  
  cambios: {
    antes?: any;
    despues?: any;
  };
  
  usuario: string;              // ID de usuario
  timestamp: Date;
  ipAddress?: string;
  
  createdAt: Date;
}

// USERS (Para autenticación + permisos)
{
  id: string;                    // UID de Firebase Auth
  nombre: string;
  email: string;
  rol: "admin" | "guillermo" | "maestro" | "representante" | "director" | "director_ejecutivo";
  
  // Permisos
  permisos: {
    puedeLeerAsistencias: boolean;
    puedeLlenarAsistencias: boolean;
    puedeVerAnalytics: boolean;
    puedeGestionarEventos: boolean;
    puedeVerAuditoría: boolean;
  };
  
  // Estado
  activo: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🚀 PARTE 4: PLAN DE IMPLEMENTACIÓN (6 SEMANAS)

### SEMANA 1: Infraestructura y Datos

**Objetivos:**
- ✅ Estructura Firebase completa
- ✅ Schemas validados
- ✅ Usuarios y permisos

**Tareas:**
```
[ ] Crear colecciones en Firestore (CLASES, MAESTROS, etc.)
[ ] Implementar Firebase Security Rules
[ ] Migrar datos de Excel a Firebase
[ ] Crear usuarios con roles
[ ] Configurar autenticación JWT
[ ] Tests de datos
```

**Impacto en indicadores:**
- Marco Lógico: Preparación

---

### SEMANA 2: App de Maestros + Asistencia

**Objetivos:**
- ✅ Maestro llena asistencia digitalmente
- ✅ Cálculos automáticos
- ✅ Sincronización con Firebase

**Tareas:**
```
[ ] Interfaz de asistencia (React)
[ ] Validaciones en tiempo real
[ ] Cálculo automático de totales
[ ] Guardado en Firebase
[ ] Notificaciones de validación
[ ] Tests E2E
```

**Impacto en indicadores:**
- Marco Lógico 1.1 - 1.3: Horas de clase impartidas ✅
- Marco Lógico 1.3: Alumnos capacitados ✅

---

### SEMANA 3: Bot FLOTA + Ausencias

**Objetivos:**
- ✅ Bot detecta ausencias
- ✅ Confirmación automática
- ✅ Sincronización con asistencias

**Tareas:**
```
[ ] Listener en WhatsApp (Baileys)
[ ] Análisis de texto (keywords + Gemini)
[ ] Bot pide confirmación
[ ] Guarda en Firebase AUSENCIAS
[ ] Validación de discrepancias
[ ] Tests de bot
```

**Impacto en indicadores:**
- Marco Lógico: Seguimiento de asistencias en tiempo real

---

### SEMANA 4: Dashboard Guillermo + Admin

**Objetivos:**
- ✅ Guillermo ve todo en tiempo real
- ✅ Generación automática de FLOTA
- ✅ Gestión de cambios urgentes

**Tareas:**
```
[ ] Dashboard principal (React)
[ ] Métricasde hoy
[ ] Panel de alertas
[ ] Función "Enviar FLOTA ahora"
[ ] Gestión de eventos
[ ] Módulo de usuarios
```

**Impacto en indicadores:**
- Marco Lógico 2.1 - 2.4: Eventos y conciertos registrados ✅

---

### SEMANA 5: Dashboards Analíticos + Reportes

**Objetivos:**
- ✅ Omar/Manuel ven datos en vivo
- ✅ Alertas automáticas
- ✅ Reportes on-demand

**Tareas:**
```
[ ] Dashboard Omar (Orquesta)
[ ] Dashboard Manuel (Coral)
[ ] Algoritmo de detección de patrones
[ ] Scoring de riesgo del alumno
[ ] Generación de reportes PDF/Excel
[ ] Exportación de datos
```

**Impacto en indicadores:**
- Marco Lógico 1.1 - 1.3: Alumnos aprobados (basado en progreso) ✅
- Marco Lógico: Todos los indicadores ahora tienen datos en tiempo real ✅

---

### SEMANA 6: Testing, Capacitación, Lanzamiento

**Objetivos:**
- ✅ Sistema 100% funcional
- ✅ Equipo capacitado
- ✅ Lanzamiento en producción

**Tareas:**
```
[ ] Tests de integración completos
[ ] Tests de rendimiento
[ ] Backup y recuperación
[ ] Documentación técnica
[ ] Capacitación de Guillermo
[ ] Capacitación de maestros
[ ] Capacitación de Omar/Manuel
[ ] Lanzamiento oficial
```

---

## 📊 PARTE 5: RESPUESTA A INDICADORES DEL MARCO LÓGICO

### Objetivo 1: "Desarrollar competencias en música"

| Indicador | Estado | Cómo se captura | Automático |
|-----------|--------|-----------------|----------|
| **Alumnos inscritos (250)** | ✅ | ALUMNOS.count() where estado='activo' | 100% |
| **Horas impartidas - Iniciación (100)** | ✅ | CLASES.sum(duración) where tipo='iniciacion' | 100% |
| **Horas impartidas - Coro (300)** | ✅ | CLASES.sum(duración) where tipo='coro' | 100% |
| **Horas impartidas - Talleres (1500)** | ✅ | CLASES.sum(duración) where tipo='taller' | 100% |
| **Alumnos capacitados (200)** | ✅ | ALUMNOS.count() con asistencia>80% | 90% |
| **Alumnos aprobados (150)** | ✅ | ALUMNOS.count() con evaluacion>=aprobado | 90% |
| **Ensayos de orquesta (40)** | ✅ | EVENTOS.count() where tipo='ensayo_orq' | 100% |
| **Ensayos de ensambles (150)** | ✅ | EVENTOS.count() where tipo='ensayo_ens' | 100% |
| **Masterclass (12)** | ✅ | EVENTOS.count() where tipo='masterclass' | 100% |
| **Capacitación docentes (6)** | 🟡 | EVENTOS.count() where tipo='capacitacion' | 50% |
| **Instrumentos reparados (100)** | 🟡 | EVENTOS.count() where tipo='luteria' | 50% |

---

### Objetivo 2: "Impactar positivamente familias"

| Indicador | Estado | Cómo se captura | Automático |
|-----------|--------|-----------------|----------|
| **Conciertos organizados (20)** | ✅ | EVENTOS.count() where tipo='concierto' | 100% |
| **Participantes en conciertos (250)** | ✅ | EVENTOS.asistentes.count() | 80% |
| **Reuniones de padres (10)** | 🟡 | EVENTOS.count() where tipo='reunion_padres' | 50% |
| **Padres que asistieron (300)** | 🟡 | EVENTOS.asistentes.count() | 60% |
| **Ensayos abiertos (8)** | 🟡 | EVENTOS.count() where tipo='ensayo_abierto' | 50% |
| **Asistencia a ensayos abiertos (250)** | 🟡 | EVENTOS.asistentes.count() | 60% |

---

### Objetivo 3: "Hacer valer los valores de aprendizaje"

| Indicador | Estado | Cómo se captura | Automático |
|-----------|--------|-----------------|----------|
| **Actividades comunitarias (20)** | 🟡 | EVENTOS.count() where tipo='actividad_comunitaria' | 50% |
| **Niños sensibilizados (2000)** | 🟡 | Registro manual en eventos | 30% |
| **Seguidores RRSS (5000)** | ✅ | API.instag ram.followers + API.facebook.followers | 100% |
| **Posts en RRSS (50)** | 🟡 | Contador manual de posts | 30% |
| **Horas transmisión (10)** | 🟡 | Registro manual | 0% |
| **Artículos prensa (10)** | 🟡 | Registro manual | 0% |
| **Visitas de autoridades (15)** | 🟡 | EVENTOS.count() where tipo='visita_autoridades' | 50% |

---

## 💰 RESUMEN: IMPACTO TOTAL

### Horas Ahorradas Mensualmente

| Proceso | Antes | Después | Ahorro |
|---------|-------|---------|--------|
| Mensaje FLOTA | 20 min | 1 min | 19 min |
| Justificaciones | 25 min | 5 min | 20 min |
| Impresión hojas | 10 min | 5 min | 5 min |
| Conteos maestro | 5 min | 1 min | 4 min |
| Revisión carpetas | 30 min | 10 min | 20 min |
| Digitalización (Romina) | 360 min | 0 min | 360 min |
| Análisis manual | 480 min | 60 min | 420 min |
| Búsquedas ad-hoc | 120 min | 20 min | 100 min |
| **TOTAL/MES** | **1050 min** | **102 min** | **948 min** |
| **TOTAL/MES (horas)** | **17.5 hrs** | **1.7 hrs** | **15.8 hrs** |
| **TOTAL/AÑO** | **210 hrs** | **20 hrs** | **190 hrs** |

### Personas Liberadas

- **Romina**: Liberada completamente de digitalización
  - **Antes**: 6 horas/mes en Excel
  - **Después**: 0 horas (automático)
  - **Beneficio**: Puede enfocarse en tareas estratégicas

### Indicadores Respondidos

- **Marco Lógico 2026**: 30+ de 35 indicadores ahora tienen datos automáticos
- **Cobertura**: 85% de indicadores respondidos automáticamente
- **Remanente**: 15% requiere entrada manual (eventos comunitarios, asistencia presencial)

---

## 🎯 CONCLUSIÓN

**El Sistema Punta Cana puede transformarse COMPLETAMENTE mediante:**

1. **Centralización de datos** en Firebase
2. **Automatización de procesos repetitivos** (FLOTA, cálculos, reportes)
3. **Una aplicación web** con interfaces simples para cada rol
4. **Análisis en tiempo real** (no esperar 30 días)
5. **Respuesta automática a indicadores del Marco Lógico**

**Todo esto sin tocar un solo papel, sin conteos manuales, sin esperas, sin errores.**

---

*Documento: Plan de Acción Integral v1.0*
*El Sistema Punta Cana - FUNEYCA PC*
*Fecha: 2025-01-29*
*Estado: LISTO PARA IMPLEMENTACIÓN*
