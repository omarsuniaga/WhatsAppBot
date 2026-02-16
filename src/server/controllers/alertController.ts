/**
 * Alert Controller - Handles API routes for pending alerts
 */
import { Request, Response } from 'express';
import Logger from '../services/loggerService';
import { BotOrchestrator } from '../../agents/BotOrchestrator';
import BotService from '../services/botService';
import MessageQueueService from '../services/messageQueueService';
import { getErrorMessage } from '../utils/errorUtils';

/**
 * Get all pending alerts
 */
export const getAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const alertService = orchestrator.getAlertService();

        const status = req.query.status as string;

        let alerts;
        if (status === 'pending') {
            alerts = alertService.getActiveAlerts();
        } else {
            const limit = parseInt(req.query.limit as string) || 100;
            alerts = alertService.getAllAlerts(limit);
        }

        res.json({
            success: true,
            data: alerts,
            stats: alertService.getStats()
        });
    } catch (error: unknown) {
        Logger.error('Error getting alerts:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * Get single alert by ID
 */
export const getAlert = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const orchestrator = BotOrchestrator.getInstance();
        const alertService = orchestrator.getAlertService();

        const alert = alertService.getAlert(id);

        if (!alert) {
            res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
            return;
        }

        res.json({
            success: true,
            data: alert
        });
    } catch (error: unknown) {
        Logger.error('Error getting alert:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * Get alerts by chat JID
 */
export const getAlertsByChat = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const orchestrator = BotOrchestrator.getInstance();
        const alertService = orchestrator.getAlertService();

        const alerts = alertService.getAlertsByChat(decodeURIComponent(jid));

        res.json({
            success: true,
            data: alerts
        });
    } catch (error: unknown) {
        Logger.error('Error getting alerts by chat:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * Respond to an alert
 */
export const respondToAlert = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const {
            response,
            shouldLearn = true,
            respondedBy = 'admin',
            deliveryMode = 'now',
            scheduledFor
        } = req.body;

        if (!['now', 'scheduled', 'manual'].includes(deliveryMode)) {
            res.status(400).json({
                success: false,
                error: 'deliveryMode must be one of: now, scheduled, manual'
            });
            return;
        }

        if (!response || !response.trim()) {
            res.status(400).json({
                success: false,
                error: 'Response is required'
            });
            return;
        }

        const orchestrator = BotOrchestrator.getInstance();
        const alertService = orchestrator.getAlertService();

        // Get the alert first
        const alert = alertService.getAlert(id);
        if (!alert) {
            res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
            return;
        }

        // Respond to the alert and optionally learn
        const result = await orchestrator.respondToAlert(id, response.trim(), shouldLearn, respondedBy);

        if (!result.success) {
            res.status(500).json({
                success: false,
                error: 'Failed to respond to alert'
            });
            return;
        }

        let messageSent = false;
        let scheduled = false;
        let queueMessageId: string | null = null;

        // Deliver the response according to selected mode
        try {
            if (deliveryMode === 'scheduled') {
                if (!scheduledFor) {
                    res.status(400).json({
                        success: false,
                        error: 'scheduledFor is required when deliveryMode is scheduled'
                    });
                    return;
                }

                const scheduleDate = new Date(scheduledFor);
                if (Number.isNaN(scheduleDate.getTime())) {
                    res.status(400).json({
                        success: false,
                        error: 'Invalid scheduledFor date'
                    });
                    return;
                }
                if (scheduleDate.getTime() <= Date.now()) {
                    res.status(400).json({
                        success: false,
                        error: 'scheduledFor must be in the future'
                    });
                    return;
                }

                const queueService = MessageQueueService.getInstance();
                const queued = queueService.enqueue(
                    'text',
                    alert.chatJid,
                    { message: response.trim() },
                    { scheduledFor: scheduleDate, targetType: 'individual', priority: 2 }
                );
                scheduled = true;
                queueMessageId = queued.id;
            } else if (deliveryMode === 'now') {
                const botService = BotService.getInstance();
                await botService.sendText(alert.chatJid, response.trim());
                messageSent = true;
            }

            // Emit WebSocket event
            const io = (req as any).io;
            if (io) {
                io.emit('alert:responded', {
                    alertId: id,
                    chatJid: alert.chatJid,
                    response: response.trim(),
                    learnedId: result.learnedId,
                    deliveryMode,
                    scheduledFor: scheduled ? scheduledFor : null,
                    queueMessageId
                });
            }
        } catch (sendError) {
            Logger.error('Error sending response to WhatsApp:', sendError);
            if (deliveryMode === 'now') {
                // Keep HTTP success to preserve alert state, but return explicit send status.
                messageSent = false;
            }
        }

        res.json({
            success: true,
            data: {
                alertId: id,
                learnedId: result.learnedId,
                messageSent,
                scheduled,
                queueMessageId
            }
        });
    } catch (error: unknown) {
        Logger.error('Error responding to alert:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * Dismiss an alert
 */
export const dismissAlert = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const orchestrator = BotOrchestrator.getInstance();
        const alertService = orchestrator.getAlertService();

        const alert = alertService.dismissAlert(id, reason);

        if (!alert) {
            res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
            return;
        }

        // Emit WebSocket event
        const io = (req as any).io;
        if (io) {
            io.emit('alert:dismissed', { alertId: id });
        }

        res.json({
            success: true,
            data: alert
        });
    } catch (error: unknown) {
        Logger.error('Error dismissing alert:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * Get alert statistics
 */
export const getAlertStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const alertService = orchestrator.getAlertService();

        const stats = alertService.getStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error: unknown) {
        Logger.error('Error getting alert stats:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * Get frequent unanswered questions
 */
export const getFrequentUnanswered = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const alertService = orchestrator.getAlertService();

        const similarityThreshold = parseFloat(req.query.threshold as string) || 0.7;
        const data = alertService.getFrequentUnanswered(similarityThreshold);

        res.json({
            success: true,
            data
        });
    } catch (error: unknown) {
        Logger.error('Error getting frequent unanswered:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * Export alerts to CSV
 */
export const exportAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const alertService = orchestrator.getAlertService();

        const status = req.query.status as string || 'pending';
        let alerts;

        if (status === 'all') {
            alerts = alertService.getAllAlerts(10000); // High limit for export
        } else if (status === 'pending') {
            alerts = alertService.getActiveAlerts();
        } else {
            alerts = alertService.getAllAlerts(10000).filter(a => a.status === status);
        }

        // Generate CSV manually
        const headers = ['ID', 'Fecha', 'TelÃ©fono', 'Nombre', 'Mensaje Original', 'Intent', 'Confianza', 'Prioridad', 'Estado', 'Respuesta', 'Respondido Por'];

        let csvContent = headers.join(',') + '\n';

        alerts.forEach(alert => {
            const row = [
                alert.id,
                `"${new Date(alert.createdAt).toLocaleString()}"`,
                alert.customerPhone,
                `"${alert.customerName.replace(/"/g, '""')}"`, // Escape quotes
                `"${alert.originalMessage.replace(/"/g, '""').replace(/\n/g, ' ')}"`, // Escape quotes and remove newlines
                alert.geminiAnalysis?.intent || 'unknown',
                (alert.geminiAnalysis?.confidence || 0).toFixed(2),
                alert.priority,
                alert.status,
                `"${(alert.userResponse || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
                alert.respondedBy || ''
            ];
            csvContent += row.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=alerts_export_${new Date().toISOString().slice(0, 10)}.csv`);
        res.status(200).send(csvContent);

    } catch (error: unknown) {
        Logger.error('Error exporting alerts:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

