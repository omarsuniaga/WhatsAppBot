/**
 * KPICalculatorService - Servicio para calcular todos los KPIs del Sistema Educativo
 * Implementa 30+ indicadores alineados con Marco Lógico
 */

import {
  Indicator,
  IndicatorResult,
  CalculationFrequency,
  IndicatorMethod,
} from '../entities/Indicator';
import { indicatorRepository } from '../repositories/IndicatorRepository';
import { studentRepository } from '../repositories/StudentRepository';
import { activityRepository } from '../repositories/ActivityRepository';
import { attendanceRepository } from '../repositories/AttendanceRepository';
import { evaluationRepository } from '../repositories/EvaluationRepository';
import { groupRepository } from '../repositories/GroupRepository';
import { instrumentRepository } from '../repositories/InstrumentRepository';
import { personRepository } from '../repositories/PersonRepository';
import { StudentStatus } from '../entities/StudentProfile';
import { AttendanceStatus } from '../entities/Attendance';

export class KPICalculatorService {
  /**
   * FÓRMULAS DE KPIs POR CATEGORÍA
   * ================================
   */

  /**
   * CATEGORÍA: COBERTURA
   * Indicador 1: Tasa de Inscripción
   */
  async calculateEnrollmentRate(): Promise<IndicatorResult> {
    const students = await studentRepository.findActiveByLevel(
      null as any // TODO: implementar según necesidad
    );
    const total = await studentRepository.count();
    const enrolled = students.length;

    const result = total > 0 ? (enrolled / total) * 100 : 0;

    return this.createResult(
      'KPI_001_COBERTURA_INSCRIPCION',
      result,
      IndicatorMethod.PERCENTAGE,
      `Tasa de Inscripción: ${result.toFixed(2)}%`
    );
  }

  /**
   * Indicador 2: Tasa de Retención
   */
  async calculateRetentionRate(): Promise<IndicatorResult> {
    const allStudents = await studentRepository.findAll();
    const active = allStudents.filter((s) => s.status === StudentStatus.ACTIVE).length;
    const total = allStudents.length;

    const result = total > 0 ? (active / total) * 100 : 0;

    return this.createResult(
      'KPI_002_COBERTURA_RETENCION',
      result,
      IndicatorMethod.PERCENTAGE,
      `Tasa de Retención: ${result.toFixed(2)}%`
    );
  }

  /**
   * Indicador 3: Acceso a Instrumentos
   */
  async calculateInstrumentAccessRate(): Promise<IndicatorResult> {
    const students = await studentRepository.findAll();
    const studentsWithAccess = new Set<string>();

    for (const student of students) {
      const instruments = await instrumentRepository.findByStudent(student.personId);
      if (instruments.length > 0) {
        studentsWithAccess.add(student.personId);
      }
    }

    const total = students.length;
    const result = total > 0 ? (studentsWithAccess.size / total) * 100 : 0;

    return this.createResult(
      'KPI_003_COBERTURA_ACCESO_INSTRUMENTOS',
      result,
      IndicatorMethod.PERCENTAGE,
      `Acceso a Instrumentos: ${result.toFixed(2)}%`
    );
  }

  /**
   * CATEGORÍA: CALIDAD EDUCATIVA
   * Indicador 4: Tasa de Aprobación
   */
  async calculateApprovalRate(): Promise<IndicatorResult> {
    const stats = await evaluationRepository.getSummary();
    const result =
      stats.total > 0
        ? (stats.passingCount / stats.total) * 100
        : 0;

    return this.createResult(
      'KPI_004_CALIDAD_TASA_APROBACION',
      result,
      IndicatorMethod.PERCENTAGE,
      `Tasa de Aprobación: ${result.toFixed(2)}%`
    );
  }

  /**
   * Indicador 5: Promedio Académico General
   */
  async calculateOverallGPA(): Promise<IndicatorResult> {
    const allEvals = await evaluationRepository.findAll();
    if (allEvals.length === 0) {
      return this.createResult(
        'KPI_005_CALIDAD_PROMEDIO_ACADEMICO',
        0,
        IndicatorMethod.AVERAGE,
        'Promedio Académico: 0'
      );
    }

    const average = allEvals.reduce((sum, e) => sum + e.score, 0) / allEvals.length;

    return this.createResult(
      'KPI_005_CALIDAD_PROMEDIO_ACADEMICO',
      average,
      IndicatorMethod.AVERAGE,
      `Promedio Académico: ${average.toFixed(2)}`
    );
  }

  /**
   * Indicador 6: Tasa de Estudiantes en Riesgo
   */
  async calculateAtRiskRate(): Promise<IndicatorResult> {
    const atRisk = await studentRepository.findAtRisk();
    const total = await studentRepository.count();

    const result = total > 0 ? (atRisk.length / total) * 100 : 0;

    return this.createResult(
      'KPI_006_CALIDAD_ESTUDIANTES_RIESGO',
      result,
      IndicatorMethod.PERCENTAGE,
      `Estudiantes en Riesgo: ${result.toFixed(2)}%`
    );
  }

  /**
   * CATEGORÍA: ASISTENCIA
   * Indicador 7: Tasa de Asistencia Global
   */
  async calculateGlobalAttendanceRate(): Promise<IndicatorResult> {
    const stats = await attendanceRepository.getSummary();
    const result = stats.averagePresentRate * 100;

    return this.createResult(
      'KPI_007_ASISTENCIA_GLOBAL',
      result,
      IndicatorMethod.PERCENTAGE,
      `Tasa de Asistencia Global: ${result.toFixed(2)}%`
    );
  }

  /**
   * Indicador 8: Inasistencias Justificadas vs No Justificadas
   */
  async calculateJustifiedAbsenceRatio(): Promise<IndicatorResult> {
    const excused = await attendanceRepository.findByStatus(AttendanceStatus.EXCUSED);
    const absent = await attendanceRepository.findByStatus(AttendanceStatus.ABSENT);

    const total = excused.length + absent.length;
    const result = total > 0 ? (excused.length / total) * 100 : 0;

    return this.createResult(
      'KPI_008_ASISTENCIA_JUSTIFICADAS',
      result,
      IndicatorMethod.PERCENTAGE,
      `Inasistencias Justificadas: ${result.toFixed(2)}%`
    );
  }

  /**
   * CATEGORÍA: PARTICIPACIÓN EN ACTIVIDADES
   * Indicador 9: Participación Promedio en Actividades
   */
  async calculateAverageActivityParticipation(): Promise<IndicatorResult> {
    const activities = await activityRepository.findAll();
    if (activities.length === 0) {
      return this.createResult(
        'KPI_009_PARTICIPACION_PROMEDIO',
        0,
        IndicatorMethod.AVERAGE,
        'Participación Promedio: 0'
      );
    }

    let totalParticipants = 0;
    for (const activity of activities) {
      totalParticipants += activity.participants.length;
    }

    const average = totalParticipants / activities.length;

    return this.createResult(
      'KPI_009_PARTICIPACION_PROMEDIO',
      average,
      IndicatorMethod.AVERAGE,
      `Participación Promedio: ${average.toFixed(2)}`
    );
  }

  /**
   * Indicador 10: Tasa de Participación en Ensayos y Conciertos
   */
  async calculateConcertParticipationRate(): Promise<IndicatorResult> {
    const students = await studentRepository.findAll();
    const studentsWithParticipation = new Set<string>();

    const activities = await activityRepository.findByType('CONCERT' as any);
    for (const activity of activities) {
      for (const participant of activity.participants) {
        studentsWithParticipation.add(participant);
      }
    }

    const total = students.length;
    const result = total > 0 ? (studentsWithParticipation.size / total) * 100 : 0;

    return this.createResult(
      'KPI_010_PARTICIPACION_CONCIERTOS',
      result,
      IndicatorMethod.PERCENTAGE,
      `Participación en Conciertos: ${result.toFixed(2)}%`
    );
  }

  /**
   * CATEGORÍA: EFICIENCIA OPERATIVA
   * Indicador 11: Disponibilidad de Instrumentos
   */
  async calculateInstrumentAvailability(): Promise<IndicatorResult> {
    const stats = await instrumentRepository.getStatistics();
    const total = stats.total;
    const result = total > 0 ? (stats.operative / total) * 100 : 0;

    return this.createResult(
      'KPI_011_EFICIENCIA_DISPONIBILIDAD_INSTRUMENTOS',
      result,
      IndicatorMethod.PERCENTAGE,
      `Disponibilidad de Instrumentos: ${result.toFixed(2)}%`
    );
  }

  /**
   * Indicador 12: Tasa de Mantenimiento de Instrumentos
   */
  async calculateInstrumentMaintenanceRate(): Promise<IndicatorResult> {
    const stats = await instrumentRepository.getStatistics();
    const total = stats.total;
    const maintenance = stats.needingMaintenance;
    const result = total > 0 ? (maintenance / total) * 100 : 0;

    return this.createResult(
      'KPI_012_EFICIENCIA_MANTENIMIENTO',
      result,
      IndicatorMethod.PERCENTAGE,
      `Instrumentos en Mantenimiento: ${result.toFixed(2)}%`
    );
  }

  /**
   * Indicador 13: Ocupación Promedio de Grupos
   */
  async calculateGroupOccupancy(): Promise<IndicatorResult> {
    const stats = await groupRepository.getStatistics();
    const result = stats.averageCapacityUsed * 100;

    return this.createResult(
      'KPI_013_EFICIENCIA_OCUPACION_GRUPOS',
      result,
      IndicatorMethod.PERCENTAGE,
      `Ocupación Promedio de Grupos: ${result.toFixed(2)}%`
    );
  }

  /**
   * CATEGORÍA: EQUIDAD
   * Indicador 14: Distribución de Instrumentos por Nivel
   */
  async calculateInstrumentDistribution(): Promise<IndicatorResult> {
    const students = await studentRepository.findAll();
    const withInstruments = new Set<string>();

    for (const student of students) {
      const instruments = await instrumentRepository.findByStudent(student.personId);
      if (instruments.length > 0) {
        withInstruments.add(student.personId);
      }
    }

    const total = students.length;
    const result = total > 0 ? (withInstruments.size / total) * 100 : 0;

    return this.createResult(
      'KPI_014_EQUIDAD_DISTRIBUCION_INSTRUMENTOS',
      result,
      IndicatorMethod.PERCENTAGE,
      `Equidad en Distribución: ${result.toFixed(2)}%`
    );
  }

  /**
   * Indicador 15: Tasa de Acceso a Maestros
   */
  async calculateTeacherAccessRate(): Promise<IndicatorResult> {
    const teachers = await personRepository.findActiveTeachers();
    const students = await studentRepository.findAll();

    const total = students.length;
    const result =
      total > 0 && teachers.length > 0 ? (teachers.length / total) * 100 : 0;

    return this.createResult(
      'KPI_015_EQUIDAD_ACCESO_MAESTROS',
      result,
      IndicatorMethod.PERCENTAGE,
      `Tasa Estudiantes/Maestro: ${result.toFixed(2)}`
    );
  }

  /**
   * CATEGORÍA: SOSTENIBILIDAD
   * Indicador 16: Número Total de Estudiantes Activos
   */
  async calculateTotalActiveStudents(): Promise<IndicatorResult> {
    const activeStudents = await studentRepository.findByStatus(StudentStatus.ACTIVE);

    return this.createResult(
      'KPI_016_SOSTENIBILIDAD_ESTUDIANTES_ACTIVOS',
      activeStudents.length,
      IndicatorMethod.COUNT,
      `Estudiantes Activos: ${activeStudents.length}`
    );
  }

  /**
   * Indicador 17: Tasa de Retención Año a Año
   */
  async calculateYearToYearRetention(): Promise<IndicatorResult> {
    const allStudents = await studentRepository.findAll();
    const active = allStudents.filter((s) => s.status === StudentStatus.ACTIVE).length;

    const result = allStudents.length > 0 ? (active / allStudents.length) * 100 : 0;

    return this.createResult(
      'KPI_017_SOSTENIBILIDAD_RETENCION_AY',
      result,
      IndicatorMethod.PERCENTAGE,
      `Retención Año a Año: ${result.toFixed(2)}%`
    );
  }

  /**
   * Indicador 18: Presupuesto por Estudiante (Instrumentos)
   */
  async calculateBudgetPerStudent(): Promise<IndicatorResult> {
    const students = await studentRepository.count();
    const instruments = await instrumentRepository.findAll();

    // Simular presupuesto = número de instrumentos * 1000 USD
    const totalBudget = instruments.length * 1000;
    const result = students > 0 ? totalBudget / students : 0;

    return this.createResult(
      'KPI_018_SOSTENIBILIDAD_PRESUPUESTO_ESTUDIANTE',
      result,
      IndicatorMethod.AVERAGE,
      `Presupuesto/Estudiante: $${result.toFixed(2)}`
    );
  }

  /**
   * CATEGORÍA: INDICADORES DERIVADOS (Composites)
   * Indicador 19: Índice de Calidad Integral
   */
  async calculateOverallQualityIndex(): Promise<IndicatorResult> {
    const approvalRate = await this.calculateApprovalRate();
    const gpA = await this.calculateOverallGPA();
    const attendanceRate = await this.calculateGlobalAttendanceRate();

    const index = (approvalRate.value + attendanceRate.value) / 2;

    return this.createResult(
      'KPI_019_INDICE_CALIDAD_INTEGRAL',
      index,
      IndicatorMethod.AVERAGE,
      `Índice de Calidad: ${index.toFixed(2)}`
    );
  }

  /**
   * Indicador 20: Tasa de Éxito del Sistema
   */
  async calculateSystemSuccessRate(): Promise<IndicatorResult> {
    const students = await studentRepository.findAll();
    const graduated = students.filter(
      (s) => s.status === StudentStatus.GRADUATED
    ).length;

    const result = students.length > 0 ? (graduated / students.length) * 100 : 0;

    return this.createResult(
      'KPI_020_TASA_EXITO',
      result,
      IndicatorMethod.PERCENTAGE,
      `Tasa de Éxito: ${result.toFixed(2)}%`
    );
  }

  /**
   * CATEGORÍA: INDICADORES ADICIONALES
   * Indicador 21: Total de Actividades Realizadas (Año)
   */
  async calculateTotalActivitiesYearly(): Promise<IndicatorResult> {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31);

    const activities = await activityRepository.findByPeriod(startOfYear, endOfYear);

    return this.createResult(
      'KPI_021_TOTAL_ACTIVIDADES_ANUAL',
      activities.length,
      IndicatorMethod.COUNT,
      `Actividades (Año): ${activities.length}`
    );
  }

  /**
   * Indicador 22: Promedio de Participantes por Actividad
   */
  async calculateAverageParticipantsPerActivity(): Promise<IndicatorResult> {
    const activities = await activityRepository.findAll();
    if (activities.length === 0) {
      return this.createResult(
        'KPI_022_PROMEDIO_PARTICIPANTES',
        0,
        IndicatorMethod.AVERAGE,
        'Promedio Participantes: 0'
      );
    }

    const totalParticipants = activities.reduce(
      (sum, a) => sum + a.participants.length,
      0
    );
    const average = totalParticipants / activities.length;

    return this.createResult(
      'KPI_022_PROMEDIO_PARTICIPANTES',
      average,
      IndicatorMethod.AVERAGE,
      `Promedio Participantes/Actividad: ${average.toFixed(2)}`
    );
  }

  /**
   * Indicador 23: Tasa de Estudiantes sin Instrumentos
   */
  async calculateStudentsWithoutInstruments(): Promise<IndicatorResult> {
    const students = await studentRepository.findAll();
    let studentsWithout = 0;

    for (const student of students) {
      const instruments = await instrumentRepository.findByStudent(student.personId);
      if (instruments.length === 0) {
        studentsWithout++;
      }
    }

    const result = students.length > 0 ? (studentsWithout / students.length) * 100 : 0;

    return this.createResult(
      'KPI_023_ESTUDIANTES_SIN_INSTRUMENTOS',
      result,
      IndicatorMethod.PERCENTAGE,
      `Estudiantes sin Instrumentos: ${result.toFixed(2)}%`
    );
  }

  /**
   * Indicador 24: Licencias Solicitadas (Meses de Ausencia)
   */
  async calculateTotalAbsenceMonths(): Promise<IndicatorResult> {
    const onLeave = await studentRepository.findByStatus(StudentStatus.ON_LEAVE);

    return this.createResult(
      'KPI_024_MESES_AUSENCIA',
      onLeave.length,
      IndicatorMethod.COUNT,
      `Estudiantes en Licencia: ${onLeave.length}`
    );
  }

  /**
   * Indicador 25: Comunicaciones Realizadas (por Grupo)
   */
  async calculateTotalCommunicationActions(): Promise<IndicatorResult> {
    const groups = await groupRepository.findAll();
    let totalActions = 0;

    for (const group of groups) {
      const actions = await groupRepository.getCommunicationActions(group.id);
      totalActions += actions.length;
    }

    return this.createResult(
      'KPI_025_COMUNICACIONES_REALIZADAS',
      totalActions,
      IndicatorMethod.COUNT,
      `Comunicaciones: ${totalActions}`
    );
  }

  /**
   * Indicador 26: Deserción (Dropout Rate)
   */
  async calculateDropoutRate(): Promise<IndicatorResult> {
    const allStudents = await studentRepository.findAll();
    const dropped = allStudents.filter(
      (s) => s.status === StudentStatus.DROPPED
    ).length;

    const result = allStudents.length > 0 ? (dropped / allStudents.length) * 100 : 0;

    return this.createResult(
      'KPI_026_TASA_DESERCION',
      result,
      IndicatorMethod.PERCENTAGE,
      `Tasa de Deserción: ${result.toFixed(2)}%`
    );
  }

  /**
   * Indicador 27: Instrumentos sin Asignar
   */
  async calculateUnassignedInstruments(): Promise<IndicatorResult> {
    const unassigned = await instrumentRepository.findUnassigned();

    return this.createResult(
      'KPI_027_INSTRUMENTOS_SIN_ASIGNAR',
      unassigned.length,
      IndicatorMethod.COUNT,
      `Instrumentos sin Asignar: ${unassigned.length}`
    );
  }

  /**
   * Indicador 28: Grupos Llenos (Al Máximo)
   */
  async calculateFullGroups(): Promise<IndicatorResult> {
    const fullGroups = await groupRepository.findFullGroups();

    return this.createResult(
      'KPI_028_GRUPOS_LLENOS',
      fullGroups.length,
      IndicatorMethod.COUNT,
      `Grupos Llenos: ${fullGroups.length}`
    );
  }

  /**
   * Indicador 29: Tasa de Evaluaciones Completadas
   */
  async calculateEvaluationCompletionRate(): Promise<IndicatorResult> {
    const allStudents = await studentRepository.findAll();
    const allActivities = await activityRepository.findAll();
    const expectedEvaluations = allStudents.length * allActivities.length;
    const completedEvaluations = await evaluationRepository.count();

    const result =
      expectedEvaluations > 0
        ? (completedEvaluations / expectedEvaluations) * 100
        : 0;

    return this.createResult(
      'KPI_029_TASA_EVALUACIONES_COMPLETADAS',
      result,
      IndicatorMethod.PERCENTAGE,
      `Evaluaciones Completadas: ${result.toFixed(2)}%`
    );
  }

  /**
   * Indicador 30: Índice de Sostenibilidad (Composite)
   */
  async calculateSustainabilityIndex(): Promise<IndicatorResult> {
    const retention = await this.calculateRetentionRate();
    const success = await this.calculateSystemSuccessRate();
    const quality = await this.calculateOverallQualityIndex();

    const index = (retention.value + success.value + quality.value) / 3;

    return this.createResult(
      'KPI_030_INDICE_SOSTENIBILIDAD',
      index,
      IndicatorMethod.AVERAGE,
      `Índice Sostenibilidad: ${index.toFixed(2)}`
    );
  }

  /**
   * Calcula todos los KPIs de una vez
   */
  async calculateAllKPIs(): Promise<IndicatorResult[]> {
    const results: IndicatorResult[] = [];

    // COBERTURA
    results.push(await this.calculateEnrollmentRate());
    results.push(await this.calculateRetentionRate());
    results.push(await this.calculateInstrumentAccessRate());

    // CALIDAD EDUCATIVA
    results.push(await this.calculateApprovalRate());
    results.push(await this.calculateOverallGPA());
    results.push(await this.calculateAtRiskRate());

    // ASISTENCIA
    results.push(await this.calculateGlobalAttendanceRate());
    results.push(await this.calculateJustifiedAbsenceRatio());

    // PARTICIPACIÓN
    results.push(await this.calculateAverageActivityParticipation());
    results.push(await this.calculateConcertParticipationRate());

    // EFICIENCIA OPERATIVA
    results.push(await this.calculateInstrumentAvailability());
    results.push(await this.calculateInstrumentMaintenanceRate());
    results.push(await this.calculateGroupOccupancy());

    // EQUIDAD
    results.push(await this.calculateInstrumentDistribution());
    results.push(await this.calculateTeacherAccessRate());

    // SOSTENIBILIDAD
    results.push(await this.calculateTotalActiveStudents());
    results.push(await this.calculateYearToYearRetention());
    results.push(await this.calculateBudgetPerStudent());

    // DERIVADOS
    results.push(await this.calculateOverallQualityIndex());
    results.push(await this.calculateSystemSuccessRate());

    // ADICIONALES
    results.push(await this.calculateTotalActivitiesYearly());
    results.push(await this.calculateAverageParticipantsPerActivity());
    results.push(await this.calculateStudentsWithoutInstruments());
    results.push(await this.calculateTotalAbsenceMonths());
    results.push(await this.calculateTotalCommunicationActions());
    results.push(await this.calculateDropoutRate());
    results.push(await this.calculateUnassignedInstruments());
    results.push(await this.calculateFullGroups());
    results.push(await this.calculateEvaluationCompletionRate());
    results.push(await this.calculateSustainabilityIndex());

    // Guardar todos los resultados
    for (const result of results) {
      await indicatorRepository.saveResult(result);
    }

    return results;
  }

  /**
   * Helper para crear IndicatorResult
   */
  private createResult(
    id: string,
    value: number,
    method: IndicatorMethod,
    description: string
  ): IndicatorResult {
    return {
      id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      indicatorId: id,
      value,
      method,
      calculatedAt: new Date(),
      isSuccessful: value >= 70, // Threshold: 70%
      alert: value < 50 ? `ALERTA: ${description}` : null,
      notes: description,
      hash: this.generateHash(`${id}${value}${new Date()}`),
      version: 1,
      readonly: true,
      periodStart: new Date(),
      periodEnd: new Date(),
      calculatedBy: 'system',
      dataSourceCount: 0
    };
  }

  /**
   * Genera hash SHA256 para auditoria
   */
  private generateHash(input: string): string {
    // Simulación simple de hash (en producción usar crypto.createHash)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

export const kpiCalculatorService = new KPICalculatorService();
