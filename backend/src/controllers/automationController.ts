/**
 * Automation Controller
 * API endpoints for attendance alert automation
 */

import { Request, Response } from 'express';
import AutomationService from '../services/AutomationService';
import EventLogService from '../services/EventLogService';
import { EventLogType } from '../domain';

/**
 * GET /api/automation/alerts/config
 * Get current alert configuration
 */
export const getAlertConfig = async (_req: Request, res: Response) => {
    try {
        const service = AutomationService.getInstance();
        const config = service.getAlertConfig();
        
        res.json({
            success: true,
            data: config
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * PUT /api/automation/alerts/config
 * Update alert configuration
 */
export const updateAlertConfig = async (req: Request, res: Response) => {
    try {
        const { enabled, absenceThreshold, daysToAnalyze, autoSend, templateId, notifyGuardians } = req.body;
        
        const service = AutomationService.getInstance();
        const updated = service.updateAlertConfig({
            enabled,
            absenceThreshold,
            daysToAnalyze,
            autoSend,
            templateId,
            notifyGuardians
        });
        
        res.json({
            success: true,
            data: updated
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * GET /api/automation/alerts/history
 * Get history of triggered alerts
 */
export const getAlertHistory = async (req: Request, res: Response) => {
    try {
        const eventLogService = EventLogService.getInstance();
        const logs = await eventLogService.getEventsByType(EventLogType.AutomationTriggered);
        
        // Filter for attendance alerts only
        const attendanceAlerts = logs.filter(log => 
            log.entityType === 'student' || 
            log.entityId === 'attendance_alert' ||
            log.entityId === 'daily_attendance_alerts'
        );
        
        res.json({
            success: true,
            data: attendanceAlerts
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * POST /api/automation/alerts/generate
 * Manually trigger absence draft generation
 */
export const generateDrafts = async (req: Request, res: Response) => {
    try {
        const { days, threshold, templateId } = req.body;
        
        const service = AutomationService.getInstance();
        const result = await service.generateAbsenceDrafts({
            days: days || 7,
            threshold: threshold || 3,
            templateId,
            dryRun: false
        });
        
        res.json({
            success: result.success,
            data: {
                drafts: result.drafts,
                summary: result.summary
            },
            errors: result.errors
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * GET /api/automation/alerts/stats
 * Get alert statistics
 */
export const getAlertStats = async (_req: Request, res: Response) => {
    try {
        const eventLogService = EventLogService.getInstance();
        const logs = await eventLogService.getEventsByType(EventLogType.AutomationTriggered);
        
        const attendanceAlerts = logs.filter(log => 
            log.entityType === 'student' || 
            (log.entityId && (log.entityId as string).includes('attendance'))
        );
        
        const stats = {
            totalAlerts: attendanceAlerts.length,
            last24h: attendanceAlerts.filter(log => {
                // Using createdAt (Unix seconds) instead of timestamp
                const logDate = new Date(log.createdAt * 1000);
                const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                return logDate > dayAgo;
            }).length,
            last7days: attendanceAlerts.filter(log => {
                const logDate = new Date(log.createdAt * 1000);
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                return logDate > weekAgo;
            }).length
        };
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
