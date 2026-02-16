import { Router } from 'express';
import { dataController } from '../../controllers/dataController';

const router = Router();

// ==================== STUDENTS ====================
router.get('/students', dataController.getAllStudents);
router.get('/students/group/:groupId', dataController.getStudentsByGroup);
router.get('/students/:id', dataController.getStudent);
router.post('/students', dataController.createStudent);
router.put('/students/:id', dataController.updateStudent);
router.delete('/students/:id', dataController.deleteStudent);

// ==================== CLASSES ====================
router.get('/classes', dataController.getAllClasses);
router.get('/classes/today/:date', dataController.getClassesToday);
router.get('/classes/:id', dataController.getClass);

// ==================== ATTENDANCE ====================
router.get('/attendance/today/:date', dataController.getAttendancesToday);
router.get('/attendance/range', dataController.getAttendancesByRange);
router.put('/attendance/:id', dataController.updateAttendance);

// ==================== TEACHERS ====================
router.get('/teachers', dataController.getAllTeachers);

// ==================== CONTACTS ====================
router.get('/contacts', dataController.getAllContacts);

// ==================== ABSENCES ====================
router.get('/absences/today/:date', dataController.getAbsencesToday);

export default router;
