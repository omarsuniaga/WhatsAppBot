import { Request, Response } from 'express';
import { DailyReminderService } from '../services/dailyReminderService';
import { AttendanceMessageTemplateService, type AttendanceMessageAction } from '../services/attendanceMessageTemplateService';
import Logger from '../services/loggerService';
import { ApiResponse } from '../types';

const dailyReminderService = DailyReminderService.getInstance();
const attendanceMessageTemplateService = AttendanceMessageTemplateService.getInstance();

const WHATSAPP_JID_REGEX = /^\d+@(s\.whatsapp\.net|g\.us)$/;
const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

type ReminderConfigUpdate = {
    enabled?: boolean;
    scheduleTime?: string;
    targetGroups?: string[];
    autoSend?: boolean;
};

const ATTENDANCE_MESSAGE_ACTIONS: AttendanceMessageAction[] = [
    'teacher_reminder',
    'parent_absence_alert'
];

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
}

function isValidIsoDate(value: string): boolean {
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
}

function normalizeConfigPayload(payload: any): { updates?: ReminderConfigUpdate; error?: string } {
    if (!payload || typeof payload !== 'object') {
        return { error: 'Invalid payload' };
    }

    const updates: ReminderConfigUpdate = {};

    if (payload.enabled !== undefined) {
        if (typeof payload.enabled !== 'boolean') return { error: 'enabled must be boolean' };
        updates.enabled = payload.enabled;
    }

    if (payload.scheduleTime !== undefined) {
        if (typeof payload.scheduleTime !== 'string' || !TIME_24H_REGEX.test(payload.scheduleTime)) {
            return { error: 'scheduleTime must use HH:mm (24h)' };
        }
        updates.scheduleTime = payload.scheduleTime;
    }

    if (payload.targetGroups !== undefined) {
        if (!Array.isArray(payload.targetGroups) || payload.targetGroups.some((g: unknown) => typeof g !== 'string' || !g.trim())) {
            return { error: 'targetGroups must be a non-empty string array' };
        }
        updates.targetGroups = payload.targetGroups.map((g: string) => g.trim());
    }

    if (payload.autoSend !== undefined) {
        if (typeof payload.autoSend !== 'boolean') return { error: 'autoSend must be boolean' };
        updates.autoSend = payload.autoSend;
    }

    if (Object.keys(updates).length === 0) {
        return { error: 'No valid fields provided' };
    }

    return { updates };
}

function isValidAttendanceMessageAction(value: unknown): value is AttendanceMessageAction {
    return typeof value === 'string' && ATTENDANCE_MESSAGE_ACTIONS.includes(value as AttendanceMessageAction);
}

function resolveUpdatedBy(req: Request): string {
    const headerUser = req.headers['x-user-email'] || req.headers['x-user-id'];
    if (typeof headerUser === 'string' && headerUser.trim()) {
        return headerUser.trim();
    }
    return 'unknown-user';
}

/**
 * GET /api/daily-reminders/config
 */
export const getDailyReminderConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const config = await dailyReminderService.getConfig();
        res.json({ success: true, data: config } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error getting config:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * POST /api/daily-reminders/config
 */
export const updateDailyReminderConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const { updates, error } = normalizeConfigPayload(req.body);
        if (error || !updates) {
            res.status(400).json({ success: false, error: error || 'Invalid payload' } as ApiResponse);
            return;
        }

        await dailyReminderService.updateConfig(updates);
        res.json({ success: true, message: 'Configuracion actualizada correctamente' } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error updating config:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * GET /api/daily-reminders/search-contacts
 */
export const searchDailyReminderContacts = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = typeof req.query.q === 'string' ? req.query.q : '';
        const results = await dailyReminderService.searchContacts(query);
        res.json({ success: true, data: results } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error searching contacts:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * POST /api/daily-reminders/test
 */
export const testDailyReminder = async (req: Request, res: Response): Promise<void> => {
    try {
        Logger.info('[DailyReminderController] Testing daily reminder...');
        const result = await dailyReminderService.executeDailyReminder({ force: true, dryRun: true });

        res.json({
            success: result.success,
            message: result.message,
            data: {
                draftId: result.draftId,
                timestamp: new Date().toISOString()
            }
        } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error testing reminder:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * POST /api/daily-reminders/execute
 */
export const executeDailyReminder = async (req: Request, res: Response): Promise<void> => {
    try {
        const force = typeof req.body?.force === 'boolean' ? req.body.force : true;
        const result = await dailyReminderService.executeDailyReminder({ force, dryRun: false });
        res.json({ success: result.success, message: result.message, data: result } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error executing reminder:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * GET /api/daily-reminders/status
 */
export const getDailyReminderStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const config = await dailyReminderService.getConfig();
        res.json({
            success: true,
            data: {
                enabled: config.enabled,
                scheduleTime: config.scheduleTime,
                lastRunAt: config.lastRunAt,
                autoSend: config.autoSend
            }
        } as ApiResponse);
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * POST /api/daily-reminders/generate-draft
 */
export const generateDailyReminderDraft = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await dailyReminderService.generateDraftMessage();
        res.json({
            success: result.success,
            message: result.message,
            data: {
                draftMessage: result.draftMessage,
                timestamp: new Date().toISOString()
            }
        } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error generating draft:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * GET /api/daily-reminders/templates
 */
export const getTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
        const category = typeof req.query.category === 'string' ? req.query.category : undefined;
        const templates = await dailyReminderService.getTemplates(category);
        res.json({ success: true, data: templates } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error getting templates:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * POST /api/daily-reminders/templates
 */
export const saveTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, content, category, id } = req.body;
        if (!name || !content || !category) {
            res.status(400).json({ success: false, error: 'name, content, and category are required' } as ApiResponse);
            return;
        }
        const templateId = await dailyReminderService.saveTemplate({ name, content, category, id });
        res.json({ success: true, data: { id: templateId } } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error saving template:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * DELETE /api/daily-reminders/templates/:id
 */
export const deleteTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        await dailyReminderService.deleteTemplate(req.params.id);
        res.json({ success: true, message: 'Plantilla eliminada' } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error deleting template:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * GET /api/daily-reminders/whatsapp-status
 */
export const getWhatsAppStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const status = await dailyReminderService.getWhatsAppConnectionStatus();
        res.json({ success: true, data: status } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error getting WhatsApp status:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * GET /api/daily-reminders/whatsapp-groups
 */
export const getWhatsAppGroups = async (req: Request, res: Response): Promise<void> => {
    try {
        const groups = await dailyReminderService.getWhatsAppGroups();
        res.json({ success: true, data: groups } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error getting WhatsApp groups:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * POST /api/daily-reminders/schedule
 */
export const scheduleMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid, message, scheduledFor } = req.body;

        if (!jid || !message || !scheduledFor) {
            res.status(400).json({ success: false, error: 'jid, message, and scheduledFor are required' } as ApiResponse);
            return;
        }

        if (typeof jid !== 'string' || !WHATSAPP_JID_REGEX.test(jid)) {
            res.status(400).json({ success: false, error: 'jid must be a valid WhatsApp JID' } as ApiResponse);
            return;
        }

        if (typeof message !== 'string' || !message.trim()) {
            res.status(400).json({ success: false, error: 'message must be a non-empty string' } as ApiResponse);
            return;
        }

        if (typeof scheduledFor !== 'string' || !isValidIsoDate(scheduledFor)) {
            res.status(400).json({ success: false, error: 'scheduledFor must be a valid ISO date string' } as ApiResponse);
            return;
        }

        const scheduledDate = new Date(scheduledFor);
        if (scheduledDate.getTime() <= Date.now()) {
            res.status(400).json({ success: false, error: 'scheduledFor must be in the future' } as ApiResponse);
            return;
        }

        const msgId = await dailyReminderService.scheduleMessage(jid, message.trim(), scheduledFor);
        res.json({
            success: true,
            data: { messageId: msgId, scheduledFor },
            message: `Mensaje programado para ${scheduledDate.toLocaleString('es-ES')}`
        } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error scheduling message:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * GET /api/daily-reminders/attendance-message-templates
 */
export const getAttendanceMessageTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
        const templates = attendanceMessageTemplateService.getTemplates();
        res.json({ success: true, data: templates } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error getting attendance message templates:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * PUT /api/daily-reminders/attendance-message-templates/:action
 */
export const updateAttendanceMessageTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { action } = req.params;
        const { template } = req.body || {};

        if (!isValidAttendanceMessageAction(action)) {
            res.status(400).json({ success: false, error: 'Invalid action' } as ApiResponse);
            return;
        }

        if (typeof template !== 'string' || !template.trim()) {
            res.status(400).json({ success: false, error: 'template is required' } as ApiResponse);
            return;
        }

        const updatedBy = resolveUpdatedBy(req);
        const updated = attendanceMessageTemplateService.updateTemplate(action, template, updatedBy);
        res.json({ success: true, data: updated, message: 'Plantilla actualizada' } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error updating attendance message template:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * POST /api/daily-reminders/attendance-message-templates/:action/reset
 */
export const resetAttendanceMessageTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { action } = req.params;
        if (!isValidAttendanceMessageAction(action)) {
            res.status(400).json({ success: false, error: 'Invalid action' } as ApiResponse);
            return;
        }

        const updatedBy = resolveUpdatedBy(req);
        const updated = attendanceMessageTemplateService.resetTemplate(action, updatedBy);
        res.json({ success: true, data: updated, message: 'Plantilla restaurada por defecto' } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error resetting attendance message template:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};

/**
 * GET /api/daily-reminders/attendance-message-templates/history
 */
export const getAttendanceMessageTemplateHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const actionParam = typeof req.query.action === 'string' ? req.query.action : undefined;
        const limitParam = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
        const action = actionParam && isValidAttendanceMessageAction(actionParam)
            ? actionParam
            : undefined;
        const history = attendanceMessageTemplateService.getHistory(action, limitParam || 20);
        res.json({ success: true, data: history } as ApiResponse);
    } catch (error: unknown) {
        Logger.error('[DailyReminderController] Error getting attendance message template history:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) } as ApiResponse);
    }
};
