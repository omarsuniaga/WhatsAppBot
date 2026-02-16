/**
 * Entity: Attendance
 * Registro de asistencias
 */

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EXCUSED = 'excused',
  NOT_APPLICABLE = 'not_applicable'
}

export interface Attendance {
  id: string;
  activityId: string;
  studentId: string;
  status: AttendanceStatus;
  excuseReason?: string;
  minutesLate?: number;
  recordedAt: Date;
  recordedBy: string;
  createdAt: Date;
  updatedAt: Date;
  source: 'manual' | 'imported' | 'automatic' | 'qr';
  version: number;
}

export class AttendanceFactory {
  static create(activityId: string, studentId: string, recordedBy: string): Attendance {
    return {
      id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      activityId,
      studentId,
      status: AttendanceStatus.ABSENT,
      recordedAt: new Date(),
      recordedBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      source: 'manual',
      version: 1
    };
  }

  static isPresent(attendance: Attendance): boolean {
    return attendance.status === AttendanceStatus.PRESENT;
  }

  static isExcused(attendance: Attendance): boolean {
    return attendance.status === AttendanceStatus.EXCUSED;
  }

  static isAbsent(attendance: Attendance): boolean {
    return attendance.status === AttendanceStatus.ABSENT;
  }

  static isLate(attendance: Attendance): boolean {
    return attendance.status === AttendanceStatus.LATE;
  }

  static countsAsPresence(attendance: Attendance): boolean {
    return (
      AttendanceFactory.isPresent(attendance) ||
      AttendanceFactory.isLate(attendance) ||
      AttendanceFactory.isExcused(attendance)
    );
  }
}
