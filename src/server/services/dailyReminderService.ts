import { AIService } from './aiService';
import { classService, teacherService, automationConfigService } from './dataService';
import BotService from './botService';
import { BotOrchestrator } from '../../agents/BotOrchestrator';
import { ClassData } from '../types';
import Logger from './loggerService';
import { BroadcastService } from './broadcastService';
import { db } from '../config/firebaseAdmin';
import MessageQueueService from './messageQueueService';
import { getErrorMessage } from '../utils/errorUtils';

export interface ReminderTemplate {
    id?: string;
    name: string;
    content: string;
    category: string; // 'Lunes','Martes',...,'General','Especial'
    createdAt: string;
    updatedAt: string;
}

export interface DailyReminderConfig {
    id?: string;
    enabled: boolean;
    scheduleTime: string; // HH:mm (24h)
    targetGroups: string[]; // Group names to search for
    autoSend: boolean; // Mixed (false) vs Auto (true)
    lastRunAt?: string;
}

export interface ExecuteDailyReminderOptions {
    force?: boolean;
    dryRun?: boolean;
    now?: Date;
}

const DEFAULT_CONFIG: DailyReminderConfig = {
    enabled: true,
    scheduleTime: '12:01',
    targetGroups: [
        'PROGRAMA ORQUESTAL - El Sistema Punta Cana',
        'PROGRAMA CORAL'
    ],
    autoSend: true
};

export class DailyReminderService {
    private static instance: DailyReminderService;
    private botService: BotService;
    private broadcastService: BroadcastService;

    private constructor() {
        Logger.info('DailyReminderService: Initialized (Version: Multi-Model Resilience Active)');
        this.botService = BotService.getInstance();
        this.broadcastService = BroadcastService.getInstance();
    }

    public static getInstance(): DailyReminderService {
        if (!DailyReminderService.instance) {
            DailyReminderService.instance = new DailyReminderService();
        }
        return DailyReminderService.instance;
    }

    /**
     * Get current configuration
     */
    public async getConfig(): Promise<DailyReminderConfig> {
        const config = await automationConfigService.getConfig('dailyReminder');
        return config || DEFAULT_CONFIG;
    }

    /**
     * Update configuration
     */
    public async updateConfig(updates: Partial<DailyReminderConfig>): Promise<void> {
        await automationConfigService.updateConfig('dailyReminder', updates);
    }

    /**
     * Main entry point: Execute the daily reminder process
     */
    public async executeDailyReminder(
        optionsOrForce: ExecuteDailyReminderOptions | boolean = {}
    ): Promise<{ success: boolean; message?: string; draftId?: string }> {
        try {
            const options: ExecuteDailyReminderOptions = typeof optionsOrForce === 'boolean'
                ? { force: optionsOrForce }
                : optionsOrForce;
            const force = options.force === true;
            const dryRun = options.dryRun === true;
            const now = options.now || new Date();

            Logger.info('Starting daily reminder execution...');
            const config = await this.getConfig();

            if (!config.enabled && !force) {
                Logger.info('DailyReminder: Service disabled. Skipping.');
                return { success: false, message: 'Service disabled' };
            }

            // 2. Fetch Classes for Today
            const today = now;
            const classes = await this.getClassesForDay(today);

            if (classes.length === 0) {
                Logger.info('DailyReminder: No classes found for today. Creating test message.');
                // Create a test message for demonstration purposes
                const testMessage = this.generateTestMessage(today);
                if (config.autoSend && !dryRun) {
                    const report = await this.sendToTargetGroups(testMessage, config.targetGroups);
                    return { success: true, message: `Test message sent to ${report.sent} groups. (No classes today)` };
                } else {
                    // Draft Mode
                    const jids = await this.resolveTargetJids(config.targetGroups);
                    const campaign = this.broadcastService.createCampaign({
                        name: `RECORDATORIO DIARIO - ${today.toLocaleDateString('es-ES')} (PRUEBA)`,
                        description: 'Mensaje de prueba - No hay clases programadas para hoy.',
                        message: testMessage,
                        targetLists: [],
                        targetContacts: jids,
                        personalizeMessage: false
                    });

                    Logger.info(`DailyReminder: Test draft campaign created: ${campaign.id}`);
                    return { success: true, message: 'Test draft created for approval (no classes today)', draftId: campaign.id };
                }
            }

            // 3. Prepare Data for AI
            const scheduleContext = await this.prepareScheduleContext(classes, today);

            // 4. Generate Message
            // AIService handles keys internally
            let message = await this.generateMessageWithAI(scheduleContext);
            
            // Fallback to non-AI message if AI fails
            if (!message) {
                Logger.warn('DailyReminder: AI generation failed, using fallback message.');
                message = this.generateFallbackMessage(classes, today);
            }

            // Update last run time
            if (!dryRun) {
                await this.updateConfig({ lastRunAt: new Date().toISOString() });
            }

            // 5. Send or Draft
            if (config.autoSend && !dryRun) {
                const report = await this.sendToTargetGroups(message, config.targetGroups);
                return { success: true, message: `Sent to ${report.sent} groups. Failed: ${report.failed}` };
            } else {
                // Draft Mode: Create a Broadcast Campaign as Draft
                const jids = await this.resolveTargetJids(config.targetGroups);
                const campaign = this.broadcastService.createCampaign({
                    name: `Recordatorio Diario - ${today.toLocaleDateString('es-ES')}`,
                    description: 'Generado automáticamente por IA. Pendiente de aprobación.',
                    message: message,
                    targetLists: [],
                    targetContacts: jids,
                    personalizeMessage: false
                });

                Logger.info(`DailyReminder: Draft campaign created: ${campaign.id}`);
                return { success: true, message: 'Draft created for approval', draftId: campaign.id };
            }

        } catch (error: unknown) {
            Logger.error(`DailyReminder Error: ${getErrorMessage(error)}`);
            return { success: false, message: getErrorMessage(error) };
        }
    }

    /**
     * Get classes for a specific date
     */
    private async getClassesForDay(date: Date): Promise<ClassData[]> {
        const allClasses = await classService.getAllClasses();
        const dayIndex = date.getDay();
        const dayName = this.getDayName(dayIndex); // 'lun', 'mar', etc.
        const fullDayName = this.getDayNameFull(dayIndex); // 'Lunes', 'Martes', etc.

        // Filter classes that have a slot on this day
        return allClasses.filter(clase => {
            // Check schedule slots (new format)
            if (clase.schedule?.slots) {
                return clase.schedule.slots.some(slot =>
                    slot.day.toLowerCase().startsWith(dayName) ||
                    slot.day.toLowerCase() === fullDayName.toLowerCase()
                );
            }

            // Allow legacy fields too
            const legacyDay = (clase as any).dia || (clase as any).dias?.[0] || '';
            if (legacyDay) {
                return legacyDay.toLowerCase().startsWith(dayName);
            }

            return false;
        });
    }

    /**
     * Format schedule data for the AI prompt
     */
    private async prepareScheduleContext(classes: ClassData[], date: Date): Promise<string> {
        const dayIndex = date.getDay();
        const dayName = this.getDayName(dayIndex);
        const fullDayName = this.getDayNameFull(dayIndex);

        const teachers = await teacherService.getAllTeachers();

        let context = `FECHA: ${fullDayName} ${date.getDate()} de ${date.toLocaleString('es-ES', { month: 'long' })}\n\n`;
        context += `CLASES PROGRAMADAS:\n`;

        for (const cls of classes) {
            let timeStr = 'Hora no definida';
            if (cls.schedule?.slots) {
                const slot = cls.schedule.slots.find(s =>
                    s.day.toLowerCase().startsWith(dayName) ||
                    s.day.toLowerCase() === fullDayName.toLowerCase()
                );
                if (slot) timeStr = `${slot.startTime} - ${slot.endTime}`;
            }

            let teacherName = cls.maestroNombre || 'Por asignar';
            if (cls.teacherId) {
                const t = teachers.find(tea => tea.id === cls.teacherId || tea.uid === cls.teacherId);
                if (t) teacherName = t.nombre;
            }

            context += `- ${cls.nombre} (${cls.instrumento || 'General'})\n`;
            context += `  Horario: ${timeStr}\n`;
            context += `  Profesor: ${teacherName}\n`;
            context += `  Salón: ${cls.salón || 'Por asignar'}\n`;
            if (cls.grupo) context += `  Programa/Grupo: ${cls.grupo}\n`;
            context += `\n`;
        }

        return context;
    }

    /**
     * Generate the WhatsApp message using AI Service (Gemini/Groq)
     */
    private async generateMessageWithAI(context: string): Promise<string | null> {
        try {
            const prompt = `Genera un mensaje de WhatsApp para "El Sistema Punta Cana" recordando las clases de hoy.

${context}

REGLAS:
- Emojis musicales (🎻🎺🎶)
- Encabezado: RECORDATORIO GENERAL + fecha
- Agrupa por programa/instrumento
- Incluye: clase, horario, salón, profesor
- Tono formal pero cercano
- NO inventes datos
- Mensaje motivador corto al final
- Solo texto del mensaje, nada más`;

            const aiService = AIService.getInstance();
            // System prompt for Groq/OpenAI models to enforce behavior
            const systemPrompt = "Eres un asistente administrativo útil para una academia de música. Generas mensajes claros y profesionales para WhatsApp.";

            const response = await aiService.generateText(prompt, {
                maxTokens: 800,
                temperature: 0.7,
                systemPrompt
            });

            if (response && response.text) {
                Logger.info(`DailyReminder: Successfully generated message using ${response.provider} (${response.model})`);
                return response.text;
            }

            return null;
        } catch (error: unknown) {
            Logger.error('DailyReminder AI generation error:', error);
            // Error is already logged by AIService, but we catch here to return null securely
            return null;
        }
    }

    /**
     * Generate a fallback message without AI (for when AI fails)
     */
    private generateFallbackMessage(classes: ClassData[], date: Date): string {
        const dayName = date.toLocaleDateString('es-DO', { weekday: 'long' });
        const formattedDate = date.toLocaleDateString('es-DO', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });

        let message = `🎻 *RECORDATORIO GENERAL - El Sistema Punta Cana*

📅 ${dayName} ${formattedDate}

🎵 *Clases del Día:*\n`;

        if (classes.length === 0) {
            message += "No hay clases programadas para hoy.\n\n";
        } else {
            classes.forEach(cls => {
                message += `• ${cls.nombre} - ${cls.instrumento || 'General'}\n`;
            });
            message += "\n";
        }

        message += `📚 *Recordatorios Importantes:*
• Llegar 10 minutos antes de cada clase
• Traer sus instrumentos y materiales
• Practicar en casa diariamente

💪 *Motivación:*
"La música es el lenguaje universal del espíritu. ¡Sigue adelante!"

🎶 *El Sistema Punta Cana - Transformando vidas a través de la música*

---
*Este es un mensaje automático. Para consultas, contactar a la administración.*`;

        return message;
    }

    /**
     * Resolve group names to JIDs
     */
    private async resolveTargetJids(targetNames: string[]): Promise<string[]> {
        const groups = await this.botService.getWhatsAppGroups();
        const jids: string[] = [];

        for (const name of targetNames) {
            const group = groups.find(g =>
                g.subject.toLowerCase().includes(name.toLowerCase())
            );
            if (group) jids.push(group.id);
        }

        return jids;
    }

    /**
     * Send the message to configured groups (Auto Mode)
     */
    private async sendToTargetGroups(message: string, targetNames: string[]): Promise<{ sent: number; failed: number }> {
        const groups = await this.botService.getWhatsAppGroups();
        let sentCount = 0;
        let failedCount = 0;

        for (const targetName of targetNames) {
            const group = groups.find(g =>
                g.subject.toLowerCase().includes(targetName.toLowerCase())
            );

            if (group) {
                Logger.info(`DailyReminder: Sending to group "${group.subject}" (${group.id})`);
                try {
                    await this.botService.sendText(group.id, message);
                    sentCount++;
                } catch (err) {
                    Logger.error(`DailyReminder: Failed to send to ${group.subject}`, err);
                    failedCount++;
                }
            } else {
                Logger.warn(`DailyReminder: Target group "${targetName}" not found.`);
            }
        }

        return { sent: sentCount, failed: failedCount };
    }

    /**
     * Check WhatsApp connection status
     */
    public async getWhatsAppConnectionStatus(): Promise<{
        connected: boolean;
        qrCode?: string;
        groupsCount?: number;
        lastUpdate?: string;
    }> {
        try {
            const status = this.botService.getConnectionStatus();
            const groups = await this.botService.getWhatsAppGroups();
            
            return {
                connected: status === 'connected',
                qrCode: this.botService.getCurrentQR() || undefined,
                groupsCount: groups.length,
                lastUpdate: new Date().toISOString()
            };
        } catch (error: unknown) {
            Logger.error('DailyReminder: Error checking WhatsApp connection:', error);
            return {
                connected: false,
                lastUpdate: new Date().toISOString()
            };
        }
    }

    /**
     * Get WhatsApp groups from current session
     */
    public async getWhatsAppGroups(): Promise<any[]> {
        try {
            const groups = await this.botService.getWhatsAppGroups();
            return groups.map(group => ({
                id: group.id,
                name: group.subject || group.name || group.id,
                subject: group.subject,
                description: group.desc,
                participantCount: group.participants?.length || 0,
                isGroup: true,
                type: 'group'
            }));
        } catch (error: unknown) {
            Logger.error('DailyReminder: Error getting WhatsApp groups:', error);
            return [];
        }
    }

    /**
     * Search for groups or contacts by query (for the admin UI)
     */
    public async searchContacts(query: string): Promise<any[]> {
        let groups: any[] = [];
        let contacts: any[] = [];

        try {
            groups = await this.botService.getWhatsAppGroups();
        } catch (err) {
            Logger.warn('DailyReminder searchContacts: Could not fetch groups');
        }

        try {
            contacts = await this.botService.getContactsFromSession();
        } catch (err) {
            Logger.warn('DailyReminder searchContacts: Could not fetch session contacts');
        }

        const results = [
            ...groups.map(g => ({
                id: g.id || '',
                name: g.subject || g.name || g.id || 'Grupo sin nombre',
                type: 'group',
                displayId: g.id || ''
            })),
            ...contacts
                .filter(c => c.jid || c.id) // Only include contacts with a valid identifier
                .map(c => {
                    // getContactsFromSession returns { jid, name, isGroup }
                    const contactId = c.jid || c.id || '';
                    const number = contactId.includes('@') ? contactId.split('@')[0] : contactId;
                    return {
                        id: contactId,
                        name: c.name || number || 'Contacto',
                        type: 'individual',
                        displayId: number
                    };
                })
        ];

        const safeQuery = (query || '').toLowerCase();
        return results.filter(r =>
            (r.name?.toLowerCase() || '').includes(safeQuery) ||
            (r.id?.toLowerCase() || '').includes(safeQuery) ||
            (r.displayId?.toLowerCase() || '').includes(safeQuery)
        ).slice(0, 20);
    }

    // Helpers
    private getGeminiApiKey(): string {
        const orchestrator = BotOrchestrator.getInstance();
        return orchestrator.getConfig().geminiApiKey || process.env.GEMINI_API_KEY || '';
    }

    private getDayName(dayIndex: number): string {
        const days = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
        return days[dayIndex];
    }

    private getDayNameFull(dayIndex: number): string {
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return days[dayIndex];
    }

    /**
     * Start the daily scheduler
     */
    public async startScheduler(): Promise<void> {
        try {
            const cron = await import('node-cron');
            // Check every minute if it's the right time
            // Why not fixed cron? To allow dynamic time changes from config
            cron.schedule('* * * * *', async () => {
                const config = await this.getConfig();
                if (!config.enabled) return;

                const now = new Date();
                const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

                if (currentTime === config.scheduleTime) {
                    Logger.info(`DailyReminder: Scheduled time reached (${config.scheduleTime}). Triggering...`);
                    this.executeDailyReminder();
                }
            });
            Logger.info('DailyReminder: Scheduler started (Polling every minute for dynamic schedule)');
        } catch (error) {
            Logger.warn('DailyReminder: node-cron not available, scheduler not started.');
        }
    }

    /**
     * Generate a test message when no classes are available
     */
    private generateTestMessage(date: Date): string {
        const dayName = date.toLocaleDateString('es-DO', { weekday: 'long' });
        const formattedDate = date.toLocaleDateString('es-DO', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });

        return `🎻 *RECORDATORIO GENERAL - El Sistema Punta Cana*

📅 ${dayName} ${formattedDate}

🎵 *Clases del Día:*
No hay clases programadas para hoy.

📚 *Recordatorio General:*
• Seguir practicando los instrumentos en casa
• Revisar las partituras para la próxima clase
• Mantener el entusiasmo y la disciplina

💪 *Motivación:*
"La práctica constante es la clave del éxito musical. ¡Sigue adelante!"

🎶 *El Sistema Punta Cana - Transformando vidas a través de la música*

---
*Este es un mensaje automático de prueba. Para consultas, contactar a la administración.*`;
    }

    /**
     * Generate only the message text (Manual Mode / Preview)
     */
    public async generateDraftMessage(): Promise<{ success: boolean; message?: string; draftMessage?: string }> {
        try {
            Logger.info('Generating daily reminder draft message...');

            // AIService checks keys internally, so we don't need to check here manually
            // unless we want to fail fast. But let's trust AIService logger.

            const today = new Date();
            const classes = await this.getClassesForDay(today);

            if (classes.length === 0) {
                const testMessage = this.generateTestMessage(today);
                return { success: true, draftMessage: testMessage };
            }

            const scheduleContext = await this.prepareScheduleContext(classes, today);
            let message = await this.generateMessageWithAI(scheduleContext);

            // Fallback to non-AI message if AI fails
            if (!message) {
                Logger.warn('DailyReminder: AI generation failed, using fallback message.');
                message = this.generateFallbackMessage(classes, today);
            }

            return { success: true, draftMessage: message };
        } catch (error: unknown) {
            Logger.error(`DailyReminder Draft Error: ${getErrorMessage(error)}`);
            return { success: false, message: getErrorMessage(error) };
        }
    }

    // ==========================================
    // TEMPLATES CRUD
    // ==========================================

    private readonly TEMPLATES_COLLECTION = 'REMINDER_TEMPLATES';

    /**
     * Get all templates, optionally filtered by category
     */
    public async getTemplates(category?: string): Promise<ReminderTemplate[]> {
        try {
            let query: FirebaseFirestore.Query = db.collection(this.TEMPLATES_COLLECTION);
            if (category) {
                query = query.where('category', '==', category);
            }
            query = query.orderBy('updatedAt', 'desc');

            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ReminderTemplate[];
        } catch (error: unknown) {
            Logger.error(`DailyReminder: Error getting templates: ${getErrorMessage(error)}`);
            return [];
        }
    }

    /**
     * Save a new template or update existing
     */
    public async saveTemplate(data: { name: string; content: string; category: string; id?: string }): Promise<string> {
        const now = new Date().toISOString();

        if (data.id) {
            // Update existing
            await db.collection(this.TEMPLATES_COLLECTION).doc(data.id).update({
                name: data.name,
                content: data.content,
                category: data.category,
                updatedAt: now
            });
            Logger.info(`DailyReminder: Template updated: ${data.id}`);
            return data.id;
        } else {
            // Create new
            const docRef = await db.collection(this.TEMPLATES_COLLECTION).add({
                name: data.name,
                content: data.content,
                category: data.category,
                createdAt: now,
                updatedAt: now
            });
            Logger.info(`DailyReminder: Template created: ${docRef.id}`);
            return docRef.id;
        }
    }

    /**
     * Delete a template by ID
     */
    public async deleteTemplate(id: string): Promise<void> {
        await db.collection(this.TEMPLATES_COLLECTION).doc(id).delete();
        Logger.info(`DailyReminder: Template deleted: ${id}`);
    }

    // ==========================================
    // SCHEDULE MESSAGE
    // ==========================================

    /**
     * Schedule a message for future delivery via MessageQueue
     */
    public async scheduleMessage(jid: string, message: string, scheduledFor: string): Promise<string> {
        const queueService = MessageQueueService.getInstance();
        const queueMsg = queueService.enqueue('text', jid, { text: message }, {
            scheduledFor: new Date(scheduledFor)
        });
        Logger.info(`DailyReminder: Message scheduled for ${scheduledFor} to ${jid} (queue ID: ${queueMsg.id})`);
        return queueMsg.id;
    }
}
