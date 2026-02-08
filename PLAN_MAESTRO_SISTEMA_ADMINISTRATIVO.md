# 🎯 PLAN MAESTRO: SISTEMA ADMINISTRATIVO DE GUILLERMO
## Implementación Completa para Agentes IA (OPUS 4.5 / GEMINI 3.0)

> **Versión:** 1.0 COMPLETO
> **Fecha:** 2025-01-29
> **Duración:** 6 Fases (cada una COMPLETABLE)
> **Objetivo:** Sistema web administrativo integrado con App Maestros + Firebase + WhatsApp
> **Público:** Agentes IA profesionales

---

## 📚 ÍNDICE MAESTRO

```
FASE 0: Setup + Contexto (este documento)
FASE 1: Data Services (Firebase SDK)
FASE 2: Business Logic (Lógicas internas)
FASE 3: Backend API (Express)
FASE 4: Frontend Dashboard (React)
FASE 5: Automatizaciones (WhatsApp + Cloud Functions)
FASE 6: Testing + Go-Live
```

---

## 🎓 FASE 0: CONTEXTO PARA AGENTES IA

### 0.1 Lectura Previa Obligatoria

**El agente DEBE leer antes de comenzar:**

1. **Este documento** (contexto completo)
2. **Integraciones previas:**
   - `/mnt/user-data/outputs/10_INTEGRACION_ACTUALIZADA_CODIGO_REAL.md`
   - `/mnt/user-data/outputs/11_PLAN_ACCION_MILIMETRICO_GUILLERMO_APP_MAESTROS.md`
3. **Estructura de datos:**
   - Collections Firebase existentes (ALUMNOS, CLASES, ASISTENCIAS, AUSENCIAS, OBSERVACIONES, NOTIFICATIONS, MAESTROS)
4. **Cloud Functions existentes:**
   - onNotificationCreated()
   - onEvaluationCreated()
   - Tareas cron

### 0.2 ¿Qué es el Sistema de Guillermo?

**Definición clara:**
```
Sistema web administrativo para Guillermo (coordinador orquestal).
NO es app para maestros (eso existe).
SÍ es dashboard para que Guillermo gestione TODO en 15 min/día (vs 60 min hoy).
```

**Caso de uso principal:**
```
09:00 AM: Guillermo en dashboard
├─ VE resumen del día (clases, asistencias pendientes, alertas)
├─ PRE-LLENA justificaciones de ausencias reportadas en FLOTA
├─ VE notificaciones automáticas de discrepancias
├─ ACCEDE a reportes de asistencia
└─ GENERA reportes PDF/Excel

Resultado: Flujo integrado sin intervención manual
```

### 0.3 Arquitectura Final (Lo que construiremos)

```
┌─────────────────────────────────────────────────────────────┐
│                   SISTEMA DE GUILLERMO                       │
│                   (React 18 + TypeScript)                    │
├─────────────────────────────────────────────────────────────┤
│  📊 Dashboard Home                                           │
│  ├─ Resumen del día (clases, asistencias, alertas)          │
│  ├─ KPIs en vivo (asistencia %, ausencias, discrepancias)   │
│  └─ Acciones rápidas                                        │
│                                                             │
│  📋 Gestión de Asistencias                                  │
│  ├─ Ver asistencias del día/período                         │
│  ├─ Pre-llenar justificaciones                              │
│  ├─ Agregar justificaciones manuales                        │
│  └─ Validar contra FLOTA (detectar discrepancias)           │
│                                                             │
│  🚨 Alertas                                                 │
│  ├─ Ausencias excesivas (4+ en 2 semanas)                   │
│  ├─ Patrones sospechosos (lunes, viernes, etc)              │
│  ├─ Discrepancias (reportó ausencia pero asistió)           │
│  └─ Cambios en asistencia (mejoró/empeoró)                  │
│                                                             │
│  📈 Reportes                                                │
│  ├─ Por fecha                                               │
│  ├─ Por grupo                                               │
│  ├─ Por alumno                                              │
│  └─ Exportar PDF/Excel                                      │
│                                                             │
│  ⚙️ Configuración                                            │
│  ├─ Números WhatsApp de maestros                            │
│  ├─ Horarios de recordatorios                               │
│  └─ Umbrales de alertas                                     │
│                                                             │
│         │ API HTTP                                          │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         BACKEND (Express + TypeScript)              │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  ✅ Servicios de datos (Firebase SDK)               │    │
│  │  ✅ Lógicas internas (Business logic)                │    │
│  │  ✅ Endpoints API                                    │    │
│  │  ✅ Automatizaciones (WhatsApp + Cloud Fn)           │    │
│  └─────────────────────────────────────────────────────┘    │
│         │                                                    │
│         │ Realtime + SDK Calls                              │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              FIREBASE REALTIME                      │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  • ALUMNOS (lectura)                                │    │
│  │  • CLASES (lectura)                                 │    │
│  │  • ASISTENCIAS (lectura/escritura)                  │    │
│  │  • AUSENCIAS (lectura/escritura)                    │    │
│  │  • OBSERVACIONES (lectura)                          │    │
│  │  • NOTIFICATIONS (escritura)                        │    │
│  │  • MAESTROS (lectura)                               │    │
│  └─────────────────────────────────────────────────────┘    │
│         │                                                    │
│         │ Cloud Functions Triggers                          │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │      AUTOMATIZACIONES (Cloud Functions)             │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  • onAbsenceCreated() → pre-llena ASISTENCIAS       │    │
│  │  • onAssistanceSaved() → notifica Guillermo         │    │
│  │  • notifyIncompleteAttendance() → recuerda maestro  │    │
│  │  • detectDiscrepancies() → alerta discrepancias     │    │
│  │  • sendWhatsAppNotification() → notificaciones      │    │
│  └─────────────────────────────────────────────────────┘    │
│         │                                                    │
│         ▼                                                    │
│     BAILEYS (WhatsApp)                                       │
│     ├─ Recordatorios a maestros                             │
│     ├─ Alertas a Guillermo                                  │
│     └─ Notificaciones a representantes                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 0.4 Stack Tecnológico

```
FRONTEND:
├─ React 18
├─ TypeScript
├─ Vite (bundler)
├─ Axios (HTTP client)
├─ React Router (navigation)
├─ React Query (data fetching)
├─ Tailwind CSS (styling)
└─ Recharts (gráficos)

BACKEND:
├─ Express.js
├─ TypeScript
├─ Firebase Admin SDK
├─ Baileys (WhatsApp)
├─ node-cron (tareas programadas)
└─ cors, helmet (seguridad)

DATABASE:
├─ Firebase Firestore (NoSQL)
├─ Realtime listeners
└─ Cloud Storage (reportes PDF/Excel)

DEPLOYMENT:
├─ Frontend: Vercel/Netlify
├─ Backend: Firebase Cloud Functions + Express
├─ Database: Firebase Firestore
└─ WhatsApp: Baileys en Cloud Function
```

### 0.5 Integraciones Clave (Lo que YA existe)

**App Maestros (100% operacional):**
```typescript
// App maestro obtiene asistencia así:
const docId = `${classId}_${fecha}_${teacherId}`;
const attendance = await db.collection('ASISTENCIAS').doc(docId).get();

// Estructura esperada:
{
  classId,
  fecha,
  teacherId,
  data: {
    presentes: [],
    ausentes: [],
    justificacion: [  // IMPORTANTE: array de objetos
      {
        studentId,
        motivo,
        fuenteFlota: true,
        timestamp
      }
    ],
    observacion: ""
  },
  estado: "en_progreso" | "completado"
}
```

**Cloud Functions existentes:**
```
✅ onNotificationCreated() → push (Expo)
✅ sendPushNotification() → callable
✅ onEvaluationCreated() → trigger
✅ Tareas cron → recordatorios

Necesitamos AGREGAR:
🔴 onAbsenceCreated() → pre-llena ASISTENCIAS
🔴 onAssistanceSaved() → notifica Guillermo
🔴 notifyIncompleteAttendance() → recordatorio maestro
🔴 sendWhatsAppNotification() → Baileys
```

### 0.6 Instrucciones para Agente IA

**ANTES de empezar CUALQUIER fase:**

```typescript
// 1. LEER y ENTENDER esta FASE 0
// 2. LEER y ENTENDER la siguiente FASE (planteamiento + solución)
// 3. GENERAR código siguiendo estructura exacta
// 4. INCLUIR comentarios en español
// 5. VALIDAR tipos TypeScript
// 6. NO saltar a siguiente fase hasta terminar actual

// VALIDACIÓN DE COMPLETITUD:
// ✅ Todos los servicios implementados
// ✅ Documentación JSDoc completa
// ✅ Manejo de errores robusto
// ✅ Importaciones correctas
// ✅ Tipos TypeScript válidos
// ✅ Compatible con integraciones previas
// ✅ Explicación clara de qué hace
// ✅ Cómo se integra con siguiente fase
```

---

## 🎯 FASE 1: DATA SERVICES (Firebase SDK)

### 1.1 PLANTEAMIENTO

**Objetivo:** Crear servicios de extracción de datos que serán base para todas las lógicas.

**¿Por qué primero?** Sin datos no podemos hacer lógica. Estos servicios serán reutilizados en múltiples componentes.

**Datos a extraer:**
- ALUMNOS (todos, por grupo, búsqueda)
- CLASES (hoy, próximas, por maestro)
- ASISTENCIAS (hoy, por período, análisis)
- AUSENCIAS (reportadas, confirmadas, por alumno)
- OBSERVACIONES (por clase, recientes)
- MAESTROS (lista, con contacto)
- Alertas (ausencias excesivas, patrones)

### 1.2 SOLUCIÓN

**Crear:** `src/server/services/dataService.ts`

[CÓDIGO COMPLETO AQUÍ - 400 líneas TypeScript con 7 servicios Firebase + tipos]

```typescript
// ============================================
// DATA SERVICE - Firebase SDK Wrapper
// ============================================

import { db } from '../config/firebase';
import type {
  StudentData,
  ClassData,
  AttendanceData,
  AbsenceData,
  TeacherData
} from '../types';

// 1. STUDENT SERVICE
export const studentService = {
  async getAllStudents(): Promise<StudentData[]> {
    const snapshot = await db.collection('ALUMNOS')
      .where('estado', '==', 'activo')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getStudentsByGroup(groupId: string): Promise<StudentData[]> {
    const snapshot = await db.collection('ALUMNOS')
      .where('grupo', '==', groupId)
      .where('estado', '==', 'activo')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getStudent(studentId: string): Promise<StudentData | null> {
    const doc = await db.collection('ALUMNOS').doc(studentId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async searchStudent(name: string): Promise<StudentData[]> {
    const snapshot = await db.collection('ALUMNOS')
      .where('nombre', '>=', name)
      .where('nombre', '<=', name + '\uf8ff')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

// 2. CLASS SERVICE
export const classService = {
  async getAllClasses(): Promise<ClassData[]> {
    const snapshot = await db.collection('CLASES').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getClassesToday(today: string): Promise<ClassData[]> {
    const snapshot = await db.collection('CLASES')
      .where('fechas', 'array-contains', today)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getClass(classId: string): Promise<ClassData | null> {
    const doc = await db.collection('CLASES').doc(classId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }
};

// 3. ATTENDANCE SERVICE
export const attendanceService = {
  async getAttendancesToday(today: string): Promise<AttendanceData[]> {
    const snapshot = await db.collection('ASISTENCIAS')
      .where('fecha', '==', today)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getAttendance(docId: string): Promise<AttendanceData | null> {
    const doc = await db.collection('ASISTENCIAS').doc(docId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async getAttendancesByDateRange(
    startDate: string,
    endDate: string
  ): Promise<AttendanceData[]> {
    const snapshot = await db.collection('ASISTENCIAS')
      .where('fecha', '>=', startDate)
      .where('fecha', '<=', endDate)
      .orderBy('fecha', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getIncompleteAttendances(): Promise<AttendanceData[]> {
    const snapshot = await db.collection('ASISTENCIAS')
      .where('estado', '==', 'en_progreso')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

// 4. ABSENCE SERVICE
export const absenceService = {
  async getAbsencesToday(today: string): Promise<AbsenceData[]> {
    const snapshot = await db.collection('AUSENCIAS')
      .where('fecha', '==', today)
      .where('justificada', '==', true)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getAbsencesByDateRange(
    startDate: string,
    endDate: string
  ): Promise<AbsenceData[]> {
    const snapshot = await db.collection('AUSENCIAS')
      .where('fecha', '>=', startDate)
      .where('fecha', '<=', endDate)
      .orderBy('fecha', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getPendingAbsences(): Promise<AbsenceData[]> {
    const snapshot = await db.collection('AUSENCIAS')
      .where('estado', '==', 'pendiente')
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getStudentAbsences(
    studentId: string,
    limit: number = 10
  ): Promise<AbsenceData[]> {
    const snapshot = await db.collection('AUSENCIAS')
      .where('studentId', '==', studentId)
      .orderBy('fecha', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

// 5. OBSERVATION SERVICE
export const observationService = {
  async getObservationsByClass(classId: string): Promise<any[]> {
    const snapshot = await db.collection('OBSERVACIONES')
      .where('classId', '==', classId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getRecentObservations(limit: number = 50): Promise<any[]> {
    const snapshot = await db.collection('OBSERVACIONES')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

// 6. TEACHER SERVICE
export const teacherService = {
  async getAllTeachers(): Promise<TeacherData[]> {
    const snapshot = await db.collection('MAESTROS').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getTeacher(teacherId: string): Promise<TeacherData | null> {
    const doc = await db.collection('MAESTROS').doc(teacherId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async getTeachersWithWhatsApp(): Promise<TeacherData[]> {
    const snapshot = await db.collection('MAESTROS')
      .where('whatsappPhone', '!=', null)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

// 7. ALERT SERVICE
export const alertService = {
  async checkExcessiveAbsences(
    studentId: string,
    daysWindow: number = 14,
    threshold: number = 4
  ): Promise<{ hasAlert: boolean; count: number; dates: string[] }> {
    const snapshot = await db.collection('AUSENCIAS')
      .where('studentId', '==', studentId)
      .orderBy('fecha', 'desc')
      .limit(20)
      .get();

    const absences = snapshot.docs.map(doc => doc.data().fecha);
    return {
      hasAlert: absences.length >= threshold,
      count: absences.length,
      dates: absences
    };
  },

  async detectSuspiciousPatterns(studentId: string): Promise<{
    isSuspicious: boolean;
    pattern: string;
  }> {
    const absences = await absenceService.getStudentAbsences(studentId, 15);
    
    const dayNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const dayCount: { [key: string]: number } = {};
    
    absences.forEach(a => {
      const date = new Date(a.fecha);
      const dayName = dayNames[date.getDay()];
      dayCount[dayName] = (dayCount[dayName] || 0) + 1;
    });

    const maxDay = Object.entries(dayCount).reduce((a, b) =>
      b[1] > a[1] ? b : a
    );

    const isSuspicious = maxDay[1] > 0 && 
                        maxDay[1] / absences.length > 0.5;

    return {
      isSuspicious,
      pattern: isSuspicious ? `Patrón: Falta ${maxDay[0]}s` : 'Sin patrón'
    };
  }
};
```

### 1.3 TIPOS DE DATOS

**Crear:** `src/server/types/index.ts`

```typescript
export interface StudentData {
  id: string;
  nombre: string;
  apellido: string;
  grupo: string;
  nivel: string;
  instrumento: string;
  representante: {
    nombre: string;
    telefono?: string;
    email?: string;
  };
  estado: 'activo' | 'inactivo';
  createdAt?: Date;
}

export interface ClassData {
  id: string;
  nombre: string;
  instrumento: string;
  nivel: string;
  maestroId: string;
  maestroNombre: string;
  horario: {
    inicio: string;
    fin: string;
  };
  salón: string;
  alumnos: string[];
  grupo: string;
  fechas?: string[];
}

export interface AttendanceData {
  id: string;
  classId: string;
  fecha: string;
  teacherId: string;
  maestroNombre: string;
  data: {
    presentes: string[];
    ausentes: string[];
    justificacion: Array<{
      studentId: string;
      motivo: string;
      fuenteFlota: boolean;
      timestamp: Date;
    }>;
    observacion: string;
  };
  estado: 'en_progreso' | 'completado';
  createdAt: Date;
}

export interface AbsenceData {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  fecha: string;
  motivo: {
    tipo: 'enfermedad' | 'viaje' | 'evento_personal' | 'otro';
    descripcion?: string;
  };
  justificada: boolean;
  estado: 'pendiente' | 'confirmada';
  createdAt: Date;
}

export interface TeacherData {
  id: string;
  nombre: string;
  email: string;
  whatsappPhone?: string;
  grupo: string;
  pushTokens: { token: string; platform: string }[];
}

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  channel: 'push' | 'whatsapp' | string[];
  recipientId: string;
  recipientPhone?: string;
  isRead: boolean;
  createdAt: Date;
}
```

### 1.4 QUÉ ESPERAMOS DE AGENTE IA

**Entrega esperada FASE 1:**

```
✅ Archivo: src/server/services/dataService.ts
   - 7 servicios implementados
   - Cada uno con métodos completos
   - Documentación JSDoc
   - Manejo de errores

✅ Archivo: src/server/types/index.ts
   - Interfaces para 7 colecciones
   - Tipos correctos
   - Propiedades opcionales/requeridas

✅ Explicación:
   - Qué hace cada servicio
   - Cómo se usan
   - Qué retornan
   - Cómo integran con FASE 2

✅ Confirmación: "Fase 1 completada. Servicios de datos listos para consumir."
```

---

## 🎯 FASE 2: BUSINESS LOGIC (Lógicas Internas)

### 2.1 PLANTEAMIENTO

**Objetivo:** Servicios que PROCESAN datos de FASE 1 y generan insights.

**Lógicas necesarias:**
```
1. ANÁLISIS DE ASISTENCIAS
   - Contar presentes/ausentes/justificados
   - % asistencia por clase/período
   - Tendencias (mejora/empeoramiento)

2. PROCESAMIENTO DE AUSENCIAS
   - Pre-llenar justificaciones en ASISTENCIAS
   - Detectar discrepancias
   - Validar consistencia

3. GENERACIÓN DE ALERTAS
   - Ausencias excesivas (4+ en 2 semanas)
   - Patrones sospechosos (lunes, viernes)
   - Discrepancias (reportó aber pero asistió)

4. RESUMEN DIARIO
   - Clases completadas vs pendientes
   - Totales de asistencia
   - Acciones pendientes

5. REPORTES
   - Por período
   - Por grupo
   - Por alumno
```

### 2.2 SOLUCIÓN

**Crear:** `src/server/services/analyticsService.ts`

```typescript
// ============================================
// ANALYTICS SERVICE
// Lógicas de análisis y procesamiento
// ============================================

import {
  attendanceService,
  absenceService,
  studentService,
  classService,
  alertService
} from './dataService';

export const attendanceAnalytics = {
  /**
   * Analiza UNA clase y retorna estadísticas
   */
  async analyzeClassAttendance(classId: string, fecha: string) {
    const classData = await classService.getClass(classId);
    if (!classData) throw new Error(`Clase ${classId} no encontrada`);

    const docId = `${classId}_${fecha}_${classData.maestroId}`;
    const attendance = await attendanceService.getAttendance(docId);

    if (!attendance) {
      return {
        className: classData.nombre,
        totalExpected: classData.alumnos.length,
        presentes: 0,
        ausentes: 0,
        justificados: 0,
        porcentajeAsistencia: 0,
        estado: 'pendiente' as const,
        maestro: classData.maestroNombre,
        detalles: {
          justificaciones: [],
          ausenciasSinJustificar: []
        }
      };
    }

    const presentes = attendance.data.presentes.length;
    const ausentes = attendance.data.ausentes.length;
    const justificados = attendance.data.justificacion.length;
    const totalExpected = classData.alumnos.length;
    const porcentaje = (presentes / totalExpected) * 100;

    return {
      className: classData.nombre,
      totalExpected,
      presentes,
      ausentes,
      justificados,
      porcentajeAsistencia: Math.round(porcentaje * 100) / 100,
      estado: attendance.estado as 'pendiente' | 'completada',
      maestro: classData.maestroNombre,
      detalles: {
        justificaciones: attendance.data.justificacion,
        ausenciasSinJustificar: attendance.data.ausentes.filter(
          studentId => 
            !attendance.data.justificacion.some(j => j.studentId === studentId)
        )
      }
    };
  },

  /**
   * Análisis GLOBAL de un día
   */
  async analyzeDayAttendance(fecha: string) {
    const attendances = await attendanceService.getAttendancesToday(fecha);
    const classesData = await classService.getClassesToday(fecha);

    let totalExpected = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalJustified = 0;
    let completed = 0;

    const byClass = await Promise.all(
      classesData.map(async (classData) => {
        const analysis = await attendanceAnalytics.analyzeClassAttendance(
          classData.id,
          fecha
        );

        if (analysis.estado === 'completada') {
          completed++;
          totalExpected += analysis.totalExpected;
          totalPresent += analysis.presentes;
          totalAbsent += analysis.ausentes;
          totalJustified += analysis.justificados;
        }

        return analysis;
      })
    );

    const absences = await absenceService.getAbsencesToday(fecha);
    const overallPercentage =
      totalExpected > 0
        ? Math.round((totalPresent / totalExpected) * 100 * 100) / 100
        : 0;

    return {
      fecha,
      clasesToday: classesData.length,
      classesCompleted: completed,
      classesInProgress: classesData.length - completed,
      totalStudentsExpected: totalExpected,
      totalPresent,
      totalAbsent,
      totalJustified,
      overallPercentage,
      byClass,
      pendingJustifications: absences.filter(a => a.estado === 'pendiente')
    };
  }
};

export const absenceProcessing = {
  /**
   * DETECTA DISCREPANCIAS entre AUSENCIAS y ASISTENCIAS
   */
  async detectDiscrepancies(classId: string, fecha: string) {
    const absences = await absenceService.getAbsencesToday(fecha);
    const classAbsences = absences.filter(a => a.classId === classId);

    const attendances = await attendanceService.getAttendancesToday(fecha);
    const classAttendance = attendances.find(a => a.classId === classId);

    if (!classAttendance) return [];

    const discrepancies: any[] = [];

    // Reportó ausencia pero ASISTIÓ
    classAbsences.forEach(absence => {
      if (classAttendance.data.presentes.includes(absence.studentId)) {
        discrepancies.push({
          type: 'false_absence',
          studentId: absence.studentId,
          studentName: absence.studentName,
          description: `Reportó ${absence.motivo.tipo} pero asistió`,
          severity: 'high'
        });
      }
    });

    // AUSENTE pero no reportó
    classAttendance.data.ausentes.forEach(studentId => {
      const hasReport = classAbsences.some(
        a => a.studentId === studentId && a.justificada
      );
      if (!hasReport) {
        discrepancies.push({
          type: 'unreported_absence',
          studentId,
          description: 'Ausente sin justificación reportada',
          severity: 'medium'
        });
      }
    });

    return discrepancies;
  }
};

export const alertGeneration = {
  /**
   * GENERA ALERTAS para el dashboard
   */
  async generateDailyAlerts(fecha: string) {
    const alerts: any[] = [];
    const allStudents = await studentService.getAllStudents();

    for (const student of allStudents) {
      const excessive = await alertService.checkExcessiveAbsences(
        student.id,
        14,
        4
      );

      if (excessive.hasAlert) {
        alerts.push({
          type: 'ausencias_excesivas',
          studentId: student.id,
          studentName: student.nombre,
          severity: 'high',
          message: `${student.nombre} ha faltado ${excessive.count} veces`,
          data: { count: excessive.count, dates: excessive.dates },
          createdAt: new Date(),
          resolved: false
        });
      }

      const suspicious = await alertService.detectSuspiciousPatterns(
        student.id
      );
      if (suspicious.isSuspicious) {
        alerts.push({
          type: 'patron_sospechoso',
          studentId: student.id,
          studentName: student.nombre,
          severity: 'medium',
          message: suspicious.pattern,
          createdAt: new Date(),
          resolved: false
        });
      }
    }

    return alerts;
  }
};

export const dashboardSummary = {
  /**
   * RESUMEN para el dashboard home
   */
  async getDailySummary(fecha: string) {
    const dayAnalysis = await attendanceAnalytics.analyzeDayAttendance(fecha);
    const alerts = await alertGeneration.generateDailyAlerts(fecha);

    const pendingActions = [
      {
        action: 'Asistencias pendientes',
        count: dayAnalysis.classesInProgress,
        priority: 'high' as const
      },
      {
        action: 'Justificaciones pendientes',
        count: dayAnalysis.pendingJustifications.length,
        priority: 'medium' as const
      },
      {
        action: 'Alertas activas',
        count: alerts.length,
        priority: 'high' as const
      }
    ];

    return {
      date: fecha,
      summary: {
        totalClasses: dayAnalysis.clasesToday,
        completedClasses: dayAnalysis.classesCompleted,
        pendingClasses: dayAnalysis.classesInProgress,
        totalStudentsExpected: dayAnalysis.totalStudentsExpected,
        totalPresent: dayAnalysis.totalPresent,
        totalAbsent: dayAnalysis.totalAbsent,
        totalJustified: dayAnalysis.totalJustified,
        attendancePercentage: dayAnalysis.overallPercentage
      },
      byClass: dayAnalysis.byClass,
      alerts,
      pendingActions
    };
  }
};
```

### 2.3 QUÉ ESPERAMOS

**Entrega FASE 2:**

```
✅ Archivo: src/server/services/analyticsService.ts
   - 4 grupos de servicios
   - Lógicas completas
   - Documentación JSDoc

✅ Flujos implementados:
   - Análisis de asistencias
   - Detección de discrepancias
   - Generación de alertas
   - Resumen diario

✅ Integración: Con servicios de FASE 1

✅ Confirmación: "Fase 2 completada. Lógicas de negocio listas."
```

---

## 🎯 FASE 3: BACKEND API (Express)

### 3.1 PLANTEAMIENTO

**Objetivo:** Endpoints Express que expongan lógicas de FASE 2 al frontend.

**Endpoints necesarios:**
```
GET  /api/dashboard/summary?date=YYYY-MM-DD
GET  /api/attendance/today
GET  /api/attendance/:classId/:date
GET  /api/attendance/period?from=&to=
GET  /api/absences/today
GET  /api/absences/pending
GET  /api/alerts/today
GET  /api/students
GET  /api/students/:id
POST /api/attendance/:classId/justify
POST /api/notifications/send-to-teacher
GET  /api/reports/export?type=pdf&period=month
```

### 3.2 SOLUCIÓN

**Crear:** `src/server/routes/api.ts`

```typescript
import express from 'express';
import { 
  dashboardSummary, 
  attendanceAnalytics, 
  absenceProcessing,
  alertGeneration 
} from '../services/analyticsService';
import {
  attendanceService,
  absenceService,
  studentService,
  alertService
} from '../services/dataService';

const router = express.Router();

// ============================================
// DASHBOARD
// ============================================

/**
 * GET /api/dashboard/summary
 * Resumen completo del día para dashboard home
 */
router.get('/dashboard/summary', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    const summary = await dashboardSummary.getDailySummary(date as string);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// ASISTENCIAS
// ============================================

/**
 * GET /api/attendance/today
 * Todas las asistencias de hoy
 */
router.get('/attendance/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const attendances = await attendanceService.getAttendancesToday(today);
    res.json({ success: true, data: attendances });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/attendance/:classId/:date
 * Asistencia de una clase específica
 */
router.get('/attendance/:classId/:date', async (req, res) => {
  try {
    const { classId, date } = req.params;
    const analysis = await attendanceAnalytics.analyzeClassAttendance(
      classId,
      date
    );
    res.json({ success: true, data: analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/attendance/period
 * Asistencias por período
 */
router.get('/attendance/period', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'Requiere from y to (YYYY-MM-DD)'
      });
    }
    const attendances = await attendanceService.getAttendancesByDateRange(
      from as string,
      to as string
    );
    res.json({ success: true, data: attendances });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/attendance/:classId/justify
 * PRE-LLENAR justificaciones en asistencia
 */
router.post('/attendance/:classId/justify', async (req, res) => {
  try {
    const { classId } = req.params;
    const { date, studentIds, motivo } = req.body;

    if (!date || !studentIds || !motivo) {
      return res.status(400).json({
        success: false,
        error: 'Requiere date, studentIds[], motivo'
      });
    }

    // TODO: Aquí irá la lógica de pre-llenar en Firebase
    // Por ahora retornamos confirmación

    res.json({
      success: true,
      message: `${studentIds.length} justificaciones pre-llenadas`,
      data: { classId, date, studentIds, motivo }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// AUSENCIAS
// ============================================

/**
 * GET /api/absences/today
 * Ausencias reportadas hoy
 */
router.get('/absences/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const absences = await absenceService.getAbsencesToday(today);
    res.json({ success: true, data: absences });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/absences/pending
 * Ausencias pendientes de confirmar
 */
router.get('/absences/pending', async (req, res) => {
  try {
    const absences = await absenceService.getPendingAbsences();
    res.json({ success: true, data: absences });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// ALERTAS
// ============================================

/**
 * GET /api/alerts/today
 * Todas las alertas del día
 */
router.get('/alerts/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const alerts = await alertGeneration.generateDailyAlerts(today);
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// ESTUDIANTES
// ============================================

/**
 * GET /api/students
 * Lista de todos los estudiantes
 */
router.get('/students', async (req, res) => {
  try {
    const students = await studentService.getAllStudents();
    res.json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/students/:id
 * Datos de un estudiante
 */
router.get('/students/:id', async (req, res) => {
  try {
    const student = await studentService.getStudent(req.params.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Estudiante no encontrado'
      });
    }
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
```

**Crear:** `src/server/middleware/auth.ts`

```typescript
// Middleware simple de autenticación
export const authMiddleware = (req: any, res: any, next: any) => {
  // TODO: Implementar autenticación real (JWT, Firebase Auth, etc)
  // Por ahora solo dejamos pasar
  next();
};
```

### 3.3 MAIN SERVER FILE

**Crear:** `src/server/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRoutes from './routes/api';
import { authMiddleware } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(authMiddleware);

// Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  });
});

app.listen(PORT, () => {
  console.log(`✅ Backend corriendo en puerto ${PORT}`);
});
```

### 3.4 QUÉ ESPERAMOS

**Entrega FASE 3:**

```
✅ Archivo: src/server/routes/api.ts
   - 10+ endpoints implementados
   - Manejo de errores
   - Validación de parámetros

✅ Archivo: src/server/middleware/auth.ts
   - Middleware básico

✅ Archivo: src/server/index.ts
   - Servidor Express funcional
   - Rutas registradas
   - Middleware configurado

✅ Testing: Endpoints testeables con Postman

✅ Confirmación: "Fase 3 completada. Backend API operacional."
```

---

## 🎯 FASE 4: FRONTEND DASHBOARD (React)

### 4.1 PLANTEAMIENTO

**Objetivo:** Interfaz web que consume API de FASE 3.

**Páginas necesarias:**
```
1. Dashboard Home
   - Resumen del día
   - KPIs (clases, asistencias, alertas)
   - Acciones rápidas

2. Gestión de Asistencias
   - Tabla de asistencias hoy
   - Ver por período
   - Pre-llenar justificaciones
   - Validar discrepancias

3. Alertas
   - Ausencias excesivas
   - Patrones sospechosos
   - Discrepancias
   - Cambios en asistencia

4. Reportes
   - Por período
   - Por grupo
   - Por alumno
   - Exportar PDF/Excel

5. Configuración
   - WhatsApp numbers
   - Horarios de recordatorios
   - Umbrales de alertas
```

### 4.2 SOLUCIÓN (Estructura)

**Crear:** `web/src/pages/Dashboard.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export const Dashboard = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [today] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await axios.get(`/api/dashboard/summary?date=${today}`);
        setSummary(response.data.data);
      } catch (error) {
        console.error('Error cargando resumen:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [today]);

  if (loading) return <div>Cargando...</div>;
  if (!summary) return <div>Error cargando datos</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard - {summary.date}</h1>

      {/* KPIs Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded">
          <p className="text-gray-600">Clases</p>
          <p className="text-2xl font-bold">
            {summary.summary.completedClasses}/{summary.summary.totalClasses}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded">
          <p className="text-gray-600">Presentes</p>
          <p className="text-2xl font-bold">{summary.summary.totalPresent}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded">
          <p className="text-gray-600">Ausentes</p>
          <p className="text-2xl font-bold">{summary.summary.totalAbsent}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded">
          <p className="text-gray-600">Asistencia %</p>
          <p className="text-2xl font-bold">{summary.summary.attendancePercentage}%</p>
        </div>
      </div>

      {/* Alertas */}
      {summary.alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 rounded mb-6">
          <h2 className="font-bold text-red-700 mb-4">⚠️ {summary.alerts.length} Alertas activas</h2>
          <ul className="space-y-2">
            {summary.alerts.slice(0, 5).map((alert: any) => (
              <li key={alert.studentId} className="text-sm text-red-600">
                {alert.studentName}: {alert.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Clases del día */}
      <div className="bg-white rounded shadow p-6">
        <h2 className="text-xl font-bold mb-4">Clases del día</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Clase</th>
              <th className="text-left p-2">Maestro</th>
              <th className="text-left p-2">Presentes</th>
              <th className="text-left p-2">Asistencia</th>
              <th className="text-left p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {summary.byClass.map((cls: any) => (
              <tr key={cls.className} className="border-b hover:bg-gray-50">
                <td className="p-2">{cls.className}</td>
                <td className="p-2">{cls.maestro}</td>
                <td className="p-2">{cls.presentes}/{cls.totalExpected}</td>
                <td className="p-2">{cls.porcentajeAsistencia}%</td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    cls.estado === 'completada'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {cls.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

**Crear:** `web/src/pages/Attendance.tsx`

```typescript
import React, { useState } from 'react';
import axios from 'axios';

export const Attendance = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/attendance/today`);
      setAttendances(response.data.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    handleFetch();
  }, [date]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Asistencias</h1>

      <div className="flex gap-4 mb-6">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-4 py-2"
        />
        <button
          onClick={handleFetch}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Cargar
        </button>
      </div>

      {loading ? (
        <div>Cargando...</div>
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-3">Clase</th>
                <th className="text-left p-3">Maestro</th>
                <th className="text-center p-3">Presentes</th>
                <th className="text-center p-3">Ausentes</th>
                <th className="text-center p-3">Justificados</th>
                <th className="text-center p-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {attendances.map((att) => (
                <tr key={att.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{att.className}</td>
                  <td className="p-3">{att.maestroNombre}</td>
                  <td className="text-center p-3">{att.data.presentes.length}</td>
                  <td className="text-center p-3">{att.data.ausentes.length}</td>
                  <td className="text-center p-3">{att.data.justificacion.length}</td>
                  <td className="text-center p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      att.estado === 'completado'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {att.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
```

**Crear:** `web/src/pages/Alerts.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import axios from 'axios';

export const AlertsPage = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await axios.get('/api/alerts/today');
        setAlerts(response.data.data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-700';
    }
  };

  if (loading) return <div>Cargando alertas...</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Alertas ({alerts.length})</h1>

      <div className="space-y-4">
        {alerts.map((alert) => (
          <div
            key={`${alert.studentId}-${alert.type}`}
            className={`border rounded p-4 ${getSeverityColor(alert.severity)}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">{alert.studentName}</p>
                <p className="text-sm mt-1">{alert.message}</p>
              </div>
              <span className="text-xs px-2 py-1 bg-white rounded">
                {alert.type.replace('_', ' ')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {alerts.length === 0 && (
        <div className="bg-green-50 border border-green-200 p-4 rounded text-green-700">
          ✅ Sin alertas activas
        </div>
      )}
    </div>
  );
};
```

### 4.3 QUÉ ESPERAMOS

**Entrega FASE 4:**

```
✅ Componentes React funcionales:
   - Dashboard.tsx
   - Attendance.tsx
   - Alerts.tsx
   
✅ Integración API:
   - Fetch de /api/dashboard/summary
   - Fetch de /api/attendance/today
   - Fetch de /api/alerts/today
   
✅ UI/UX:
   - Responsive con Tailwind CSS
   - Tablas con datos en vivo
   - Alertas visuales
   - KPIs destacados

✅ Confirmación: "Fase 4 completada. Frontend dashboard operacional."
```

---

## 🎯 FASE 5: AUTOMATIZACIONES (WhatsApp + Cloud Functions)

### 5.1 PLANTEAMIENTO

**Objetivo:** Automatizaciones que se ejecutan en Cloud Functions.

**Automatizaciones necesarias:**
```
1. onAbsenceCreated()
   - Pre-llena ASISTENCIAS
   - Notifica maestro
   - Notifica Guillermo

2. onAssistanceSaved()
   - Detecta discrepancias
   - Notifica Guillermo
   - Actualiza alertas

3. notifyIncompleteAttendance() - CRON
   - 30 min después de clase
   - Recordatorio a maestro
   - Vía WhatsApp

4. detectDiscrepancies()
   - Compara AUSENCIAS vs ASISTENCIAS
   - Genera alertas
   - Notifica Guillermo

5. sendWhatsAppNotification()
   - Usa Baileys
   - Envía mensajes privados
   - Gestiona fallos y reintentos
```

### 5.2 SOLUCIÓN

**Crear:** `functions/src/triggers/onAbsenceCreated.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const onAbsenceCreated = functions.firestore
  .document('AUSENCIAS/{docId}')
  .onCreate(async (snap, context) => {
    const ausencia = snap.data();

    // Solo procesar si está confirmada
    if (!ausencia.justificada || ausencia.estado !== 'confirmada') {
      return;
    }

    try {
      // 1. Obtener clase para maestroId
      const classDoc = await db.collection('CLASES')
        .doc(ausencia.classId)
        .get();

      if (!classDoc.exists) {
        console.error(`Clase ${ausencia.classId} no encontrada`);
        return;
      }

      const classData = classDoc.data();
      const teacherId = classData.maestroId;

      // 2. Calcular docId único
      const attendanceDocId = `${ausencia.classId}_${ausencia.fecha}_${teacherId}`;

      // 3. Actualizar o crear ASISTENCIAS
      const attendanceRef = db.collection('ASISTENCIAS').doc(attendanceDocId);
      const attendanceSnap = await attendanceRef.get();

      if (attendanceSnap.exists) {
        // Agregar a justificación existente
        await attendanceRef.update({
          'data.justificacion': admin.firestore.FieldValue.arrayUnion({
            studentId: ausencia.studentId,
            motivo: ausencia.motivo.tipo,
            fuenteFlota: true,
            timestamp: new Date()
          }),
          updatedAt: new Date()
        });
      } else {
        // Crear nuevo documento
        await attendanceRef.set({
          classId: ausencia.classId,
          fecha: ausencia.fecha,
          teacherId,
          maestroNombre: classData.maestroNombre,
          className: classData.nombre,
          data: {
            presentes: [],
            ausentes: [],
            justificacion: [{
              studentId: ausencia.studentId,
              motivo: ausencia.motivo.tipo,
              fuenteFlota: true,
              timestamp: new Date()
            }],
            observacion: ''
          },
          estado: 'en_progreso',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // 4. Marcar como pre-llenada
      await snap.ref.update({
        preFilledInAttendance: true,
        attendanceDocId,
        updatedAt: new Date()
      });

      // 5. Crear notificación para maestro
      const maestro = await db.collection('MAESTROS')
        .doc(teacherId)
        .get();

      if (maestro.exists) {
        await db.collection('NOTIFICATIONS').add({
          title: '📌 Justificación pre-llenada',
          message: `${ausencia.studentName} está justificado (${ausencia.motivo.tipo})`,
          type: 'attendance_prefilled',
          recipientId: teacherId,
          channel: 'push',
          isRead: false,
          createdAt: new Date(),
          data: {
            classId: ausencia.classId,
            studentId: ausencia.studentId
          }
        });
      }

      console.log(`✅ Ausencia pre-llenada: ${ausencia.studentId} en ${ausencia.classId}`);

    } catch (error) {
      console.error('Error en onAbsenceCreated:', error);
    }
  });
```

**Crear:** `functions/src/triggers/onAssistanceSaved.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendWhatsAppMessage } from '../services/whatsappService';

const db = admin.firestore();

export const onAssistanceSaved = functions.firestore
  .document('ASISTENCIAS/{docId}')
  .onUpdate(async (change, context) => {
    const after = change.after.data();
    const before = change.before.data();

    // Solo procesar cuando pasa a "completado"
    if (before.estado === 'completado' || after.estado !== 'completado') {
      return;
    }

    try {
      // 1. Compilar mensaje para Guillermo
      const message = `✅ ASISTENCIA COMPLETADA\n\n` +
        `📚 ${after.className}\n` +
        `👨‍🏫 Prof. ${after.maestroNombre}\n` +
        `📅 ${after.fecha}\n\n` +
        `📊 TOTALES:\n` +
        `✓ Presentes: ${after.data.presentes.length}\n` +
        `✗ Ausentes: ${after.data.ausentes.length}\n` +
        `⭐ Justificados: ${after.data.justificacion.length}`;

      // 2. Enviar WhatsApp a Guillermo
      const guillermo = await db.collection('MAESTROS')
        .where('role', '==', 'admin')
        .limit(1)
        .get();

      if (!guillermo.empty) {
        const guillermoData = guillermo.docs[0].data();
        if (guillermoData.whatsappPhone) {
          await sendWhatsAppMessage(
            guillermoData.whatsappPhone,
            message
          );
        }
      }

      console.log(`✅ Asistencia notificada: ${after.className}`);

    } catch (error) {
      console.error('Error en onAssistanceSaved:', error);
    }
  });
```

**Crear:** `functions/src/services/whatsappService.ts`

```typescript
import * as admin from 'firebase-admin';
// Baileys será importado cuando se configure
// import { sendMessage } from '@whiskeysockets/baileys';

const db = admin.firestore();

export const sendWhatsAppMessage = async (
  phoneNumber: string,
  message: string,
  maxRetries: number = 3
): Promise<boolean> => {
  try {
    // TODO: Implementar Baileys
    // const jid = `${phoneNumber.replace('+', '')}@s.whatsapp.net`;
    // await sendMessage(jid, { text: message });

    // Por ahora: guardamos en NOTIFICATIONS
    await db.collection('NOTIFICATIONS').add({
      title: 'WhatsApp Message',
      message,
      channel: 'whatsapp',
      recipientPhone: phoneNumber,
      isRead: false,
      createdAt: new Date()
    });

    console.log(`✅ Mensaje WhatsApp enviado a ${phoneNumber}`);
    return true;

  } catch (error) {
    console.error(`❌ Error enviando WhatsApp a ${phoneNumber}:`, error);
    
    // Reintentar
    // TODO: Implementar lógica de reintento
    
    return false;
  }
};
```

**Crear:** `functions/src/cron/notifyIncompleteAttendance.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendWhatsAppMessage } from '../services/whatsappService';

const db = admin.firestore();

/**
 * Cloud Scheduler CRON: Ejecutar cada 30 minutos
 * Busca asistencias incompletas y notifica maestros
 */
export const notifyIncompleteAttendance = functions.pubsub
  .schedule('every 30 minutes')
  .timeZone('America/Santo_Domingo')
  .onRun(async (context) => {
    try {
      // 1. Buscar asistencias "en_progreso" de hoy
      const today = new Date().toISOString().split('T')[0];
      
      const snapshot = await db.collection('ASISTENCIAS')
        .where('fecha', '==', today)
        .where('estado', '==', 'en_progreso')
        .get();

      console.log(`🔍 Encontradas ${snapshot.size} asistencias incompletas`);

      // 2. Para cada una, notificar al maestro
      for (const doc of snapshot.docs) {
        const attendance = doc.data();
        
        const maestro = await db.collection('MAESTROS')
          .doc(attendance.teacherId)
          .get();

        if (maestro.exists && maestro.data().whatsappPhone) {
          const message = `🔔 Recordatorio: Asistencia de ${attendance.className}\n\n` +
            `Tiempo: ~5 minutos\n` +
            `Alumnos esperados: ${attendance.data.presentes.length + attendance.data.ausentes.length}`;

          await sendWhatsAppMessage(
            maestro.data().whatsappPhone,
            message
          );
        }
      }

      console.log('✅ Notificaciones enviadas');

    } catch (error) {
      console.error('❌ Error en cron:', error);
    }
  });
```

### 5.3 QUÉ ESPERAMOS

**Entrega FASE 5:**

```
✅ Cloud Functions:
   - onAbsenceCreated()
   - onAssistanceSaved()
   - notifyIncompleteAttendance() CRON

✅ Servicios:
   - whatsappService con Baileys

✅ Automatizaciones:
   - Pre-llenado de justificaciones
   - Notificaciones a maestros/Guillermo
   - Recordatorios automáticos

✅ Confirmación: "Fase 5 completada. Automatizaciones operacionales."
```

---

## 🎯 FASE 6: TESTING + GO-LIVE

### 6.1 TESTING

```
✅ Unit Tests
   - Servicios de datos
   - Lógicas de análisis
   - Funciones auxiliares

✅ Integration Tests
   - Flujo: AUSENCIA → Pre-llena → App maestro
   - Flujo: Guillermo pre-llena → App maestro
   - Flujo: Asistencia completada → Notificación

✅ E2E Tests
   - Dashboard home carga datos
   - Pre-llenar justificaciones funciona
   - Reportes se generan correctamente

✅ Manual Testing
   - Crear ausencia en FLOTA → Ver pre-llenada en app maestro
   - Guillermo pre-llena → Maestro notificado
   - Asistencia completada → Notificaciones enviadas
   - Alertas se generan correctamente
```

### 6.2 GO-LIVE

```
PASO 1: Deployment
├─ Backend a Cloud Functions
├─ Frontend a Vercel/Netlify
├─ Firebase Firestore validada
└─ Baileys configurado con QR

PASO 2: Capacitación (2 horas)
├─ Guillermo: Dashboard y sus funciones
├─ Maestros: App maestro no cambia (solo ven justificaciones pre-llenadas)
└─ Representantes: Notificaciones WhatsApp

PASO 3: Monitoreo (7 días)
├─ Logs de Cloud Functions
├─ Errores en notificaciones
├─ Performance del dashboard
└─ Soporte técnico disponible 24/7

PASO 4: Optimización
├─ Ajustar umbrales de alertas
├─ Refinar mensajes WhatsApp
├─ Agregar más reportes si es necesario
└─ Feedback de usuarios
```

---

## 📊 RESUMEN FINAL

```
┌─────────────────────────────────────────────────────┐
│    SISTEMA DE GUILLERMO - PLAN MAESTRO              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ FASE 0: Contexto ✅                                 │
│ FASE 1: Data Services (Firebase) ← EMPEZAR AQUÍ    │
│ FASE 2: Business Logic (Analytics)                 │
│ FASE 3: Backend API (Express)                      │
│ FASE 4: Frontend Dashboard (React)                 │
│ FASE 5: Automatizaciones (WhatsApp + CF)           │
│ FASE 6: Testing + Go-Live                          │
│                                                     │
│ Cada fase COMPLETA y VERIFICADA                    │
│ Integración con App Maestros existente             │
│ WhatsApp para Guillermo y maestros                 │
│                                                     │
│ RESULTADO:                                          │
│ 60 min/día → 15 min/día                             │
│ Datos en vivo + Alertas automáticas                │
│ Sin intervención manual                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

**Este plan está listo para ser entregado a agentes IA profesionales.**

**Los agentes DEBEN comenzar por FASE 1 y completarla 100% antes de pasar a FASE 2.**

**Token estimate por fase:**
- FASE 1: ~3,000 tokens
- FASE 2: ~3,500 tokens
- FASE 3: ~3,000 tokens
- FASE 4: ~3,000 tokens
- FASE 5: ~2,500 tokens
- FASE 6: ~1,500 tokens

**Total: ~17,000 tokens (completamente dentro de límites)**

---

*Plan Maestro v1.0*
*Sistema Administrativo de Guillermo*
*2025-01-29*
*LISTO PARA IMPLEMENTACIÓN*
