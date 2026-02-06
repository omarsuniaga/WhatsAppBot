/**
 * AttendanceService - Business logic for attendance tracking and analysis
 * 
 * Provides:
 * - Absence statistics computation
 * - Attendance rate calculations
 * - Student attendance summaries for automations
 */

import { AttendanceRepository } from '../persistence/AttendanceRepository';
import { StudentsRepository } from '../persistence/StudentsRepository';
import type { AttendanceStatus } from '../types/entities';

export interface StudentAttendanceStats {
    studentId: string;
    studentName: string;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    totalDays: number;
    attendanceRate: number;
    absentDates: string[];
    lateDates: string[];
}

export interface AbsenceStatsResult {
    startDate: string;
    endDate: string;
    totalDays: number;
    students: StudentAttendanceStats[];
    summary: {
        totalStudents: number;
        studentsWithAbsences: number;
        averageAttendanceRate: number;
    };
}

export interface StudentAtRisk {
    studentId: string;
    studentName: string;
    absentCount: number;
    lateCount: number;
    contactIds: string[];
    absentDates: string[];
}

export class AttendanceService {
    private static instance: AttendanceService | null = null;
    
    private attendanceRepo: AttendanceRepository;
    private studentsRepo: StudentsRepository;

    private constructor() {
        this.attendanceRepo = AttendanceRepository.getInstance();
        this.studentsRepo = StudentsRepository.getInstance();
    }

    static getInstance(): AttendanceService {
        if (!AttendanceService.instance) {
            AttendanceService.instance = new AttendanceService();
        }
        return AttendanceService.instance;
    }

    /**
     * Compute absence statistics for a given number of days
     * 
     * @param days - Number of days to look back (default: 7)
     * @returns Statistics per student including absence counts
     */
    async computeAbsenceStats(days: number = 7): Promise<AbsenceStatsResult> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Get all attendance records in range
        const records = await this.attendanceRepo.getAllRecordsInRange(startDateStr, endDateStr);

        // Get all active students for reference
        const activeStudents = await this.studentsRepo.findActive();
        const studentMap = new Map(activeStudents.map(s => [s.id, s]));

        // Aggregate stats per student
        const statsMap = new Map<string, {
            presentCount: number;
            absentCount: number;
            lateCount: number;
            excusedCount: number;
            absentDates: string[];
            lateDates: string[];
        }>();

        // Initialize stats for all active students
        for (const student of activeStudents) {
            statsMap.set(student.id, {
                presentCount: 0,
                absentCount: 0,
                lateCount: 0,
                excusedCount: 0,
                absentDates: [],
                lateDates: []
            });
        }

        // Process attendance records
        for (const record of records) {
            let stats = statsMap.get(record.studentId);
            if (!stats) {
                // Student not in active list, create entry
                stats = {
                    presentCount: 0,
                    absentCount: 0,
                    lateCount: 0,
                    excusedCount: 0,
                    absentDates: [],
                    lateDates: []
                };
                statsMap.set(record.studentId, stats);
            }

            switch (record.status) {
                case 'present':
                    stats.presentCount++;
                    break;
                case 'absent':
                    stats.absentCount++;
                    stats.absentDates.push(record.date);
                    break;
                case 'late':
                    stats.lateCount++;
                    stats.lateDates.push(record.date);
                    break;
                case 'excused':
                    stats.excusedCount++;
                    break;
            }
        }

        // Build result
        const students: StudentAttendanceStats[] = [];
        let totalAttendanceRate = 0;
        let studentsWithAbsences = 0;

        for (const [studentId, stats] of statsMap) {
            const student = studentMap.get(studentId);
            const totalDays = stats.presentCount + stats.absentCount + stats.lateCount + stats.excusedCount;
            const attendanceRate = totalDays > 0 
                ? ((stats.presentCount + stats.lateCount) / totalDays) * 100 
                : 100;

            if (stats.absentCount > 0) {
                studentsWithAbsences++;
            }

            totalAttendanceRate += attendanceRate;

            students.push({
                studentId,
                studentName: student 
                    ? `${student.firstName} ${student.lastName}` 
                    : `Student ${studentId}`,
                presentCount: stats.presentCount,
                absentCount: stats.absentCount,
                lateCount: stats.lateCount,
                excusedCount: stats.excusedCount,
                totalDays,
                attendanceRate: Math.round(attendanceRate * 100) / 100,
                absentDates: stats.absentDates.sort(),
                lateDates: stats.lateDates.sort()
            });
        }

        // Sort by absence count descending
        students.sort((a, b) => b.absentCount - a.absentCount);

        return {
            startDate: startDateStr,
            endDate: endDateStr,
            totalDays: days,
            students,
            summary: {
                totalStudents: students.length,
                studentsWithAbsences,
                averageAttendanceRate: students.length > 0 
                    ? Math.round((totalAttendanceRate / students.length) * 100) / 100 
                    : 100
            }
        };
    }

    /**
     * Get students at risk based on absence threshold
     * 
     * @param days - Number of days to analyze
     * @param threshold - Minimum absences to be considered at risk
     * @returns List of students at risk with their contact info
     */
    async getStudentsAtRisk(days: number = 7, threshold: number = 2): Promise<StudentAtRisk[]> {
        const stats = await this.computeAbsenceStats(days);
        const atRisk: StudentAtRisk[] = [];

        for (const student of stats.students) {
            if (student.absentCount >= threshold) {
                // Get student details for contact IDs
                const studentDetails = await this.studentsRepo.findById(student.studentId);
                
                atRisk.push({
                    studentId: student.studentId,
                    studentName: student.studentName,
                    absentCount: student.absentCount,
                    lateCount: student.lateCount,
                    contactIds: studentDetails?.contactIds || [],
                    absentDates: student.absentDates
                });
            }
        }

        return atRisk;
    }

    /**
     * Get attendance summary for a specific student
     */
    async getStudentStats(studentId: string, days: number = 30): Promise<StudentAttendanceStats | null> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const student = await this.studentsRepo.findById(studentId);
        if (!student) return null;

        const records = await this.attendanceRepo.getStudentAttendance(studentId, startDateStr, endDateStr);

        const stats = {
            presentCount: 0,
            absentCount: 0,
            lateCount: 0,
            excusedCount: 0,
            absentDates: [] as string[],
            lateDates: [] as string[]
        };

        // We need to get dates from the full records
        const allRecords = await this.attendanceRepo.getAllRecordsInRange(startDateStr, endDateStr);
        const studentRecords = allRecords.filter(r => r.studentId === studentId);

        for (const record of studentRecords) {
            switch (record.status) {
                case 'present':
                    stats.presentCount++;
                    break;
                case 'absent':
                    stats.absentCount++;
                    stats.absentDates.push(record.date);
                    break;
                case 'late':
                    stats.lateCount++;
                    stats.lateDates.push(record.date);
                    break;
                case 'excused':
                    stats.excusedCount++;
                    break;
            }
        }

        const totalDays = stats.presentCount + stats.absentCount + stats.lateCount + stats.excusedCount;
        const attendanceRate = totalDays > 0 
            ? ((stats.presentCount + stats.lateCount) / totalDays) * 100 
            : 100;

        return {
            studentId,
            studentName: `${student.firstName} ${student.lastName}`,
            presentCount: stats.presentCount,
            absentCount: stats.absentCount,
            lateCount: stats.lateCount,
            excusedCount: stats.excusedCount,
            totalDays,
            attendanceRate: Math.round(attendanceRate * 100) / 100,
            absentDates: stats.absentDates.sort(),
            lateDates: stats.lateDates.sort()
        };
    }
}

export default AttendanceService;
