
import { Request, Response } from 'express';
import { attendanceAnalytics, absenceProcessing } from '../services/analyticsService';

export const analyticsController = {
  analyzeClass: async (req: Request, res: Response) => {
    try {
      const { classId, date } = req.params;
      const analysis = await attendanceAnalytics.analyzeClassAttendance(classId, date);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  analyzeDay: async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const analysis = await attendanceAnalytics.analyzeDayAttendance(date);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  detectDiscrepancies: async (req: Request, res: Response) => {
    try {
      const { classId, date } = req.params;
      const discrepancies = await absenceProcessing.detectDiscrepancies(classId, date);
      res.json(discrepancies);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  preFillJustifications: async (req: Request, res: Response) => {
      try {
          const { classId, date } = req.params;
          const justifications = await absenceProcessing.preFillJustifications(classId, date);
          res.json(justifications);
      } catch (error) {
          res.status(500).json({ error: (error as Error).message });
      }
  }
};
