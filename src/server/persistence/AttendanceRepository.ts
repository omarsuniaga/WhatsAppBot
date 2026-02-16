/**
 * AttendanceRepository - Store daily attendance records by YYYY-MM-DD
 * 
 * MIGRATION NOTE: Implements IAttendanceRepository interface.
 * To migrate to Firestore, create a new class implementing the same interface.
 */

import { FileStore, createStores, AttendanceFileData } from './FileStore';
import { getErrorMessage } from '../utils/errorUtils';
import type { 
    DailyAttendance, 
    AttendanceRecord, 
    AttendanceStatus,
    IAttendanceRepository 
} from '../types/entities';

export class AttendanceRepository implements IAttendanceRepository {
    private store: FileStore<AttendanceFileData>;
    private static instance: AttendanceRepository | null = null;

    private constructor() {
        this.store = createStores.attendance();
    }

    static getInstance(): AttendanceRepository {
        if (!AttendanceRepository.instance) {
            AttendanceRepository.instance = new AttendanceRepository();
        }
        return AttendanceRepository.instance;
    }

    async initialize(): Promise<void> {
        await this.store.ensureFileExists();
    }

    /**
     * Get attendance for a specific date
     */
    async getByDate(date: string): Promise<DailyAttendance | null> {
        const data = await this.store.read();
        return data.byDate[date] || null;
    }

    /**
     * Get attendance for a date range
     */
    async getByDateRange(startDate: string, endDate: string): Promise<DailyAttendance[]> {
        const data = await this.store.read();
        const result: DailyAttendance[] = [];
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (const [dateKey, attendance] of Object.entries(data.byDate)) {
            const date = new Date(dateKey);
            if (date >= start && date <= end) {
                result.push(attendance);
            }
        }
        
        return result.sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Save or update daily attendance
     */
    async saveDaily(attendance: DailyAttendance): Promise<void> {
        const now = new Date().toISOString();
        
        await this.store.update(data => ({
            ...data,
            byDate: {
                ...data.byDate,
                [attendance.date]: {
                    ...attendance,
                    updatedAt: now
                }
            }
        }));
    }

    /**
     * Get a specific student's attendance within a date range
     */
    async getStudentAttendance(
        studentId: string, 
        startDate: string, 
        endDate: string
    ): Promise<AttendanceRecord[]> {
        const dailyRecords = await this.getByDateRange(startDate, endDate);
        const result: AttendanceRecord[] = [];
        
        for (const daily of dailyRecords) {
            const record = daily.records.find(r => r.studentId === studentId);
            if (record) {
                result.push(record);
            }
        }
        
        return result;
    }

    /**
     * Record attendance for a single student on a specific date
     */
    async recordStudentAttendance(
        date: string,
        studentId: string,
        status: AttendanceStatus,
        options?: {
            classId?: string;
            ensembleId?: string;
            arrivalTime?: string;
            notes?: string;
            recordedBy?: string;
        }
    ): Promise<void> {
        const now = new Date().toISOString();
        
        await this.store.update(data => {
            const existing = data.byDate[date] || {
                date,
                classId: options?.classId,
                ensembleId: options?.ensembleId,
                records: [],
                createdAt: now,
                updatedAt: now
            };
            
            // Remove existing record for this student if any
            const records = existing.records.filter(r => r.studentId !== studentId);
            
            // Add new record
            records.push({
                studentId,
                status,
                arrivalTime: options?.arrivalTime,
                notes: options?.notes,
                recordedBy: options?.recordedBy || 'system',
                recordedAt: now
            });
            
            return {
                ...data,
                byDate: {
                    ...data.byDate,
                    [date]: {
                        ...existing,
                        records,
                        updatedAt: now
                    }
                }
            };
        });
    }

    /**
     * Bulk import attendance records
     */
    async importBulk(records: Array<{
        date: string;
        studentId: string;
        status: AttendanceStatus;
        classId?: string;
        ensembleId?: string;
        arrivalTime?: string;
        notes?: string;
    }>): Promise<{ imported: number; errors: string[] }> {
        const errors: string[] = [];
        let imported = 0;
        
        // Group records by date
        const byDate = new Map<string, typeof records>();
        for (const record of records) {
            if (!record.date || !record.studentId || !record.status) {
                errors.push(`Invalid record: missing required fields`);
                continue;
            }
            
            const dateRecords = byDate.get(record.date) || [];
            dateRecords.push(record);
            byDate.set(record.date, dateRecords);
        }
        
        // Process each date
        for (const [date, dateRecords] of byDate) {
            for (const record of dateRecords) {
                try {
                    await this.recordStudentAttendance(
                        date,
                        record.studentId,
                        record.status,
                        {
                            classId: record.classId,
                            ensembleId: record.ensembleId,
                            arrivalTime: record.arrivalTime,
                            notes: record.notes,
                            recordedBy: 'import'
                        }
                    );
                    imported++;
                } catch (error: unknown) {
                    errors.push(`Error importing ${record.studentId} on ${date}: ${getErrorMessage(error)}`);
                }
            }
        }
        
        return { imported, errors };
    }

    /**
     * Get attendance summary for a student
     */
    async getStudentSummary(
        studentId: string,
        startDate: string,
        endDate: string
    ): Promise<{
        total: number;
        present: number;
        absent: number;
        late: number;
        excused: number;
        attendanceRate: number;
    }> {
        const records = await this.getStudentAttendance(studentId, startDate, endDate);
        
        const summary = {
            total: records.length,
            present: records.filter(r => r.status === 'present').length,
            absent: records.filter(r => r.status === 'absent').length,
            late: records.filter(r => r.status === 'late').length,
            excused: records.filter(r => r.status === 'excused').length,
            attendanceRate: 0
        };
        
        if (summary.total > 0) {
            summary.attendanceRate = ((summary.present + summary.late) / summary.total) * 100;
        }
        
        return summary;
    }

    /**
     * Get today's attendance
     */
    async getToday(): Promise<DailyAttendance | null> {
        const today = new Date().toISOString().split('T')[0];
        return this.getByDate(today);
    }

    /**
     * Delete attendance for a date
     */
    async deleteByDate(date: string): Promise<boolean> {
        let deleted = false;
        
        await this.store.update(data => {
            if (!data.byDate[date]) return data;
            
            deleted = true;
            const { [date]: removed, ...remaining } = data.byDate;
            
            return {
                ...data,
                byDate: remaining
            };
        });
        
        return deleted;
    }

    /**
     * Upsert daily attendance - replaces all records for a date
     * Use this for bulk imports where you want to replace the entire day's records
     */
    async upsertDaily(date: string, records: AttendanceRecord[], options?: {
        classId?: string;
        ensembleId?: string;
    }): Promise<DailyAttendance> {
        const now = new Date().toISOString();
        
        const daily: DailyAttendance = {
            date,
            classId: options?.classId,
            ensembleId: options?.ensembleId,
            records: records.map(r => ({
                ...r,
                recordedAt: r.recordedAt || now
            })),
            createdAt: now,
            updatedAt: now
        };

        await this.store.update(data => {
            const existing = data.byDate[date];
            return {
                ...data,
                byDate: {
                    ...data.byDate,
                    [date]: {
                        ...daily,
                        createdAt: existing?.createdAt || now
                    }
                }
            };
        });

        return daily;
    }

    /**
     * Get attendance range (alias for getByDateRange for API consistency)
     */
    async getRange(startDate: string, endDate: string): Promise<DailyAttendance[]> {
        return this.getByDateRange(startDate, endDate);
    }

    /**
     * Get all attendance records flattened with date info
     * Useful for computing stats across multiple days
     */
    async getAllRecordsInRange(startDate: string, endDate: string): Promise<Array<{
        date: string;
        studentId: string;
        status: AttendanceStatus;
        arrivalTime?: string;
        notes?: string;
    }>> {
        const dailyRecords = await this.getByDateRange(startDate, endDate);
        const result: Array<{
            date: string;
            studentId: string;
            status: AttendanceStatus;
            arrivalTime?: string;
            notes?: string;
        }> = [];

        for (const daily of dailyRecords) {
            for (const record of daily.records) {
                result.push({
                    date: daily.date,
                    studentId: record.studentId,
                    status: record.status,
                    arrivalTime: record.arrivalTime,
                    notes: record.notes
                });
            }
        }

        return result;
    }
}

export default AttendanceRepository;
