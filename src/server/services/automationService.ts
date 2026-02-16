import { AttendanceRepository } from '../persistence/AttendanceRepository';
import { StudentsRepository } from '../persistence/StudentsRepository';
import { ContactsRepository } from '../persistence/ContactsRepository';
import { TemplatesRepository } from '../persistence/TemplatesRepository';
import BotService from './botService';
import Logger from './loggerService';
import { AttendanceStatus } from '../types/entities';
import { getErrorMessage } from '../utils/errorUtils';

export interface AbsenceDraftRequest {
    days: number;
    threshold: number;
    templateId?: string;
    includeStudentsWithoutContacts?: boolean;
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
    templateId?: string;
}

export interface AbsenceDraftResult {
    success: boolean;
    drafts: AbsenceDraft[];
    summary: {
        studentsAnalyzed: number;
        studentsAboveThreshold: number;
        draftsGenerated: number;
    };
    errors: string[];
}

export class AutomationService {
    private static instance: AutomationService;
    private attendanceRepo: AttendanceRepository;
    private studentsRepo: StudentsRepository;
    private contactsRepo: ContactsRepository;
    private templatesRepo: TemplatesRepository;
    private botService: BotService;

    private constructor() {
        this.attendanceRepo = AttendanceRepository.getInstance();
        this.studentsRepo = StudentsRepository.getInstance();
        this.contactsRepo = ContactsRepository.getInstance();
        this.templatesRepo = TemplatesRepository.getInstance();
        this.botService = BotService.getInstance();
    }

    static getInstance(): AutomationService {
        if (!AutomationService.instance) {
            AutomationService.instance = new AutomationService();
        }
        return AutomationService.instance;
    }

    /**
     * Generate drafts for students with excessive absences
     */
    async generateAbsenceDrafts(request: AbsenceDraftRequest): Promise<AbsenceDraftResult> {
        const { days, threshold, templateId } = request;
        const errors: string[] = [];
        const drafts: AbsenceDraft[] = [];

        try {
            // 1. Determine Date Range
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - days);

            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];

            // 2. Fetch all attendance records in range
            const records = await this.attendanceRepo.getAllRecordsInRange(startStr, endStr);

            // 3. Group absences by student
            const studentAbsences = new Map<string, { count: number; dates: string[] }>();

            for (const record of records) {
                if (record.status === 'absent') {
                    const current = studentAbsences.get(record.studentId) || { count: 0, dates: [] };
                    current.count++;
                    if (!current.dates.includes(record.date)) {
                        current.dates.push(record.date);
                    }
                    studentAbsences.set(record.studentId, current);
                }
            }

            // 4. Identify students above threshold
            const studentsToAlert: string[] = [];
            studentAbsences.forEach((data, studentId) => {
                if (data.count >= threshold) {
                    studentsToAlert.push(studentId);
                }
            });

            // 5. Generate Drafts
            let templateBody = "Estimado representante, {{studentName}} ha faltado {{absenceCount}} veces en los últimos días.";
            if (templateId) {
                const tmpl = await this.templatesRepo.findById(templateId);
                if (tmpl) templateBody = tmpl.body;
            }

            for (const studentId of studentsToAlert) {
                try {
                    const student = await this.studentsRepo.findById(studentId);
                    if (!student) continue;

                    if (!student.contactIds || student.contactIds.length === 0) {
                        if (request.includeStudentsWithoutContacts) {
                            errors.push(`Student ${student.firstName} ${student.lastName} has no contacts linked.`);
                        }
                        continue;
                    }

                    // Get primary contact
                    const contactId = student.contactIds[0];
                    const contact = await this.contactsRepo.findById(contactId);

                    if (!contact) continue;

                    const phone = contact.phones[0]; // Naive phone selection
                    if (!phone) continue;

                    const absenceData = studentAbsences.get(studentId)!;

                    // Render message
                    const message = templateBody
                        .replace('{{studentName}}', `${student.firstName} ${student.lastName}`)
                        .replace('{{guardianName}}', `${contact.firstName} ${contact.lastName}`)
                        .replace('{{absenceCount}}', absenceData.count.toString())
                        .replace('{{days}}', days.toString())
                        .replace('{{absenceDates}}', absenceData.dates.join(', '));

                    drafts.push({
                        contactId: contact.id,
                        contactName: `${contact.firstName} ${contact.lastName}`,
                        phone,
                        studentId: student.id,
                        studentName: `${student.firstName} ${student.lastName}`,
                        absenceCount: absenceData.count,
                        absenceDates: absenceData.dates,
                        messageText: message,
                        templateId
                    });

                } catch (err: any) {
                    errors.push(`Error processing student ${studentId}: ${err.message}`);
                    Logger.error(`Error processing student ${studentId}:`, err);
                }
            }

            return {
                success: true,
                drafts,
                summary: {
                    studentsAnalyzed: studentAbsences.size,
                    studentsAboveThreshold: studentsToAlert.length,
                    draftsGenerated: drafts.length
                },
                errors
            };

        } catch (error: unknown) {
            Logger.error('Error in generateAbsenceDrafts:', error);
            return {
                success: false,
                drafts: [],
                summary: { studentsAnalyzed: 0, studentsAboveThreshold: 0, draftsGenerated: 0 },
                errors: [getErrorMessage(error)]
            };
        }
    }

    /**
     * Get available absence templates
     */
    async getAbsenceTemplates() {
        return this.templatesRepo.findByCategory('attendance');
    }

    /**
     * Preview a draft for a single student
     */
    async previewDraft(studentId: string, contactId: string, templateId: string): Promise<AbsenceDraft | null> {
        // Simplify preview logic for now, similar to generate but for single person
        try {
            const student = await this.studentsRepo.findById(studentId);
            const contact = await this.contactsRepo.findById(contactId);
            const template = await this.templatesRepo.findById(templateId);

            if (!student || !contact || !template) return null;

            const message = template.body
                .replace('{{studentName}}', `${student.firstName} ${student.lastName}`)
                .replace('{{guardianName}}', `${contact.firstName} ${contact.lastName}`)
                .replace('{{absenceCount}}', 'X') // Placeholder
                .replace('{{days}}', 'Y');      // Placeholder

            return {
                contactId: contact.id,
                contactName: `${contact.firstName} ${contact.lastName}`,
                phone: contact.phones[0] || '',
                studentId: student.id,
                studentName: `${student.firstName} ${student.lastName}`,
                absenceCount: 0,
                absenceDates: [],
                messageText: message,
                templateId
            };
        } catch (e) {
            Logger.error('Error previewing draft', e);
            return null;
        }
    }
}
// ----------------------------------------
// EXPORTED OBJECTS FOR CONTROLLERS
// ----------------------------------------

export const whatsAppAlertService = {
    async sendAbsenceAlert(phone: string, studentName: string, className: string, date: string, consecutiveDays: number) {
        Logger.info(`[WhatsApp Alert] Sending absence alert to ${phone} for ${studentName}. Consecutive: ${consecutiveDays}`);

        try {
            const bot = BotService.getInstance();
            // In a real scenario you might want to fetch a template or construct a localized message
            const message = `⚠️ Alerta de Asistencia: ${studentName} ha faltado a ${className} por ${consecutiveDays} días consecutivos (última falta: ${date}).`;
            await bot.sendText(`${phone}@s.whatsapp.net`, message);
            return true;
        } catch (error) {
            Logger.error('Failed to send absence alert via BotService', error);
            return false;
        }
    },
    async sendAttendanceCompletedAlert(phone: string, className: string, date: string, stats: any) {
        const percentage = Math.round((stats.presentes / stats.totalExpected) * 100);
        Logger.info(`[WhatsApp Alert] Class ${className} attendance completed. ${percentage}% present.`);

        try {
            const bot = BotService.getInstance();
            const message = `✅ Asistencia completada para ${className} el ${date}. Asistencia: ${percentage}%.`;
            await bot.sendText(`${phone}@s.whatsapp.net`, message);
            return true;
        } catch (error) {
            Logger.error('Failed to send attendance completed alert', error);
            return false;
        }
    }
};

export const onAbsenceCreated = {
    async handler(absenceId: string) {
        Logger.info(`[onAbsenceCreated] Processing absence: ${absenceId}`, { absenceId });

        // Use real repository instead of mocks
        // Assuming we can get the absence record to find the student
        // For demonstration, we'll assume we can look up the student via a hypothetical service or repo
        // Since we don't have a direct AbsenceRepository method exposed here cleanly for valid lookups in this snippet context:

        // Logic:
        // 1. Get absences for student
        // 2. Detect consecutive
        // 3. Alert

        Logger.info(`[onAbsenceCreated] Completed processing`);
    },

    detectConsecutiveAbsences(absences: { fecha: string }[]) {
        if (!absences || absences.length === 0) return 0;

        // Sort descending
        const sorted = [...absences].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        if (sorted.length === 1) return 1;

        let streak = 1;
        // Iterate and check if previous day
        for (let i = 0; i < sorted.length - 1; i++) {
            const current = new Date(sorted[i].fecha);
            const previous = new Date(sorted[i + 1].fecha);

            // Normalize to start of day to avoid time diff issues
            current.setHours(0, 0, 0, 0);
            previous.setHours(0, 0, 0, 0);

            const diffTime = current.getTime() - previous.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                streak++;
            } else if (diffDays > 1) {
                // Break streak on gap
                break;
            }
            // If diffDays === 0 (same day), implies multiple records, ignore and continue
        }
        return streak;
    }
};

export const onAttendanceCompleted = {
    async handler(classId: string, date: string, teacherId: string) {
        Logger.info(`[onAttendanceCompleted] Processing: ${classId} on ${date}`);
        try {
            // Dynamic import to avoid circular dependencies if analyticsService imports automation
            const { attendanceAnalytics } = await import('./analyticsService');
            const stats = await attendanceAnalytics.analyzeClassAttendance(classId, date);

            if (stats.porcentajeAsistencia < 70) {
                Logger.warn(`[WARNING] Low attendance for class ${classId}: ${stats.porcentajeAsistencia}%`);
            }

            // Notify teacher if phone is available
            // This would require fetching teacher profile and phone
        } catch (error) {
            Logger.error('Error in onAttendanceCompleted handler', error);
        }
    }
};

export const scheduledAutomation = {
    async checkPendingJustifications() {
        Logger.info('[Scheduled] Checking pending justifications');
        // Implementation would go here
    },
    async generateWeeklyReport() {
        Logger.info('[Scheduled] Generating weekly attendance report');
        // Implementation would go here
    }
};

export default AutomationService;
