import { existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { writeFileSyncAtomic } from '../utils/atomicWrite';
import Logger from './loggerService';

export type AttendanceMessageAction = 'teacher_reminder' | 'parent_absence_alert';

export type AttendanceMessageTemplate = {
    action: AttendanceMessageAction;
    name: string;
    usage: string;
    template: string;
    variables: string[];
    updatedAt: string;
};

export type AttendanceTemplateAuditEntry = {
    id: string;
    action: AttendanceMessageAction;
    updatedAt: string;
    updatedBy: string;
    source: 'update' | 'reset';
    previousTemplate: string;
    nextTemplate: string;
};

type AttendanceMessageTemplatesData = {
    updatedAt: string;
    templates: Record<AttendanceMessageAction, AttendanceMessageTemplate>;
    history: AttendanceTemplateAuditEntry[];
};

const DEFAULT_TEMPLATES: Record<AttendanceMessageAction, AttendanceMessageTemplate> = {
    teacher_reminder: {
        action: 'teacher_reminder',
        name: 'Recordatorio Docente',
        usage: 'Card: Reportes Pendientes de Hoy',
        template:
            '*RECORDATORIO DE ASISTENCIA*\n\nHola *{{teacher_name}}*, no hemos recibido el reporte de asistencia de la clase *{{class_name}}* para la fecha *{{date}}*. Por favor complete el registro a la brevedad.',
        variables: ['teacher_name', 'class_name', 'date'],
        updatedAt: new Date().toISOString()
    },
    parent_absence_alert: {
        action: 'parent_absence_alert',
        name: 'Alerta a Representante',
        usage: 'Card: Alumnos en Riesgo',
        template:
            '*ALERTA DE ASISTENCIA*\n\nEstimado representante de *{{student_name}}*, le informamos que el alumno ha acumulado *{{absences}} inasistencias* en el periodo actual. Por favor, comuníquese con la administración.',
        variables: ['student_name', 'absences'],
        updatedAt: new Date().toISOString()
    }
};

export class AttendanceMessageTemplateService {
    private static instance: AttendanceMessageTemplateService;
    private readonly dataPath: string;
    private data: AttendanceMessageTemplatesData;

    private constructor() {
        this.dataPath = path.join(process.cwd(), 'data', 'attendance-message-templates.json');
        this.data = this.loadData();
    }

    public static getInstance(): AttendanceMessageTemplateService {
        if (!AttendanceMessageTemplateService.instance) {
            AttendanceMessageTemplateService.instance = new AttendanceMessageTemplateService();
        }
        return AttendanceMessageTemplateService.instance;
    }

    public getTemplates(): AttendanceMessageTemplate[] {
        return Object.values(this.data.templates);
    }

    public getTemplate(action: AttendanceMessageAction): AttendanceMessageTemplate {
        return this.data.templates[action];
    }

    public updateTemplate(
        action: AttendanceMessageAction,
        templateText: string,
        updatedBy: string = 'system'
    ): AttendanceMessageTemplate {
        const value = String(templateText || '').trim();
        if (!value) {
            throw new Error('template is required');
        }

        const requiredVariables = this.data.templates[action]?.variables || [];
        const missingVariables = requiredVariables.filter(variable => !value.includes(`{{${variable}}}`));
        if (missingVariables.length > 0) {
            throw new Error(`Missing required variables: ${missingVariables.join(', ')}`);
        }

        const existing = this.data.templates[action];
        const updated: AttendanceMessageTemplate = {
            ...existing,
            template: value,
            updatedAt: new Date().toISOString()
        };

        this.data.templates[action] = updated;
        this.data.updatedAt = new Date().toISOString();
        this.appendHistory({
            action,
            source: 'update',
            updatedBy,
            previousTemplate: existing.template || '',
            nextTemplate: value
        });
        this.saveData();

        return updated;
    }

    public resetTemplate(
        action: AttendanceMessageAction,
        updatedBy: string = 'system'
    ): AttendanceMessageTemplate {
        const existing = this.data.templates[action];
        const defaultTemplate = DEFAULT_TEMPLATES[action];
        const resetValue = defaultTemplate.template;

        const updated: AttendanceMessageTemplate = {
            ...existing,
            template: resetValue,
            updatedAt: new Date().toISOString()
        };

        this.data.templates[action] = updated;
        this.data.updatedAt = new Date().toISOString();
        this.appendHistory({
            action,
            source: 'reset',
            updatedBy,
            previousTemplate: existing.template || '',
            nextTemplate: resetValue
        });
        this.saveData();

        return updated;
    }

    public getHistory(action?: AttendanceMessageAction, limit: number = 20): AttendanceTemplateAuditEntry[] {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 20;
        const filtered = action
            ? this.data.history.filter(item => item.action === action)
            : [...this.data.history];

        return filtered
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, safeLimit);
    }

    private loadData(): AttendanceMessageTemplatesData {
        try {
            const dir = path.dirname(this.dataPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }

            if (!existsSync(this.dataPath)) {
                const initial = this.buildDefaultData();
                writeFileSyncAtomic(this.dataPath, JSON.stringify(initial, null, 2));
                return initial;
            }

            const raw = readFileSync(this.dataPath, 'utf-8');
            const parsed = JSON.parse(raw) as Partial<AttendanceMessageTemplatesData>;
            const merged = this.mergeWithDefaults(parsed);
            return merged;
        } catch (error) {
            Logger.error('[AttendanceMessageTemplateService] Error loading templates, using defaults:', error);
            return this.buildDefaultData();
        }
    }

    private saveData(): void {
        writeFileSyncAtomic(this.dataPath, JSON.stringify(this.data, null, 2));
    }

    private buildDefaultData(): AttendanceMessageTemplatesData {
        return {
            updatedAt: new Date().toISOString(),
            templates: {
                teacher_reminder: { ...DEFAULT_TEMPLATES.teacher_reminder },
                parent_absence_alert: { ...DEFAULT_TEMPLATES.parent_absence_alert }
            },
            history: []
        };
    }

    private mergeWithDefaults(
        input: Partial<AttendanceMessageTemplatesData>
    ): AttendanceMessageTemplatesData {
        const defaults = this.buildDefaultData();
        const templates = input.templates || ({} as Partial<Record<AttendanceMessageAction, AttendanceMessageTemplate>>);

        return {
            updatedAt: input.updatedAt || defaults.updatedAt,
            templates: {
                teacher_reminder: {
                    ...defaults.templates.teacher_reminder,
                    ...(templates.teacher_reminder || {})
                },
                parent_absence_alert: {
                    ...defaults.templates.parent_absence_alert,
                    ...(templates.parent_absence_alert || {})
                }
            },
            history: Array.isArray((input as any).history)
                ? ((input as any).history as AttendanceTemplateAuditEntry[]).filter(item =>
                    item &&
                    typeof item.id === 'string' &&
                    typeof item.action === 'string' &&
                    typeof item.updatedAt === 'string'
                )
                : []
        };
    }

    private appendHistory(entry: {
        action: AttendanceMessageAction;
        updatedBy: string;
        source: 'update' | 'reset';
        previousTemplate: string;
        nextTemplate: string;
    }): void {
        const record: AttendanceTemplateAuditEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            action: entry.action,
            updatedAt: new Date().toISOString(),
            updatedBy: entry.updatedBy,
            source: entry.source,
            previousTemplate: entry.previousTemplate,
            nextTemplate: entry.nextTemplate
        };

        this.data.history.push(record);
        if (this.data.history.length > 1000) {
            this.data.history = this.data.history.slice(-1000);
        }
    }
}
