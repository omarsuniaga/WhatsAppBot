
import { Request, Response } from 'express';
import Logger from '../services/loggerService';
import {
  studentService,
  classService,
  attendanceService,
  absenceService,
  teacherService,
  contactService
} from '../services/dataService';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isValidDateParam = (value: unknown): value is string =>
  isNonEmptyString(value) && DATE_PATTERN.test(value);

const sendBadRequest = (res: Response, error: string) =>
  res.status(400).json({ success: false, error });

const sendServerError = (res: Response, scope: string, error: unknown) => {
  Logger.error(`[DataController] ${scope}:`, error);
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return res.status(500).json({ success: false, error: message });
};

export const dataController = {
  // ==================== STUDENTS ====================
  
  /**
   * GET /api/data/students
   * Get all students from Firestore ALUMNOS collection
   */
  getAllStudents: async (req: Request, res: Response) => {
    try {
      const students = await studentService.getAllStudents();
      res.json({ success: true, data: students });
    } catch (error) {
      Logger.error('Error getting students:', error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
  
  /**
   * GET /api/data/students/group/:groupId
   * Get students by group
   */
  getStudentsByGroup: async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      if (!isNonEmptyString(groupId)) {
        return sendBadRequest(res, 'groupId is required');
      }
      const students = await studentService.getStudentsByGroup(groupId);
      res.json({ success: true, data: students });
    } catch (error) {
      return sendServerError(res, 'Error getting students by group', error);
    }
  },

  /**
   * GET /api/data/students/:id
   * Get a single student by ID
   */
  getStudent: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!isNonEmptyString(id)) {
        return sendBadRequest(res, 'id is required');
      }
      const student = await studentService.getStudent(id);
      if (!student) {
        return res.status(404).json({ success: false, error: 'Student not found' });
      }
      res.json({ success: true, data: student });
    } catch (error) {
      return sendServerError(res, 'Error getting student', error);
    }
  },

  /**
   * POST /api/data/students
   * Create a new student
   */
  createStudent: async (req: Request, res: Response) => {
    try {
      const data = req.body;

      if (!isPlainObject(data)) {
        return sendBadRequest(res, 'Request body must be an object');
      }
      
      // Validate required fields
      if (!data.nombre || !data.apellido) {
        return sendBadRequest(res, 'nombre and apellido are required');
      }
      
      const result = await studentService.createStudent(data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      return sendServerError(res, 'Error creating student', error);
    }
  },

  /**
   * PUT /api/data/students/:id
   * Update an existing student
   */
  updateStudent: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body;

      if (!isNonEmptyString(id)) {
        return sendBadRequest(res, 'id is required');
      }
      if (!isPlainObject(data)) {
        return sendBadRequest(res, 'Request body must be an object');
      }
      if (Object.keys(data).length === 0) {
        return sendBadRequest(res, 'Request body must contain at least one field');
      }
      
      // Check if student exists
      const existing = await studentService.getStudent(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Student not found' });
      }
      
      await studentService.updateStudent(id, data);
      res.json({ success: true, message: 'Student updated successfully' });
    } catch (error) {
      return sendServerError(res, 'Error updating student', error);
    }
  },

  /**
   * DELETE /api/data/students/:id
   * Delete (soft-delete) a student
   */
  deleteStudent: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const hardDelete = req.query.hard === 'true';

      if (!isNonEmptyString(id)) {
        return sendBadRequest(res, 'id is required');
      }
      
      // Check if student exists
      const existing = await studentService.getStudent(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Student not found' });
      }
      
      await studentService.deleteStudent(id, !hardDelete);
      res.json({ success: true, message: 'Student deleted successfully' });
    } catch (error) {
      return sendServerError(res, 'Error deleting student', error);
    }
  },

  // ==================== CLASSES ====================
  
  getAllClasses: async (_req: Request, res: Response) => {
    try {
      const classes = await classService.getAllClasses();
      res.json({ success: true, data: classes });
    } catch (error) {
      return sendServerError(res, 'Error getting classes', error);
    }
  },

  getClassesToday: async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      if (!isValidDateParam(date)) {
        return sendBadRequest(res, 'date must be in YYYY-MM-DD format');
      }
      const classes = await classService.getClassesToday(date);
      res.json({ success: true, data: classes });
    } catch (error) {
      return sendServerError(res, 'Error getting classes today', error);
    }
  },

  getClass: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!isNonEmptyString(id)) {
        return sendBadRequest(res, 'id is required');
      }
      const classData = await classService.getClass(id);
      if (!classData) {
        return res.status(404).json({ success: false, error: 'Class not found' });
      }
      res.json({ success: true, data: classData });
    } catch (error) {
      return sendServerError(res, 'Error getting class', error);
    }
  },

  // ==================== ATTENDANCE ====================
  
  getAttendancesToday: async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      if (!isValidDateParam(date)) {
        return sendBadRequest(res, 'date must be in YYYY-MM-DD format');
      }
      const attendances = await attendanceService.getAttendancesToday(date);
      res.json({ success: true, data: attendances });
    } catch (error) {
      return sendServerError(res, 'Error getting attendances today', error);
    }
  },

  // ==================== ABSENCES ====================
  
  getAbsencesToday: async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      if (!isValidDateParam(date)) {
        return sendBadRequest(res, 'date must be in YYYY-MM-DD format');
      }
      const absences = await absenceService.getAbsencesToday(date);
      res.json({ success: true, data: absences });
    } catch (error) {
      return sendServerError(res, 'Error getting absences today', error);
    }
  },

  // ==================== TEACHERS ====================

  getAllTeachers: async (_req: Request, res: Response) => {
    try {
      const teachers = await teacherService.getAllTeachers();
      res.json({ success: true, data: teachers });
    } catch (error) {
      return sendServerError(res, 'Error getting teachers', error);
    }
  },

  // ==================== ATTENDANCE RANGE ====================

  /**
   * GET /api/data/attendance/range?startDate=X&endDate=Y
   * Get attendance records by date range from Firestore ASISTENCIAS
   */
  getAttendancesByRange: async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      if (!isValidDateParam(startDate) || !isValidDateParam(endDate)) {
        return sendBadRequest(res, 'startDate and endDate must be in YYYY-MM-DD format');
      }
      if (startDate > endDate) {
        return sendBadRequest(res, 'startDate cannot be greater than endDate');
      }
      const attendances = await attendanceService.getAttendancesByDateRange(
        startDate,
        endDate
      );
      res.json({ success: true, data: attendances });
    } catch (error) {
      return sendServerError(res, 'Error getting attendance range', error);
    }
  },

  /**
   * PUT /api/data/attendance/:id
   * Update an attendance record in Firestore ASISTENCIAS
   */
  updateAttendance: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body;

      if (!isNonEmptyString(id)) {
        return sendBadRequest(res, 'id is required');
      }
      if (!isPlainObject(data)) {
        return sendBadRequest(res, 'Request body must be an object');
      }
      if (Object.keys(data).length === 0) {
        return sendBadRequest(res, 'Request body must contain at least one field');
      }

      const existing = await attendanceService.getAttendance(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Attendance not found' });
      }

      await attendanceService.updateAttendance(id, data);
      res.json({ success: true, message: 'Attendance updated successfully' });
    } catch (error) {
      return sendServerError(res, 'Error updating attendance', error);
    }
  },

  // ==================== CONTACTS ====================

  /**
   * GET /api/data/contacts
   * Get all contacts from Firestore CONTACTOS collection
   */
  getAllContacts: async (_req: Request, res: Response) => {
    try {
      const contacts = await contactService.getAllContacts();
      res.json({ success: true, data: contacts });
    } catch (error) {
      return sendServerError(res, 'Error getting contacts', error);
    }
  }
};

