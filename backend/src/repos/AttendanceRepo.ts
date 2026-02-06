/**
 * AttendanceRepo - Repository for AttendanceRecord entities
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { AttendanceRecord, AttendanceStatus } from '../domain';
import { createId } from '../domain/id';

export class AttendanceRepo extends BaseRepository<AttendanceRecord> {
    private static instance: AttendanceRepo | null = null;

    private constructor(store: FileStore<EntityCollection<AttendanceRecord>>) {
        super(store, 'AttendanceRecord');
    }

    static getInstance(): AttendanceRepo {
        if (!AttendanceRepo.instance) {
            const store = createEntityStore<AttendanceRecord>('attendance.json');
            AttendanceRepo.instance = new AttendanceRepo(store);
        }
        return AttendanceRepo.instance;
    }

    protected generateId(): string {
        return createId.attendanceRecord();
    }

    protected validate(entity: AttendanceRecord): ValidationResult {
        const errors: string[] = [];

        if (!entity.sessionId?.trim()) {
            errors.push('sessionId is required');
        }
        if (!entity.studentId?.trim()) {
            errors.push('studentId is required');
        }
        if (!entity.enrollmentId?.trim()) {
            errors.push('enrollmentId is required');
        }
        if (!entity.status || !Object.values(AttendanceStatus).includes(entity.status)) {
            errors.push('Valid status is required');
        }
        if (!entity.recordedBy?.trim()) {
            errors.push('recordedBy is required');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findBySession(sessionId: string): Promise<AttendanceRecord[]> {
        return this.find(a => a.sessionId === sessionId);
    }

    async findByStudent(studentId: string): Promise<AttendanceRecord[]> {
        return this.find(a => a.studentId === studentId);
    }

    async findByEnrollment(enrollmentId: string): Promise<AttendanceRecord[]> {
        return this.find(a => a.enrollmentId === enrollmentId);
    }

    async findByStatus(status: AttendanceStatus): Promise<AttendanceRecord[]> {
        return this.find(a => a.status === status);
    }

    async findAbsentBySession(sessionId: string): Promise<AttendanceRecord[]> {
        return this.find(a => a.sessionId === sessionId && a.status === AttendanceStatus.Absent);
    }

    async findNotNotified(): Promise<AttendanceRecord[]> {
        return this.find(a => !a.guardianNotified && a.status === AttendanceStatus.Absent);
    }

    async findBySessionAndStudent(sessionId: string, studentId: string): Promise<AttendanceRecord | null> {
        return this.findOne(a => a.sessionId === sessionId && a.studentId === studentId);
    }
}

export default AttendanceRepo;
