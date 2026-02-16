/**
 * StudentRepository - Repositorio para gestionar Estudiantes
 */

import { BaseRepository } from './BaseRepository';
import { StudentProfile, StudentStatus, StudentLevel } from '../entities/StudentProfile';

export class StudentRepository extends BaseRepository<StudentProfile> {
  /**
   * Encuentra estudiantes por estado
   */
  async findByStatus(status: StudentStatus): Promise<StudentProfile[]> {
    return this.findByCondition((student) => student.status === status);
  }

  /**
   * Encuentra estudiantes por nivel
   */
  async findByLevel(level: StudentLevel): Promise<StudentProfile[]> {
    return this.findByCondition((student) => student.level === level);
  }

  /**
   * Encuentra estudiantes en riesgo
   */
  async findAtRisk(): Promise<StudentProfile[]> {
    return this.findByCondition((student) => {
      const riskScore =
        (student.attendanceRate < 70 ? 40 : 0) +
        (student.approvalRate < 60 ? 40 : 0) +
        (student.status !== StudentStatus.ACTIVE ? 20 : 0);
      return riskScore >= 50;
    });
  }

  /**
   * Encuentra estudiantes con mala asistencia
   */
  async findWithPoorAttendance(threshold: number = 0.8): Promise<StudentProfile[]> {
    return this.findByCondition((student) => student.attendanceRate < threshold);
  }

  /**
   * Encuentra estudiantes con mal desempeño académico
   */
  async findWithPoorAcademicPerformance(threshold: number = 0.7): Promise<StudentProfile[]> {
    return this.findByCondition((student) => student.approvalRate < threshold);
  }

  /**
   * Encuentra estudiantes activos en nivel específico
   */
  async findActiveByLevel(level: StudentLevel): Promise<StudentProfile[]> {
    return this.findByCondition(
      (student) => student.level === level && student.status === StudentStatus.ACTIVE
    );
  }

  /**
   * Cuenta estudiantes por estado
   */
  async countByStatus(): Promise<Record<StudentStatus, number>> {
    const all = await this.findAll();
    return {
      [StudentStatus.ACTIVE]: all.filter((s) => s.status === StudentStatus.ACTIVE).length,
      [StudentStatus.GRADUATED]: all.filter((s) => s.status === StudentStatus.GRADUATED).length,
      [StudentStatus.DROPPED]: all.filter((s) => s.status === StudentStatus.DROPPED).length,
      [StudentStatus.ON_LEAVE]: all.filter((s) => s.status === StudentStatus.ON_LEAVE).length,
    };
  }

  /**
   * Obtiene estadísticas generales de estudiantes
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    atRisk: number;
    averageAttendanceRate: number;
    averageApprovalRate: number;
  }> {
    const all = await this.findAll();
    const atRisk = await this.findAtRisk();

    if (all.length === 0) {
      return {
        total: 0,
        active: 0,
        atRisk: 0,
        averageAttendanceRate: 0,
        averageApprovalRate: 0,
      };
    }

    const summaryAttendance = all.reduce((sum, s) => sum + s.attendanceRate, 0);
    const summaryApproval = all.reduce((sum, s) => sum + s.approvalRate, 0);

    return {
      total: all.length,
      active: all.filter((s) => s.status === StudentStatus.ACTIVE).length,
      atRisk: atRisk.length,
      averageAttendanceRate: summaryAttendance / all.length,
      averageApprovalRate: summaryApproval / all.length,
    };
  }

  /**
   * Busca estudiantes por criterios múltiples
   */
  async search(query: {
    personId?: string;
    status?: StudentStatus;
    level?: StudentLevel;
    atRisk?: boolean;
  }): Promise<StudentProfile[]> {
    const atRisk = query.atRisk ? await this.findAtRisk() : [];
    const atRiskIds = new Set(atRisk.map((s) => s.id));

    return this.findByCondition((student) => {
      if (query.personId && student.personId !== query.personId) return false;
      if (query.status && student.status !== query.status) return false;
      if (query.level && student.level !== query.level) return false;
      if (query.atRisk !== undefined && !atRiskIds.has(student.id)) return false;
      return true;
    });
  }
}

export const studentRepository = new StudentRepository();
