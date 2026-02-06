/**
 * AttendanceService - Attendance marking and reporting
 * 
 * Domain service for attendance management. No HTTP/UI dependencies.
 */

import { EventEmitter } from 'events';
import { AttendanceRecord } from '../domain/types';
import { AttendanceStatus, EnrollmentStatus } from '../domain/enums';
import { AttendanceRepo, SessionsRepo, EnrollmentsRepo } from '../repos';
import { now } from '../domain/time';

export interface DailyReport {
    [classGroupId: string]: {
        present: number;
        absent: number;
        late: number;
        excused: number;
        total: number;
    };
}

export interface AbsenceStats {
    [studentId: string]: {
        absences: number;
        lates: number;
    };
}

export class AttendanceService extends EventEmitter {
    private static instance: AttendanceService;
    private attendanceRepo = AttendanceRepo.getInstance();
    private sessionsRepo = SessionsRepo.getInstance();
    private enrollmentsRepo = EnrollmentsRepo.getInstance();

    private constructor() {
        super();
    }

    public static getInstance(): AttendanceService {
        if (!AttendanceService.instance) {
            AttendanceService.instance = new AttendanceService();
        }
        return AttendanceService.instance;
    }

    /**
     * Marks attendance for a student in a session.
     * @param sessionId - The session ID.
     * @param studentId - The student ID.
     * @param status - The attendance status.
     * @param note - Optional notes.
     * @param markedBy - Who marked attendance (e.g., teacher ID or 'system').
     * @returns The created attendance record.
     */
    async markAttendance(
        sessionId: string,
        studentId: string,
        status: AttendanceStatus,
        note?: string,
        markedBy: string = 'system'
    ): Promise<AttendanceRecord> {
        const session = await this.sessionsRepo.getById(sessionId);
        if (!session) {
            throw new Error(`Session with id ${sessionId} not found`);
        }
        
        // Find enrollment for this student in this class
        const enrollment = await this.enrollmentsRepo.findOne(
            e => e.studentId === studentId && 
                 e.classGroupId === session.classGroupId &&
                 e.status === EnrollmentStatus.Active
        );
        if (!enrollment) {
            throw new Error(`Student ${studentId} is not enrolled in class group for session ${sessionId}`);
        }

        // Check if already marked
        const existing = await this.attendanceRepo.findBySessionAndStudent(sessionId, studentId);

        const newRecord = await this.attendanceRepo.upsert({
            id: existing?.id,
            sessionId,
            studentId,
            enrollmentId: enrollment.id,
            status,
            notes: note,
            recordedBy: markedBy,
            recordedAt: now(),
            guardianNotified: existing?.guardianNotified || false,
        });

        this.emit('attendance:marked', newRecord);
        return newRecord;
    }

    /**
     * Generates a daily attendance report for a given date.
     * @param dateYYYYMMDD - The date in YYYY-MM-DD format.
     * @returns A report grouped by class group ID.
     */
    async getDailyReport(dateYYYYMMDD: string): Promise<DailyReport> {
        const sessions = await this.sessionsRepo.findByDate(dateYYYYMMDD);
        const sessionIds = sessions.map(s => s.id);

        if (sessionIds.length === 0) {
            return {};
        }

        const allRecords = await this.attendanceRepo.list();
        const attendanceRecords = allRecords.filter(r => sessionIds.includes(r.sessionId));

        const report: DailyReport = {};

        for (const session of sessions) {
            if (!report[session.classGroupId]) {
                report[session.classGroupId] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
            }
        }

        for (const record of attendanceRecords) {
            const session = sessions.find(s => s.id === record.sessionId);
            if (session) {
                const groupReport = report[session.classGroupId];
                groupReport.total++;
                switch (record.status) {
                    case AttendanceStatus.Present:
                        groupReport.present++;
                        break;
                    case AttendanceStatus.Absent:
                        groupReport.absent++;
                        break;
                    case AttendanceStatus.Late:
                        groupReport.late++;
                        break;
                    case AttendanceStatus.Excused:
                        groupReport.excused++;
                        break;
                }
            }
        }
        this.emit('report:daily', { date: dateYYYYMMDD, report });
        return report;
    }

    /**
     * Gets absence statistics for all students over a period of days.
     * @param days - The number of days to look back (default: 7).
     * @returns Absence and late counts per student.
     */
    async getAbsenceStats(days: number = 7): Promise<AbsenceStats> {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        // Get all records and filter by date
        const allRecords = await this.attendanceRepo.list();
        const sinceTimestamp = Math.floor(sinceDate.getTime() / 1000);
        const recentRecords = allRecords.filter(r => r.createdAt > sinceTimestamp);
        
        const stats: AbsenceStats = {};

        for (const record of recentRecords) {
            if (!stats[record.studentId]) {
                stats[record.studentId] = { absences: 0, lates: 0 };
            }

            if (record.status === AttendanceStatus.Absent) {
                stats[record.studentId].absences++;
            } else if (record.status === AttendanceStatus.Late) {
                stats[record.studentId].lates++;
            }
        }
        this.emit('report:absence', { days, stats });
        return stats;
    }
}

export default AttendanceService;
