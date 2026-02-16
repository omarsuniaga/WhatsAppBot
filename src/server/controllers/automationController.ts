import { Request, Response } from 'express';
import Logger from '../services/loggerService';

// ============================================
// AUTOMATION CONTROLLER
// Expone triggers y automatizaciones vÃ­a API
// ============================================
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { writeFileSyncAtomic } from '../utils/atomicWrite';
import {
  onAbsenceCreated,
  onAttendanceCompleted,
  whatsAppAlertService,
  scheduledAutomation,
  AutomationService
} from '../services/automationService';
import { getErrorMessage } from '../utils/errorUtils';

// ============================================
// Alert Config & History persistence (JSON)
// ============================================
const ALERT_CONFIG_PATH = join(process.cwd(), 'data', 'automation-alerts-config.json');

interface AlertConfig {
  enabled: boolean;
  absenceThreshold: number;
  daysToAnalyze: number;
  autoSend: boolean;
  templateId?: string;
  notifyGuardians: boolean;
}

interface AlertHistoryEntry {
  id: string;
  type: string;
  level: string;
  message: string;
  entityType?: string;
  entityId?: string;
  createdAt: number;
  data?: any;
}

interface AlertData {
  config: AlertConfig;
  history: AlertHistoryEntry[];
  stats: {
    totalAlerts: number;
    lastReset: string;
  };
}

const DEFAULT_ALERT_DATA: AlertData = {
  config: {
    enabled: true,
    absenceThreshold: 3,
    daysToAnalyze: 7,
    autoSend: false,
    notifyGuardians: true
  },
  history: [],
  stats: {
    totalAlerts: 0,
    lastReset: new Date().toISOString()
  }
};

function loadAlertData(): AlertData {
  try {
    if (existsSync(ALERT_CONFIG_PATH)) {
      return JSON.parse(readFileSync(ALERT_CONFIG_PATH, 'utf-8'));
    }
  } catch (error) {
    Logger.error('[AutomationController] Error loading alert data:', error);
  }
  return { ...DEFAULT_ALERT_DATA };
}

function saveAlertData(data: AlertData): void {
  try {
    const dir = dirname(ALERT_CONFIG_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSyncAtomic(ALERT_CONFIG_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    Logger.error('[AutomationController] Error saving alert data:', error);
  }
}

function addAlertHistory(data: AlertData, entry: Omit<AlertHistoryEntry, 'id' | 'createdAt'>): AlertData {
  const newEntry: AlertHistoryEntry = {
    ...entry,
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    createdAt: Math.floor(Date.now() / 1000)
  };
  data.history.unshift(newEntry); // Most recent first
  // Keep only last 100 entries
  if (data.history.length > 100) {
    data.history = data.history.slice(0, 100);
  }
  data.stats.totalAlerts++;
  return data;
}

export const automationController = {
  /**
   * POST /api/automations/trigger/absence-created
   * Dispara el trigger de creaciÃ³n de ausencia
   */
  triggerAbsenceCreated: async (req: Request, res: Response) => {
    try {
      const { absenceId } = req.body;
      
      if (!absenceId) {
        return res.status(400).json({
          success: false,
          error: 'absenceId is required'
        });
      }

      await onAbsenceCreated.handler(absenceId);

      res.json({
        success: true,
        message: 'Absence trigger executed successfully'
      });
    } catch (error: unknown) {
      Logger.error('Error in triggerAbsenceCreated:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error)
      });
    }
  },

  /**
   * POST /api/automations/trigger/attendance-completed
   * Dispara el trigger de asistencia completada
   */
  triggerAttendanceCompleted: async (req: Request, res: Response) => {
    try {
      const { classId, date, teacherId } = req.body;
      
      if (!classId || !date || !teacherId) {
        return res.status(400).json({
          success: false,
          error: 'classId, date, and teacherId are required'
        });
      }

      await onAttendanceCompleted.handler(classId, date, teacherId);

      res.json({
        success: true,
        message: 'Attendance completed trigger executed successfully'
      });
    } catch (error: unknown) {
      Logger.error('Error in triggerAttendanceCompleted:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error)
      });
    }
  },

  /**
   * POST /api/automations/alerts/send-absence
   * EnvÃ­a una alerta de ausencia manualmente
   */
  sendAbsenceAlert: async (req: Request, res: Response) => {
    try {
      const { recipientPhone, studentName, className, date, consecutiveDays } = req.body;
      
      if (!recipientPhone || !studentName || !className || !date) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }

      const success = await whatsAppAlertService.sendAbsenceAlert(
        recipientPhone,
        studentName,
        className,
        date,
        consecutiveDays || 1
      );

      res.json({
        success,
        message: success ? 'Alert sent successfully' : 'Failed to send alert'
      });
    } catch (error: unknown) {
      Logger.error('Error in sendAbsenceAlert:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error)
      });
    }
  },

  /**
   * POST /api/automations/scheduled/check-pending
   * Ejecuta manualmente la verificaciÃ³n de justificaciones pendientes
   */
  checkPendingJustifications: async (req: Request, res: Response) => {
    try {
      await scheduledAutomation.checkPendingJustifications();

      res.json({
        success: true,
        message: 'Pending justifications check completed'
      });
    } catch (error: unknown) {
      Logger.error('Error in checkPendingJustifications:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error)
      });
    }
  },

  /**
   * POST /api/automations/scheduled/weekly-report
   * Ejecuta manualmente la generaciÃ³n del reporte semanal
   */
  generateWeeklyReport: async (req: Request, res: Response) => {
    try {
      await scheduledAutomation.generateWeeklyReport();

      res.json({
        success: true,
        message: 'Weekly report generation completed'
      });
    } catch (error: unknown) {
      Logger.error('Error in generateWeeklyReport:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error)
      });
    }
  },

  // ============================================
  // Alert Config/Stats/History endpoints
  // Used by AttendanceAlertsPage
  // ============================================

  /**
   * GET /api/automation/alerts/config
   * Returns alert configuration
   */
  getAlertConfig: async (_req: Request, res: Response) => {
    try {
      const data = loadAlertData();
      res.json({ success: true, data: data.config });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },

  /**
   * PUT /api/automation/alerts/config
   * Updates alert configuration
   */
  updateAlertConfig: async (req: Request, res: Response) => {
    try {
      const data = loadAlertData();
      const updates = req.body;

      // Merge updates into config
      if (typeof updates.enabled === 'boolean') data.config.enabled = updates.enabled;
      if (typeof updates.absenceThreshold === 'number') data.config.absenceThreshold = updates.absenceThreshold;
      if (typeof updates.daysToAnalyze === 'number') data.config.daysToAnalyze = updates.daysToAnalyze;
      if (typeof updates.autoSend === 'boolean') data.config.autoSend = updates.autoSend;
      if (typeof updates.notifyGuardians === 'boolean') data.config.notifyGuardians = updates.notifyGuardians;
      if (updates.templateId !== undefined) data.config.templateId = updates.templateId;

      // Log config change
      addAlertHistory(data, {
        type: 'config_update',
        level: 'Info',
        message: 'ConfiguraciÃ³n de alertas actualizada'
      });

      saveAlertData(data);

      res.json({ success: true, data: data.config });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },

  /**
   * GET /api/automation/alerts/stats
   * Returns alert statistics
   */
  getAlertStats: async (_req: Request, res: Response) => {
    try {
      const data = loadAlertData();
      const now = Date.now() / 1000;
      const day = 86400;

      const last24h = data.history.filter(h => (now - h.createdAt) < day).length;
      const last7days = data.history.filter(h => (now - h.createdAt) < day * 7).length;

      res.json({
        success: true,
        data: {
          totalAlerts: data.stats.totalAlerts,
          last24h,
          last7days
        }
      });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },

  /**
   * GET /api/automation/alerts/history
   * Returns alert history
   */
  getAlertHistory: async (_req: Request, res: Response) => {
    try {
      const data = loadAlertData();
      res.json({ success: true, data: data.history });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },

  /**
   * POST /api/automation/alerts/generate
   * Triggers manual absence analysis and generates drafts
   */
  generateAlerts: async (req: Request, res: Response) => {
    try {
      const { days, threshold } = req.body;
      const automationService = AutomationService.getInstance();

      const result = await automationService.generateAbsenceDrafts({
        days: days || 7,
        threshold: threshold || 3
      });

      // Log the analysis in history
      const data = loadAlertData();
      addAlertHistory(data, {
        type: 'manual_analysis',
        level: 'Info',
        message: `AnÃ¡lisis manual: ${result.summary.studentsAnalyzed} estudiantes analizados, ${result.summary.draftsGenerated} borradores generados`
      });

      // Log each draft as an alert
      for (const draft of result.drafts) {
        addAlertHistory(data, {
          type: 'absence_alert',
          level: 'Warning',
          message: `${draft.studentName}: ${draft.absenceCount} ausencias detectadas`,
          entityType: 'student',
          entityId: draft.studentId,
          data: { absenceCount: draft.absenceCount, contactName: draft.contactName }
        });
      }

      saveAlertData(data);

      res.json({ success: true, data: result });
    } catch (error: unknown) {
      Logger.error('Error in generateAlerts:', error);
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  }
};


