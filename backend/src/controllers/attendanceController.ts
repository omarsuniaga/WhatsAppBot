/**
 * Attendance Controller - Mark attendance and generate reports
 */

import { Request, Response } from 'express';
import { AttendanceRepo, SessionsRepo, StudentsRepo, EnrollmentsRepo, ContactsRepo } from '../repos';
import { AttendanceStatus, EnrollmentStatus } from '../domain';
import { now, today, subtractDays, toDateString } from '../domain/time';

const attendanceRepo = AttendanceRepo.getInstance();
const sessionsRepo = SessionsRepo.getInstance();
const studentsRepo = StudentsRepo.getInstance();
const enrollmentsRepo = EnrollmentsRepo.getInstance();
const contactsRepo = ContactsRepo.getInstance();

/**
 * Mark attendance for a student in a session
 */
export const mark = async (req: Request, res: Response) => {
    try {
        const { sessionId, studentId, status, arrivalTime, notes } = req.body;

        if (!sessionId || !studentId || !status) {
            return res.status(400).json({
                success: false,
                error: 'sessionId, studentId, and status are required'
            });
        }

        if (!Object.values(AttendanceStatus).includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be: present, absent, late, excused'
            });
        }

        // Verify session exists
        const session = await sessionsRepo.getById(sessionId);
        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        // Find enrollment for this student in this class
        const enrollment = await enrollmentsRepo.findOne(e =>
            e.studentId === studentId &&
            e.classGroupId === session.classGroupId &&
            e.status === EnrollmentStatus.Active
        );
        if (!enrollment) {
            return res.status(400).json({
                success: false,
                error: 'Student not enrolled in this class'
            });
        }

        // Check if already marked
        const existing = await attendanceRepo.findBySessionAndStudent(sessionId, studentId);
        
        const record = await attendanceRepo.upsert({
            id: existing?.id,
            sessionId,
            studentId,
            enrollmentId: enrollment.id,
            status,
            arrivalTime: status === AttendanceStatus.Late ? arrivalTime : undefined,
            notes,
            recordedBy: 'admin',
            recordedAt: now(),
            guardianNotified: existing?.guardianNotified || false
        });

        // Update session's attendanceRecordIds
        if (!existing) {
            await sessionsRepo.upsert({
                ...session,
                attendanceRecordIds: [...session.attendanceRecordIds, record.id]
            });
        }

        res.json({
            success: true,
            data: record,
            isUpdate: !!existing
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get daily attendance report
 */
export const dailyReport = async (req: Request, res: Response) => {
    try {
        const date = (req.query.date as string) || today();
        
        // Get all sessions for this date
        const sessions = await sessionsRepo.findByDate(date);
        
        const report = await Promise.all(sessions.map(async session => {
            const records = await attendanceRepo.findBySession(session.id);
            
            const stats = {
                present: records.filter(r => r.status === AttendanceStatus.Present).length,
                absent: records.filter(r => r.status === AttendanceStatus.Absent).length,
                late: records.filter(r => r.status === AttendanceStatus.Late).length,
                excused: records.filter(r => r.status === AttendanceStatus.Excused).length
            };

            // Get student details for each record
            const recordsWithNames = await Promise.all(records.map(async r => {
                const student = await studentsRepo.getById(r.studentId);
                return {
                    ...r,
                    studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown'
                };
            }));

            return {
                sessionId: session.id,
                classGroupId: session.classGroupId,
                time: `${session.scheduledStart}-${session.scheduledEnd}`,
                stats,
                total: records.length,
                records: recordsWithNames
            };
        }));

        const totals = report.reduce((acc, s) => ({
            present: acc.present + s.stats.present,
            absent: acc.absent + s.stats.absent,
            late: acc.late + s.stats.late,
            excused: acc.excused + s.stats.excused
        }), { present: 0, absent: 0, late: 0, excused: 0 });

        res.json({
            success: true,
            data: {
                date,
                sessionsCount: sessions.length,
                totals,
                sessions: report
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get absence statistics over a period
 */
export const absenceStats = async (req: Request, res: Response) => {
    try {
        const days = parseInt(req.query.days as string) || 7;
        const endDate = today();
        const startDate = toDateString(subtractDays(now(), days - 1));

        // Get all sessions in range
        const sessions = await sessionsRepo.findByDateRange(startDate, endDate);
        const sessionIds = sessions.map(s => s.id);

        // Get all attendance records
        const allRecords = await attendanceRepo.list();
        const records = allRecords.filter(r => sessionIds.includes(r.sessionId));

        // Aggregate by student
        const studentStats: Record<string, {
            studentId: string;
            studentName: string;
            present: number;
            absent: number;
            late: number;
            excused: number;
            total: number;
            absentDates: string[];
        }> = {};

        for (const record of records) {
            if (!studentStats[record.studentId]) {
                const student = await studentsRepo.getById(record.studentId);
                studentStats[record.studentId] = {
                    studentId: record.studentId,
                    studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
                    present: 0,
                    absent: 0,
                    late: 0,
                    excused: 0,
                    total: 0,
                    absentDates: []
                };
            }

            const stats = studentStats[record.studentId];
            stats.total++;
            
            switch (record.status) {
                case AttendanceStatus.Present:
                    stats.present++;
                    break;
                case AttendanceStatus.Absent:
                    stats.absent++;
                    const session = sessions.find(s => s.id === record.sessionId);
                    if (session) stats.absentDates.push(session.date);
                    break;
                case AttendanceStatus.Late:
                    stats.late++;
                    break;
                case AttendanceStatus.Excused:
                    stats.excused++;
                    break;
            }
        }

        // Convert to array and sort by absences
        const studentsWithAbsences = Object.values(studentStats)
            .filter(s => s.absent > 0)
            .sort((a, b) => b.absent - a.absent);

        res.json({
            success: true,
            data: {
                period: { startDate, endDate, days },
                studentsWithAbsences: studentsWithAbsences.length,
                students: studentsWithAbsences,
                summary: {
                    totalRecords: records.length,
                    totalAbsences: studentsWithAbsences.reduce((sum, s) => sum + s.absent, 0)
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * List attendance records with filters
 */
export const list = async (req: Request, res: Response) => {
    try {
        const { sessionId, studentId, status } = req.query;
        let records = await attendanceRepo.list();

        if (sessionId) {
            records = records.filter(r => r.sessionId === sessionId);
        }
        if (studentId) {
            records = records.filter(r => r.studentId === studentId);
        }
        if (status) {
            records = records.filter(r => r.status === status);
        }

        res.json({ success: true, data: records, count: records.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
