
// ============================================
// AUTOMATION CONTROLLER
// Expone triggers y automatizaciones vía API
// ============================================

import { Request, Response } from 'express';
import {
  onAbsenceCreated,
  onAttendanceCompleted,
  whatsAppAlertService,
  scheduledAutomation
} from '../services/automationService';

export const automationController = {
  /**
   * POST /api/automations/trigger/absence-created
   * Dispara el trigger de creación de ausencia
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
    } catch (error: any) {
      console.error('Error in triggerAbsenceCreated:', error);
      res.status(500).json({
        success: false,
        error: error.message
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
    } catch (error: any) {
      console.error('Error in triggerAttendanceCompleted:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/automations/alerts/send-absence
   * Envía una alerta de ausencia manualmente
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
    } catch (error: any) {
      console.error('Error in sendAbsenceAlert:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/automations/scheduled/check-pending
   * Ejecuta manualmente la verificación de justificaciones pendientes
   */
  checkPendingJustifications: async (req: Request, res: Response) => {
    try {
      await scheduledAutomation.checkPendingJustifications();

      res.json({
        success: true,
        message: 'Pending justifications check completed'
      });
    } catch (error: any) {
      console.error('Error in checkPendingJustifications:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/automations/scheduled/weekly-report
   * Ejecuta manualmente la generación del reporte semanal
   */
  generateWeeklyReport: async (req: Request, res: Response) => {
    try {
      await scheduledAutomation.generateWeeklyReport();

      res.json({
        success: true,
        message: 'Weekly report generation completed'
      });
    } catch (error: any) {
      console.error('Error in generateWeeklyReport:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};
