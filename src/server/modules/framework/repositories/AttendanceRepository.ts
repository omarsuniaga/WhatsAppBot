/**
 * AttendanceRepository - Repositorio para gestionar Asistencias
 */

import { BaseRepository } from './BaseRepository';
import { Attendance, AttendanceStatus } from '../entities/Attendance';

export class AttendanceRepository extends BaseRepository<Attendance> {
  /**
   * Encuentra asistencias por estado
   */
  async findByStatus(status: AttendanceStatus): Promise<Attendance[]> {
    return this.findByCondition((attendance) => attendance.status === status);
  }

  /**
   * Encuentra asistencias de un estudiante
   */
  async findByStudent(studentId: string): Promise<Attendance[]> {
    return this.findByCondition((attendance) => attendance.studentId === studentId);
  }

  /**
   * Encuentra asistencias de una actividad
   */
  async findByActivity(activityId: string): Promise<Attendance[]> {
    return this.findByCondition((attendance) => attendance.activityId === activityId);
  }

  /**
   * Encuentra presencias de un estudiante
   */
  async findPresencesByStudent(studentId: string): Promise<Attendance[]> {
    return this.findByCondition(
      (attendance) =>
        attendance.studentId === studentId &&
        attendance.status === AttendanceStatus.PRESENT
    );
  }

  /**
   * Encontrar Asistencias de una actividad entre fechas
   */
  async findByActivityAndDateRange(
    activityId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Attendance[]> {
    return this.findByCondition(
      (attendance) =>
        attendance.activityId === activityId &&
        attendance.recordedAt >= startDate &&
        attendance.recordedAt <= endDate
    );
  }

  /**
   * Calcula la tasa de asistencia de un estudiante
   */
  async calculateAttendanceRate(studentId: string): Promise<number> {
    const attendances = await this.findByStudent(studentId);
    if (attendances.length === 0) return 0;

    const presences = attendances.filter(
      (a) => a.status === AttendanceStatus.PRESENT
    ).length;

    return presences / attendances.length;
  }

  /**
   * Calcula estadísticas de asistencia de una actividad
   */
  async getActivityAttendanceStats(activityId: string): Promise<{
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    presentRate: number;
  }> {
    const attendances = await this.findByActivity(activityId);

    if (attendances.length === 0) {
      return {
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        presentRate: 0,
      };
    }

    const present = attendances.filter(
      (a) => a.status === AttendanceStatus.PRESENT
    ).length;
    const absent = attendances.filter(
      (a) => a.status === AttendanceStatus.ABSENT
    ).length;
    const late = attendances.filter(
      (a) => a.status === AttendanceStatus.LATE
    ).length;
    const excused = attendances.filter(
      (a) => a.status === AttendanceStatus.EXCUSED
    ).length;

    return {
      total: attendances.length,
      present,
      absent,
      late,
      excused,
      presentRate: present / attendances.length,
    };
  }

  /**
   * Busca asistencias por criterios múltiples
   */
  async search(query: {
    studentId?: string;
    activityId?: string;
    status?: AttendanceStatus;
    source?: 'manual' | 'imported' | 'automatic' | 'qr';
    dateStart?: Date;
    dateEnd?: Date;
  }): Promise<Attendance[]> {
    return this.findByCondition((attendance) => {
      if (query.studentId && attendance.studentId !== query.studentId) return false;
      if (query.activityId && attendance.activityId !== query.activityId) return false;
      if (query.status && attendance.status !== query.status) return false;
      if (query.source && attendance.source !== query.source) return false;
      if (query.dateStart && attendance.recordedAt < query.dateStart) return false;
      if (query.dateEnd && attendance.recordedAt > query.dateEnd) return false;
      return true;
    });
  }

  /**
   * Obtiene resumen de asistencias generales
   */
  async getSummary(): Promise<{
    total: number;
    byStatus: Record<AttendanceStatus, number>;
    averagePresentRate: number;
  }> {
    const all = await this.findAll();

    if (all.length === 0) {
      return {
        total: 0,
        byStatus: {
          [AttendanceStatus.PRESENT]: 0,
          [AttendanceStatus.ABSENT]: 0,
          [AttendanceStatus.LATE]: 0,
          [AttendanceStatus.EXCUSED]: 0,
          [AttendanceStatus.NOT_APPLICABLE]: 0,
        },
        averagePresentRate: 0,
      };
    }

    const byStatus = {
      [AttendanceStatus.PRESENT]: all.filter(
        (a) => a.status === AttendanceStatus.PRESENT
      ).length,
      [AttendanceStatus.ABSENT]: all.filter(
        (a) => a.status === AttendanceStatus.ABSENT
      ).length,
      [AttendanceStatus.LATE]: all.filter(
        (a) => a.status === AttendanceStatus.LATE
      ).length,
      [AttendanceStatus.EXCUSED]: all.filter(
        (a) => a.status === AttendanceStatus.EXCUSED
      ).length,
      [AttendanceStatus.NOT_APPLICABLE]: all.filter(
        (a) => a.status === AttendanceStatus.NOT_APPLICABLE
      ).length,
    };

    const averagePresentRate = byStatus[AttendanceStatus.PRESENT] / all.length;

    return { total: all.length, byStatus, averagePresentRate };
  }
}

export const attendanceRepository = new AttendanceRepository();
