
import { Request, Response } from 'express';
import Logger from '../services/loggerService';
import { attendanceAnalytics, absenceProcessing } from '../services/analyticsService';

export const analyticsController = {
  analyzeClass: async (req: Request, res: Response) => {
    try {
      const { classId, date } = req.params;
      const analysis = await attendanceAnalytics.analyzeClassAttendance(classId, date);
      res.json({ success: true, data: analysis });
    } catch (error) {
      const message = (error as Error).message;
      Logger.error(`[Analytics] analyzeClass failed for ${req.params.classId}/${req.params.date}:`, error);
      res.status(500).json({ success: false, error: message });
    }
  },

  analyzeDay: async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const analysis = await attendanceAnalytics.analyzeDayAttendance(date);
      res.json({ success: true, data: analysis });
    } catch (error) {
      const msg = (error as Error).message || '';
      // If Firebase is not initialized, return empty data instead of 500
      if (msg.includes('Firebase') || msg.includes('not initialized') || msg.includes('Service Account')) {
        Logger.warn(`[Analytics] Firebase not available for /analytics/day/${req.params.date}: ${msg}`);
        return res.json({
          success: true,
          data: {
            fecha: req.params.date,
            clasesToday: 0,
            classesCompleted: 0,
            classesInProgress: 0,
            totalStudentsExpected: 0,
            totalPresent: 0,
            totalAbsent: 0,
            totalJustified: 0,
            overallPercentage: 0,
            byClass: [],
            pendingJustifications: [],
            _warning: 'Firebase Admin not configured. Analytics data unavailable.'
          }
        });
      }
      Logger.error(`[Analytics] analyzeDay failed for ${req.params.date}:`, error);
      res.status(500).json({ success: false, error: msg });
    }
  },

  detectDiscrepancies: async (req: Request, res: Response) => {
    try {
      const { classId, date } = req.params;
      const discrepancies = await absenceProcessing.detectDiscrepancies(classId, date);
      res.json({ success: true, data: discrepancies });
    } catch (error) {
      const message = (error as Error).message;
      Logger.error(`[Analytics] detectDiscrepancies failed for ${req.params.classId}/${req.params.date}:`, error);
      res.status(500).json({ success: false, error: message });
    }
  },

  preFillJustifications: async (req: Request, res: Response) => {
      try {
          const { classId, date } = req.params;
          const justifications = await absenceProcessing.preFillJustifications(classId, date);
          res.json({ success: true, data: justifications });
      } catch (error) {
          const message = (error as Error).message;
          Logger.error(`[Analytics] preFillJustifications failed for ${req.params.classId}/${req.params.date}:`, error);
          res.status(500).json({ success: false, error: message });
      }
  }
};

