/**
 * AutomationService - Generate message drafts for staff review before sending
 * 
 * This service generates drafts only - no messages are sent automatically.
 * Staff must review and confirm each draft before it is sent.
 */

import {
    AttendanceRepo,
    SessionsRepo,
    StudentsRepo,
    ContactsRepo,
    EnrollmentsRepo,
    TemplatesRepo,
    EventLogRepo
} from '../repos';
import { AttendanceStatus, EventLogType, EventLogLevel } from '../domain';
import { now, today, subtractDays, toDateString } from '../domain/time';

// Types
export interface AbsenceDraftRequest {
    days: number;              // Look back N days
    threshold: number;         // Minimum absences to trigger
    templateId?: string;       // Optional template ID for message
    dateRange?: {              // Optional specific date range
        startDate: string;
        endDate: string;
    };
    dryRun?: boolean;          // If true, don't log to EventLog
}

export interface AbsenceDraft {
    contactId: string;
    contactName: string;
    phone: string;
    studentId: string;
    studentName: string;
    absenceCount: number;
    absenceDates: string[];
    messageText: string;
    reason: string;
    templateId?: string;
}

export interface AbsenceDraftResult {
    success: boolean;
    drafts: AbsenceDraft[];
    summary: {
        studentsAnalyzed: number;
        studentsAboveThreshold: number;
        draftsGenerated: number;
        period: { startDate: string; endDate: string; days: number };
        threshold: number;
    };
    errors: string[];
}

// NEW: Real-time Alert Types
export interface AttendanceAlertConfig {
    enabled: boolean;
    absenceThreshold: number;      // Minimum consecutive absences
    daysToAnalyze: number;          // Period to analyze
    autoSend: boolean;              // Auto-send or draft only
    templateId?: string;
    notifyGuardians: boolean;
}

export interface AttendanceAlertEvent {
    id: string;
    studentId: string;
    studentName: string;
    absenceCount: number;
    guardianIds: string[];
    sent: boolean;
    createdAt: Date;
    sentAt?: Date;
}

// Default template for absence notifications
const DEFAULT_ABSENCE_TEMPLATE = `Estimado/a {{guardianName}},

Le informamos que {{studentName}} ha tenido {{absenceCount}} ausencia(s) en los últimos {{days}} días ({{absenceDates}}).

Por favor, contáctenos si hay alguna situación que debamos conocer.

Atentamente,
El Sistema Punta Cana`;

class AutomationService {
    private static instance: AutomationService;

    private attendanceRepo = AttendanceRepo.getInstance();
    private sessionsRepo = SessionsRepo.getInstance();
    private studentsRepo = StudentsRepo.getInstance();
    private contactsRepo = ContactsRepo.getInstance();
    private enrollmentsRepo = EnrollmentsRepo.getInstance();
    private templatesRepo = TemplatesRepo.getInstance();
    private eventLogRepo = EventLogRepo.getInstance();

    // NEW: Alert configuration
    private alertConfig: AttendanceAlertConfig = {
        enabled: true,
        absenceThreshold: 3,
        daysToAnalyze: 7,
        autoSend: false, // Requires manual approval by default
        notifyGuardians: true
    };

    private constructor() {
        // Initialize event listeners for real-time alerts
        this.setupEventListeners();
    }

    static getInstance(): AutomationService {
        if (!AutomationService.instance) {
            AutomationService.instance = new AutomationService();
        }
        return AutomationService.instance;
    }

    // =========================================
    // ALERT CONFIGURATION
    // =========================================

    getAlertConfig(): AttendanceAlertConfig {
        return { ...this.alertConfig };
    }

    updateAlertConfig(config: Partial<AttendanceAlertConfig>): AttendanceAlertConfig {
        this.alertConfig = { ...this.alertConfig, ...config };
        return this.getAlertConfig();
    }

    // =========================================
    // EVENT-DRIVEN REAL-TIME ALERTS
    // =========================================

    /**
     * Setup event listeners for real-time attendance alerts
     */
    private setupEventListeners(): void {
        const AttendanceService = require('./AttendanceService').default;
        const attendanceService = AttendanceService.getInstance();

        // Listen to attendance:marked events
        attendanceService.on('attendance:marked', async (record: any) => {
            if (this.alertConfig.enabled && record.status === AttendanceStatus.Absent) {
                await this.evaluateRealtimeAlert(record);
            }
        });

        // Listen to daily report events for batch analysis
        attendanceService.on('report:daily', async () => {
            if (this.alertConfig.enabled) {
                await this.runDailyAlertAnalysis();
            }
        });
    }

    /**
     * Evaluate if an absence triggers an alert
     */
    private async evaluateRealtimeAlert(record: any): Promise<void> {
        try {
            // Get recent absence stats for this student
            const endDate = today();
            const startDate = toDateString(subtractDays(now(), this.alertConfig.daysToAnalyze - 1));

            const sessions = await this.sessionsRepo.findByDateRange(startDate, endDate);
            const sessionIds = sessions.map(s => s.id);

            const allAttendance = await this.attendanceRepo.list();
            const studentAttendance = allAttendance.filter(
                a => a.studentId === record.studentId && sessionIds.includes(a.sessionId)
            );

            const absenceCount = studentAttendance.filter(
                a => a.status === AttendanceStatus.Absent
            ).length;

            // Check if threshold exceeded
            if (absenceCount >= this.alertConfig.absenceThreshold) {
                await this.triggerAttendanceAlert(record.studentId, absenceCount);
            }
        } catch (error: any) {
            console.error('Error evaluating realtime alert:', error);
            await this.eventLogRepo.log(
                EventLogType.AutomationTriggered,
                EventLogLevel.Error,
                `Failed to evaluate alert: ${error.message}`,
                {
                    entityType: 'automation',
                    entityId: 'attendance_alert',
                    data: { studentId: record.studentId, error: error.message },
                    actorType: 'system'
                }
            );
        }
    }

    /**
     * Trigger alert for a student (draft or auto-send)
     */
    private async triggerAttendanceAlert(studentId: string, absenceCount: number): Promise<void> {
        const student = await this.studentsRepo.getById(studentId);
        if (!student || !student.contactIds?.length) {
            console.warn(`Cannot send alert: Student ${studentId} has no contacts`);
            return;
        }

        // Get guardians
        const guardians = await Promise.all(
            student.contactIds.map(id => this.contactsRepo.getById(id))
        );
        const validGuardians = guardians.filter(g => g && g.phones?.length > 0);

        if (validGuardians.length === 0) {
            console.warn(`No valid guardians found for student ${studentId}`);
            return;
        }

        // Build message
        const templateBody = this.alertConfig.templateId
            ? (await this.templatesRepo.getById(this.alertConfig.templateId))?.body || DEFAULT_ABSENCE_TEMPLATE
            : DEFAULT_ABSENCE_TEMPLATE;

        // Generate draft for each guardian
        for (const guardian of validGuardians) {
            if (!guardian) continue;

            const messageText = this.renderTemplate(templateBody, {
                guardianName: `${guardian.firstName} ${guardian.lastName}`,
                studentName: `${student.firstName} ${student.lastName}`,
                absenceCount: absenceCount.toString(),
                days: this.alertConfig.daysToAnalyze.toString(),
                absenceDates: 'últimos días' // TODO: Get actual dates
            });

            // Log the alert event
            await this.eventLogRepo.log(
                EventLogType.AutomationTriggered,
                EventLogLevel.Info,
                `Attendance alert triggered for ${student.firstName} ${student.lastName}`,
                {
                    entityType: 'student',
                    entityId: studentId,
                    data: {
                        guardianId: guardian.id,
                        guardianName: `${guardian.firstName} ${guardian.lastName}`,
                        absenceCount,
                        autoSend: this.alertConfig.autoSend,
                        messageText
                    },
                    actorType: 'system'
                }
            );

            // Future: Integration with BroadcastService for actual sending
            // if (this.alertConfig.autoSend) {
            //     await broadcastService.sendImmediateMessage(...);
            // }
        }
    }

    /**
     * Run daily batch analysis for all students
     */
    private async runDailyAlertAnalysis(): Promise<void> {
        console.log('Running daily attendance alert analysis...');
        
        const result = await this.generateAbsenceDrafts({
            days: this.alertConfig.daysToAnalyze,
            threshold: this.alertConfig.absenceThreshold,
            templateId: this.alertConfig.templateId
        });

        await this.eventLogRepo.log(
            EventLogType.AutomationTriggered,
            EventLogLevel.Info,
            `Daily alert analysis complete: ${result.drafts.length} alerts generated`,
            {
                entityType: 'automation',
                entityId: 'daily_attendance_alerts',
                data: result.summary,
                actorType: 'system'
            }
        );
    }

    /**
     * Generate absence notification drafts for students exceeding the threshold
     */
    async generateAbsenceDrafts(request: AbsenceDraftRequest): Promise<AbsenceDraftResult> {
        const { days, threshold, templateId, dateRange, dryRun } = request;
        const errors: string[] = [];
        const drafts: AbsenceDraft[] = [];

        // Determine date range
        const endDate = dateRange?.endDate || today();
        const startDate = dateRange?.startDate || toDateString(subtractDays(now(), days - 1));

        // Load template if specified
        let templateBody = DEFAULT_ABSENCE_TEMPLATE;
        if (templateId) {
            const template = await this.templatesRepo.getById(templateId);
            if (template) {
                templateBody = template.body;
            } else {
                errors.push(`Template ${templateId} not found, using default`);
            }
        }

        // Get all sessions in the date range
        const sessions = await this.sessionsRepo.findByDateRange(startDate, endDate);
        const sessionIds = sessions.map(s => s.id);

        if (sessionIds.length === 0) {
            return {
                success: true,
                drafts: [],
                summary: {
                    studentsAnalyzed: 0,
                    studentsAboveThreshold: 0,
                    draftsGenerated: 0,
                    period: { startDate, endDate, days },
                    threshold
                },
                errors: ['No sessions found in the specified date range']
            };
        }

        // Get all attendance records for these sessions
        const allAttendance = await this.attendanceRepo.list();
        const relevantAttendance = allAttendance.filter(a => sessionIds.includes(a.sessionId));

        // Aggregate absences by student
        const studentAbsences: Map<string, { count: number; dates: string[] }> = new Map();

        for (const record of relevantAttendance) {
            if (record.status === AttendanceStatus.Absent) {
                const session = sessions.find(s => s.id === record.sessionId);
                const existing = studentAbsences.get(record.studentId) || { count: 0, dates: [] };
                existing.count++;
                if (session && !existing.dates.includes(session.date)) {
                    existing.dates.push(session.date);
                }
                studentAbsences.set(record.studentId, existing);
            }
        }

        // Get unique students analyzed
        const uniqueStudentIds = new Set(relevantAttendance.map(a => a.studentId));
        const studentsAnalyzed = uniqueStudentIds.size;

        // Filter students above threshold and generate drafts
        const studentsAboveThreshold: string[] = [];

        for (const [studentId, absenceData] of studentAbsences.entries()) {
            if (absenceData.count >= threshold) {
                studentsAboveThreshold.push(studentId);

                try {
                    const draft = await this.createDraftForStudent(
                        studentId,
                        absenceData,
                        days,
                        templateBody,
                        templateId
                    );
                    if (draft) {
                        drafts.push(draft);
                    }
                } catch (err: any) {
                    errors.push(`Error creating draft for student ${studentId}: ${err.message}`);
                }
            }
        }

        // Log the draft generation event (unless dry run)
        if (!dryRun && drafts.length > 0) {
            await this.eventLogRepo.log(
                EventLogType.AutomationTriggered,
                EventLogLevel.Info,
                `Generated ${drafts.length} absence notification drafts`,
                {
                    entityType: 'automation',
                    entityId: 'absence_drafts',
                    data: {
                        days,
                        threshold,
                        templateId,
                        period: { startDate, endDate },
                        draftsCount: drafts.length,
                        studentIds: drafts.map(d => d.studentId)
                    },
                    actorType: 'system'
                }
            );
        }

        return {
            success: errors.length === 0,
            drafts,
            summary: {
                studentsAnalyzed,
                studentsAboveThreshold: studentsAboveThreshold.length,
                draftsGenerated: drafts.length,
                period: { startDate, endDate, days },
                threshold
            },
            errors
        };
    }

    /**
     * Create a draft for a specific student
     */
    private async createDraftForStudent(
        studentId: string,
        absenceData: { count: number; dates: string[] },
        days: number,
        templateBody: string,
        templateId?: string
    ): Promise<AbsenceDraft | null> {
        // Get student info
        const student = await this.studentsRepo.getById(studentId);
        if (!student) {
            throw new Error('Student not found');
        }

        // Get primary contact (first in contactIds)
        if (!student.contactIds || student.contactIds.length === 0) {
            throw new Error('Student has no contacts');
        }
        const contact = await this.contactsRepo.getById(student.contactIds[0]);
        if (!contact) {
            throw new Error('Primary contact not found');
        }

        const phone = contact.preferredPhone || contact.phones[0];
        if (!phone) {
            throw new Error('Contact has no phone number');
        }

        // Render template
        const absenceDatesFormatted = absenceData.dates
            .sort()
            .map(d => this.formatDateSpanish(d))
            .join(', ');

        const messageText = this.renderTemplate(templateBody, {
            guardianName: `${contact.firstName} ${contact.lastName}`,
            studentName: `${student.firstName} ${student.lastName}`,
            absenceCount: absenceData.count.toString(),
            days: days.toString(),
            absenceDates: absenceDatesFormatted
        });

        return {
            contactId: contact.id,
            contactName: `${contact.firstName} ${contact.lastName}`,
            phone,
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`,
            absenceCount: absenceData.count,
            absenceDates: absenceData.dates,
            messageText,
            reason: `${absenceData.count} absences in last ${days} days (threshold: ${absenceData.count})`,
            templateId
        };
    }

    /**
     * Render template with variables
     */
    private renderTemplate(template: string, variables: Record<string, string>): string {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
        return result;
    }

    /**
     * Format date in Spanish
     */
    private formatDateSpanish(dateStr: string): string {
        const date = new Date(dateStr + 'T12:00:00');
        return date.toLocaleDateString('es-DO', {
            day: 'numeric',
            month: 'short'
        });
    }

    // =========================================
    // EXTENSION POINTS FOR FUTURE AUTOMATION
    // =========================================

    /**
     * Placeholder: Schedule automated draft generation
     * 
     * Future implementation could use node-cron or similar:
     * ```
     * import cron from 'node-cron';
     * 
     * scheduleAbsenceCheck(cronExpression: string) {
     *   cron.schedule(cronExpression, async () => {
     *     const drafts = await this.generateAbsenceDrafts({
     *       days: 7,
     *       threshold: 2
     *     });
     *     // Notify admins of new drafts via WebSocket or email
     *   });
     * }
     * ```
     */

    /**
     * Placeholder: Send confirmed drafts
     * 
     * Future implementation:
     * ```
     * async sendDraft(draftId: string, confirmedBy: string): Promise<void> {
     *   const draft = await this.getDraftById(draftId);
     *   await botService.sendMessage(draft.phone, draft.messageText);
     *   await this.markDraftAsSent(draftId, confirmedBy);
     * }
     * ```
     */
}

export default AutomationService;
