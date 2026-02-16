

import { Router } from 'express';
import { dataController } from '../../controllers/dataController';
import { analyticsController } from '../../controllers/analyticsController';
import { automationController } from '../../controllers/automationController';


const router = Router();

// ==========================================
// DATA ROUTES
// ==========================================

// Students - CRUD operations
router.get('/data/students', dataController.getAllStudents);
router.get('/data/students/group/:groupId', dataController.getStudentsByGroup);
router.get('/data/students/:id', dataController.getStudent);
router.post('/data/students', dataController.createStudent);
router.put('/data/students/:id', dataController.updateStudent);
router.delete('/data/students/:id', dataController.deleteStudent);


// Classes
router.get('/data/classes', dataController.getAllClasses);
router.get('/data/classes/today/:date', dataController.getClassesToday);
router.get('/data/classes/:id', dataController.getClass);

// Attendance
router.get('/data/attendance/range', dataController.getAttendancesByRange);
router.get('/data/attendance/today/:date', dataController.getAttendancesToday);
router.put('/data/attendance/:id', dataController.updateAttendance);

// Absences
router.get('/data/absences/today/:date', dataController.getAbsencesToday);

// Contacts
router.get('/data/contacts', dataController.getAllContacts);

// Teachers
router.get('/data/teachers', dataController.getAllTeachers);

// ==========================================
// ANALYTICS ROUTES
// ==========================================

router.get('/analytics/classes/:classId/date/:date', analyticsController.analyzeClass);
router.get('/analytics/day/:date', analyticsController.analyzeDay);
router.get('/analytics/discrepancies/:classId/date/:date', analyticsController.detectDiscrepancies);
router.get('/analytics/prefill/:classId/date/:date', analyticsController.preFillJustifications);

// ==========================================
// AUTOMATION ROUTES
// ==========================================

// Triggers (manual invocation for testing)
router.post('/automations/trigger/absence-created', automationController.triggerAbsenceCreated);
router.post('/automations/trigger/attendance-completed', automationController.triggerAttendanceCompleted);

// Alerts (manual sending)
router.post('/automations/alerts/send-absence', automationController.sendAbsenceAlert);

// Scheduled tasks (manual execution)
router.post('/automations/scheduled/check-pending', automationController.checkPendingJustifications);
router.post('/automations/scheduled/weekly-report', automationController.generateWeeklyReport);

// ==========================================
// ATTENDANCE ALERTS CONFIG/STATS/HISTORY
// Used by AttendanceAlertsPage
// ==========================================
router.get('/automation/alerts/config', automationController.getAlertConfig);
router.put('/automation/alerts/config', automationController.updateAlertConfig);
router.get('/automation/alerts/stats', automationController.getAlertStats);
router.get('/automation/alerts/history', automationController.getAlertHistory);
router.post('/automation/alerts/generate', automationController.generateAlerts);

export default router;
