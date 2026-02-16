/**
 * Framework Routes - Endpoints para el Framework Educativo
 * Proporciona acceso a KPIs, alertas, estadísticas, etc.
 */

import express, { Router, Request, Response } from 'express';
import { kpiCalculatorService } from '../services/KPICalculatorService';
import { alertService, AlertType, AlertSeverity } from '../services/AlertService';
import { eventBusService, FrameworkEventType } from '../services/EventBusService';
import { IndicatorResult } from '../entities/Indicator';
import { getErrorMessage } from '../../../utils/errorUtils';
import {
  personRepository,
  studentRepository,
  activityRepository,
  attendanceRepository,
  evaluationRepository,
  indicatorRepository,
  instrumentRepository,
  groupRepository,
} from '../repositories';

const router = Router();

/**
 * ==================== KPI ENDPOINTS ====================
 */

/**
 * GET /api/framework/kpi/all
 * Calcula y retorna todos los 30 KPIs
 */
router.get('/kpi/all', async (req: Request, res: Response) => {
  try {
    const results = await kpiCalculatorService.calculateAllKPIs();

    res.json({
      success: true,
      message: 'KPIs calculados exitosamente',
      data: {
        total: results.length,
        results,
        summary: {
          exitosos: results.filter((r) => r.isSuccessful).length,
          alertas: results.filter((r) => r.alert).length,
          promedio: (
            results.reduce((sum, r) => sum + r.value, 0) / results.length
          ).toFixed(2),
        },
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * GET /api/framework/kpi/health-check
 * Estado general de salud del sistema
 */
router.get('/kpi/health-check', async (req: Request, res: Response) => {
  try {
    const indicatorStats = await indicatorRepository.getHealthCheck();
    const alertSummary = await alertService.getAlertSummary();
    const studentStats = await studentRepository.getStatistics();
    const attendanceStats = await attendanceRepository.getSummary();

    res.json({
      success: true,
      data: {
        indicators: indicatorStats,
        alerts: alertSummary,
        students: {
          total: studentStats.total,
          atRisk: studentStats.atRisk,
          averageAttendance: (studentStats.averageAttendanceRate * 100).toFixed(2) + '%',
          averageApproval: (studentStats.averageApprovalRate * 100).toFixed(2) + '%',
        },
        attendance: {
          globalRate: (attendanceStats.averagePresentRate * 100).toFixed(2) + '%',
          total: attendanceStats.total,
        },
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * GET /api/framework/kpi/category/:category
 * KPIs de una categoría específica
 */
router.get('/kpi/category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const indicators = await indicatorRepository.findByCategory(category);
    const results: IndicatorResult[] = [];

    for (const indicator of indicators) {
      const latestResult = await indicatorRepository.getLatestResult(indicator.id);
      if (latestResult) results.push(latestResult);
    }

    res.json({
      success: true,
      data: { category, kpis: results.length, results },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * ==================== STUDENT ENDPOINTS ====================
 */

/**
 * GET /api/framework/students
 * Lista todos los estudiantes con estadísticas
 */
router.get('/students', async (req: Request, res: Response) => {
  try {
    const students = await studentRepository.findAll();
    const stats = await studentRepository.getStatistics();
    const byStatus = await studentRepository.countByStatus();

    res.json({ success: true, data: { total: students.length, students, stats, byStatus } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * GET /api/framework/students/at-risk
 * Estudiantes en categoría de riesgo
 */
router.get('/students/at-risk', async (req: Request, res: Response) => {
  try {
    const atRisk = await studentRepository.findAtRisk();
    const stats = await studentRepository.getStatistics();

    res.json({
      success: true,
      data: {
        total: atRisk.length,
        percentage: ((atRisk.length / stats.total) * 100).toFixed(2) + '%',
        students: atRisk,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * GET /api/framework/students/:id
 * Detalles de un estudiante específico
 */
router.get('/students/:id', async (req: Request, res: Response) => {
  try {
    const student = await studentRepository.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Estudiante no encontrado' });
    }

    const attendanceRate = await attendanceRepository.calculateAttendanceRate(student.personId);
    const evals = await evaluationRepository.findByStudent(student.personId);
    const instruments = await instrumentRepository.findByStudent(student.personId);

    res.json({
      success: true,
      data: {
        student,
        attendance: (attendanceRate * 100).toFixed(2) + '%',
        evaluations: evals.length,
        instruments: instruments.length,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * ==================== ATTENDANCE ENDPOINTS ====================
 */

/**
 * GET /api/framework/attendance/summary
 * Resumen de asistencias
 */
router.get('/attendance/summary', async (req: Request, res: Response) => {
  try {
    const summary = await attendanceRepository.getSummary();

    res.json({
      success: true,
      data: {
        ...summary,
        averagePresentRate: (summary.averagePresentRate * 100).toFixed(2) + '%',
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * GET /api/framework/attendance/activity/:activityId
 * Estadísticas de asistencia por actividad
 */
router.get('/attendance/activity/:activityId', async (req: Request, res: Response) => {
  try {
    const stats = await attendanceRepository.getActivityAttendanceStats(req.params.activityId);

    res.json({
      success: true,
      data: {
        ...stats,
        presentRate: (stats.presentRate * 100).toFixed(2) + '%',
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * ==================== EVALUATION ENDPOINTS ====================
 */

/**
 * GET /api/framework/evaluations/summary
 * Resumen de evaluaciones
 */
router.get('/evaluations/summary', async (req: Request, res: Response) => {
  try {
    const summary = await evaluationRepository.getSummary();

    res.json({
      success: true,
      data: {
        ...summary,
        passingRate: (summary.passingRate * 100).toFixed(2) + '%',
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * GET /api/framework/evaluations/activity/:activityId
 * Estadísticas de evaluaciones por actividad
 */
router.get('/evaluations/activity/:activityId', async (req: Request, res: Response) => {
  try {
    const stats = await evaluationRepository.getActivityEvaluationStats(req.params.activityId);

    res.json({
      success: true,
      data: {
        ...stats,
        passingRate: (stats.passingRate * 100).toFixed(2) + '%',
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * ==================== ACTIVITY ENDPOINTS ====================
 */

/**
 * GET /api/framework/activities
 * Lista de actividades con estadísticas
 */
router.get('/activities', async (req: Request, res: Response) => {
  try {
    const activities = await activityRepository.findAll();
    const stats = await activityRepository.getStatistics();

    res.json({
      success: true,
      data: { total: activities.length, activities, stats },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * GET /api/framework/activities/active
 * Actividades actuales en curso
 */
router.get('/activities/active', async (req: Request, res: Response) => {
  try {
    const active = await activityRepository.findActive();

    res.json({ success: true, data: { total: active.length, activities: active } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * ==================== INSTRUMENT ENDPOINTS ====================
 */

/**
 * GET /api/framework/instruments
 * Inventario de instrumentos
 */
router.get('/instruments', async (req: Request, res: Response) => {
  try {
    const instruments = await instrumentRepository.findAll();
    const stats = await instrumentRepository.getStatistics();

    res.json({ success: true, data: { total: instruments.length, instruments, stats } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * GET /api/framework/instruments/due-maintenance
 * Instrumentos que necesitan mantenimiento
 */
router.get('/instruments/due-maintenance', async (req: Request, res: Response) => {
  try {
    const due = await instrumentRepository.findDueForMaintenance();

    res.json({ success: true, data: { total: due.length, instruments: due } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * ==================== GROUP ENDPOINTS ====================
 */

/**
 * GET /api/framework/groups
 * Grupos y comunicaciones
 */
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const groups = await groupRepository.findAll();
    const stats = await groupRepository.getStatistics();

    res.json({ success: true, data: { total: groups.length, groups, stats } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * ==================== ALERT ENDPOINTS ====================
 */

/**
 * GET /api/framework/alerts
 * Todas las alertas activas
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const alerts = await alertService.getActiveAlerts();
    const summary = await alertService.getAlertSummary();

    res.json({
      success: true,
      data: { total: alerts.length, alerts, summary },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * GET /api/framework/alerts/critical
 * Solo alertas críticas
 */
router.get('/alerts/critical', async (req: Request, res: Response) => {
  try {
    const critical = await alertService.getAlertsBySeverity(AlertSeverity.CRITICAL);

    res.json({ success: true, data: { total: critical.length, alerts: critical } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * POST /api/framework/alerts/:alertId/resolve
 * Marcar alerta como resuelta
 */
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const resolved = await alertService.resolveAlert(req.params.alertId, req.body.acknowledgedBy);
    if (!resolved) {
      return res.status(404).json({ success: false, error: 'Alerta no encontrada' });
    }

    res.json({ success: true, data: resolved });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * ==================== EVENT BUS ENDPOINTS ====================
 */

/**
 * GET /api/framework/events/history
 * Historial de eventos recientes
 */
router.get('/events/history', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const events = eventBusService.getRecentEvents(limit);
    const stats = eventBusService.getStatistics();

    res.json({
      success: true,
      data: { events, stats },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * ==================== GLOBAL STATISTICS ====================
 */

/**
 * GET /api/framework/dashboard
 * Resumen dashboard completo
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const kpis = await kpiCalculatorService.calculateAllKPIs();
    const students = await studentRepository.getStatistics();
    const attendance = await attendanceRepository.getSummary();
    const evaluations = await evaluationRepository.getSummary();
    const activities = await activityRepository.getStatistics();
    const instruments = await instrumentRepository.getStatistics();
    const alerts = await alertService.getAlertSummary();

    res.json({
      success: true,
      data: {
        timestamp: new Date(),
        students: {
          total: students.total,
          active: students.active,
          atRisk: students.atRisk,
          avgAttendance: (students.averageAttendanceRate * 100).toFixed(2),
          avgApproval: (students.averageApprovalRate * 100).toFixed(2),
        },
        attendance: {
          total: attendance.total,
          presentRate: (attendance.averagePresentRate * 100).toFixed(2),
        },
        evaluations: {
          total: evaluations.total,
          passingRate: (evaluations.passingRate * 100).toFixed(2),
          avg: evaluations.average.toFixed(2),
        },
        activities: {
          total: activities.total,
          active: activities.active,
          avgParticipants: 0,
        },
        instruments: {
          total: instruments.total,
          operative: instruments.operative,
          needingMaintenance: instruments.needingMaintenance,
        },
        alerts: {
          total: alerts.total,
          critical: alerts.critical,
          warning: alerts.warning,
        },
        kpis: {
          total: kpis.length,
          exitosos: kpis.filter((k) => k.isSuccessful).length,
          alertas: kpis.filter((k) => k.alert).length,
          promedio: (kpis.reduce((sum, k) => sum + k.value, 0) / kpis.length).toFixed(2),
        },
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
