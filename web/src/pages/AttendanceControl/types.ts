import { type Asistencia } from '../../services/firestore';

export type FilterPeriod = 'today' | 'week' | 'month' | 'custom';

export interface EnrichedAttendance extends Asistencia {
    className: string;
    studentName: string;
    teacherName: string;
    teacherId?: string;
    teacherJid?: string;
    parentJid?: string;
}

export interface PendingClass {
    id: string;
    name: string;
    teacher: string;
    teacherId?: string;
    teacherJid?: string;
}

export interface CriticalStudent {
    id: string;
    name: string;
    absences: number;
    parentJid?: string;
}

export interface ContactDiagnosticItem {
    id: string;
    entityType: 'student' | 'teacher';
    name: string;
    reason: string;
    entityId?: string;
    classId?: string;
}

export interface IntegrityIssue {
    id: string;
    type: 'class_teacher_missing' | 'class_teacher_orphan' | 'class_teacher_unlinked' | 'class_teacher_no_channel';
    severity: 'high' | 'medium';
    classId: string;
    className: string;
    teacherId?: string;
    teacherName?: string;
    reason: string;
}

export type AttendanceMessageAction = 'teacher_reminder' | 'parent_absence_alert';

export interface AttendanceMessageTemplate {
    action: AttendanceMessageAction;
    name: string;
    usage: string;
    template: string;
    variables: string[];
    updatedAt: string;
}

export interface AttendanceTemplateAuditEntry {
    id: string;
    action: AttendanceMessageAction;
    updatedAt: string;
    updatedBy: string;
    source: 'update' | 'reset';
    previousTemplate: string;
    nextTemplate: string;
}

export interface InlineToast {
    type: 'success' | 'error' | 'info';
    text: string;
}
