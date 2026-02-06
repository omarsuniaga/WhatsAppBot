/**
 * Alert Controller - Handles API routes for pending alerts
 */
import { Request, Response } from 'express';
import { BotOrchestrator } from '../../agents/BotOrchestrator';
import BotService from '../services/botService';

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
    } catch (error: any) {
        console.error('Error getting alerts:', error);
        res.status(500).json({
            success: false,
            error: error.message
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
    } catch (error: any) {
        console.error('Error getting alert:', error);
        res.status(500).json({
            success: false,
            error: error.message
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
    } catch (error: any) {
        console.error('Error getting alerts by chat:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Respond to an alert
 */
export const respondToAlert = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { response, shouldLearn = true, respondedBy = 'admin' } = req.body;

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

        // Send the response to the customer via WhatsApp
        try {
            const botService = BotService.getInstance();
            await botService.sendText(alert.chatJid, response.trim());

            // Emit WebSocket event
            const io = (req as any).io;
            if (io) {
                io.emit('alert:responded', {
                    alertId: id,
                    chatJid: alert.chatJid,
                    response: response.trim(),
                    learnedId: result.learnedId
                });
            }
        } catch (sendError) {
            console.error('Error sending response to WhatsApp:', sendError);
            // Don't fail the request, the alert was still processed
        }

        res.json({
            success: true,
            data: {
                alertId: id,
                learnedId: result.learnedId,
                messageSent: true
            }
        });
    } catch (error: any) {
        console.error('Error responding to alert:', error);
        res.status(500).json({
            success: false,
            error: error.message
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
    } catch (error: any) {
        console.error('Error dismissing alert:', error);
        res.status(500).json({
            success: false,
            error: error.message
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
    } catch (error: any) {
        console.error('Error getting alert stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
