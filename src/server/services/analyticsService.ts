
// ============================================
// ANALYTICS SERVICE
// Lógicas de análisis y procesamiento
// ============================================

import {
  attendanceService,
  absenceService,
  classService
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
    const porcentaje = totalExpected > 0 ? (presentes / totalExpected) * 100 : 0;

    return {
      className: classData.nombre,
      totalExpected,
      presentes,
      ausentes,
      justificados,
      porcentajeAsistencia: Math.round(porcentaje * 100) / 100,
      estado: attendance.estado as 'en_progreso' | 'completado' | 'pendiente', // mapped 'completada' -> 'completado' to match interface if needed, or keeping explicit string
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

        if (analysis.estado === 'completado') {
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
             type: 'reported_but_present',
             studentId: absence.studentId,
             studentName: absence.studentName,
             absenceId: absence.id
         });
      }
    });

    return discrepancies;
  },

  /**
   * Pre-llena justificaciones si existe un reporte de ausencia validado
   * Retorna las justificaciones generadas para ser guardadas
   */
  async preFillJustifications(classId: string, fecha: string) {
      const absences = await absenceService.getAbsencesToday(fecha);
      // Filter confirmed absences for this class
      const confirmedAbsences = absences.filter(a => a.classId === classId && a.estado === 'confirmada');
      
      return confirmedAbsences.map(absence => ({
          studentId: absence.studentId,
          motivo: `Pre-llenado: ${absence.motivo.tipo} - ${absence.motivo.descripcion || ''}`,
          fuenteFlota: true,
          timestamp: new Date()
      }));
  }
};
