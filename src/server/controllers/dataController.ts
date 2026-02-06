
import { Request, Response } from 'express';
import {
  studentService,
  classService,
  attendanceService,
  absenceService,
  observationService,
  teacherService,
  alertService
} from '../services/dataService';

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
      console.error('Error getting students:', error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
  
  /**
   * GET /api/data/students/group/:groupId
   * Get students by group
   */
  getStudentsByGroup: async (req: Request, res: Response) => {
    try {
      const students = await studentService.getStudentsByGroup(req.params.groupId);
      res.json({ success: true, data: students });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  /**
   * GET /api/data/students/:id
   * Get a single student by ID
   */
  getStudent: async (req: Request, res: Response) => {
    try {
      const student = await studentService.getStudent(req.params.id);
      if (!student) {
        return res.status(404).json({ success: false, error: 'Student not found' });
      }
      res.json({ success: true, data: student });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  /**
   * POST /api/data/students
   * Create a new student
   */
  createStudent: async (req: Request, res: Response) => {
    try {
      const data = req.body;
      
      // Validate required fields
      if (!data.nombre || !data.apellido) {
        return res.status(400).json({ 
          success: false, 
          error: 'nombre and apellido are required' 
        });
      }
      
      const result = await studentService.createStudent(data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      console.error('Error creating student:', error);
      res.status(500).json({ success: false, error: (error as Error).message });
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
      
      // Check if student exists
      const existing = await studentService.getStudent(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Student not found' });
      }
      
      await studentService.updateStudent(id, data);
      res.json({ success: true, message: 'Student updated successfully' });
    } catch (error) {
      console.error('Error updating student:', error);
      res.status(500).json({ success: false, error: (error as Error).message });
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
      
      // Check if student exists
      const existing = await studentService.getStudent(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Student not found' });
      }
      
      await studentService.deleteStudent(id, !hardDelete);
      res.json({ success: true, message: 'Student deleted successfully' });
    } catch (error) {
      console.error('Error deleting student:', error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  // ==================== CLASSES ====================
  
  getAllClasses: async (req: Request, res: Response) => {
    try {
      const classes = await classService.getAllClasses();
      res.json({ success: true, data: classes });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  getClassesToday: async (req: Request, res: Response) => {
    try {
      const classes = await classService.getClassesToday(req.params.date);
      res.json({ success: true, data: classes });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  getClass: async (req: Request, res: Response) => {
    try {
      const classData = await classService.getClass(req.params.id);
      if (!classData) {
        return res.status(404).json({ success: false, error: 'Class not found' });
      }
      res.json({ success: true, data: classData });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  // ==================== ATTENDANCE ====================
  
  getAttendancesToday: async (req: Request, res: Response) => {
    try {
      const attendances = await attendanceService.getAttendancesToday(req.params.date);
      res.json({ success: true, data: attendances });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  // ==================== ABSENCES ====================
  
  getAbsencesToday: async (req: Request, res: Response) => {
    try {
      const absences = await absenceService.getAbsencesToday(req.params.date);
      res.json({ success: true, data: absences });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  // ==================== TEACHERS ====================
  
  getAllTeachers: async (req: Request, res: Response) => {
    try {
      const teachers = await teacherService.getAllTeachers();
      res.json({ success: true, data: teachers });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
};
