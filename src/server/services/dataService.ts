

// ============================================
// DATA SERVICE - Firebase SDK Wrapper
// ============================================

import { db } from '../config/firebaseAdmin';
import type {
  StudentData,
  ClassData,
  AttendanceData,
  AbsenceData,
  TeacherData
} from '../types';

// 1. STUDENT SERVICE
export const studentService = {
  /**
   * Get all students (optionally filter by active status)
   */
  async getAllStudents(activeOnly: boolean = false): Promise<any[]> {
    let query = db.collection('ALUMNOS') as FirebaseFirestore.Query;
    
    if (activeOnly) {
      query = query.where('activo', '==', true);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  /**
   * Get students by group (grupo is an array field)
   */
  async getStudentsByGroup(groupId: string): Promise<any[]> {
    const snapshot = await db.collection('ALUMNOS')
      .where('grupo', 'array-contains', groupId)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  /**
   * Get a single student by ID
   */
  async getStudent(studentId: string): Promise<any | null> {
    const doc = await db.collection('ALUMNOS').doc(studentId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  /**
   * Search students by name (prefix search)
   */
  async searchStudent(name: string): Promise<any[]> {
    const snapshot = await db.collection('ALUMNOS')
      .where('nombre', '>=', name)
      .where('nombre', '<=', name + '\uf8ff')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  /**
   * Create a new student
   */
  async createStudent(data: Partial<any>): Promise<{ id: string }> {
    const timestamp = new Date();
    const docRef = await db.collection('ALUMNOS').add({
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp,
      activo: data.activo !== undefined ? data.activo : true
    });
    return { id: docRef.id };
  },

  /**
   * Update an existing student
   */
  async updateStudent(studentId: string, data: Partial<any>): Promise<void> {
    const { id, createdAt, ...updateData } = data; // Remove id and createdAt from update
    await db.collection('ALUMNOS').doc(studentId).update({
      ...updateData,
      updatedAt: new Date()
    });
  },

  /**
   * Delete a student (or soft-delete by setting activo = false)
   */
  async deleteStudent(studentId: string, softDelete: boolean = true): Promise<void> {
    if (softDelete) {
      await db.collection('ALUMNOS').doc(studentId).update({
        activo: false,
        updatedAt: new Date()
      });
    } else {
      await db.collection('ALUMNOS').doc(studentId).delete();
    }
  }
};


// 2. CLASS SERVICE
export const classService = {
  async getAllClasses(): Promise<ClassData[]> {
    const snapshot = await db.collection('CLASES').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassData));
  },

  async getClassesToday(today: string): Promise<ClassData[]> {
    const snapshot = await db.collection('CLASES')
      .where('fechas', 'array-contains', today)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassData));
  },

  async getClass(classId: string): Promise<ClassData | null> {
    const doc = await db.collection('CLASES').doc(classId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as ClassData : null;
  }
};

// 3. ATTENDANCE SERVICE
export const attendanceService = {
  async getAttendancesToday(today: string): Promise<AttendanceData[]> {
    const snapshot = await db.collection('ASISTENCIAS')
      .where('fecha', '==', today)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceData));
  },

  async getAttendance(docId: string): Promise<AttendanceData | null> {
    const doc = await db.collection('ASISTENCIAS').doc(docId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as AttendanceData : null;
  },

  async getAttendancesByDateRange(
    startDate: string,
    endDate: string
  ): Promise<AttendanceData[]> {
    const snapshot = await db.collection('ASISTENCIAS')
      .where('fecha', '>=', startDate)
      .where('fecha', '<=', endDate)
      .orderBy('fecha', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceData));
  },

  async getIncompleteAttendances(): Promise<AttendanceData[]> {
    const snapshot = await db.collection('ASISTENCIAS')
      .where('estado', '==', 'en_progreso')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceData));
  }
};

// 4. ABSENCE SERVICE
export const absenceService = {
  async getAbsencesToday(today: string): Promise<AbsenceData[]> {
    const snapshot = await db.collection('AUSENCIAS')
      .where('fecha', '==', today)
      .where('justificada', '==', true)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbsenceData));
  },

  async getAbsencesByDateRange(
    startDate: string,
    endDate: string
  ): Promise<AbsenceData[]> {
    const snapshot = await db.collection('AUSENCIAS')
      .where('fecha', '>=', startDate)
      .where('fecha', '<=', endDate)
      .orderBy('fecha', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbsenceData));
  },

  async getPendingAbsences(): Promise<AbsenceData[]> {
    const snapshot = await db.collection('AUSENCIAS')
      .where('estado', '==', 'pendiente')
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbsenceData));
  },

  async getStudentAbsences(
    studentId: string,
    limit: number = 10
  ): Promise<AbsenceData[]> {
    const snapshot = await db.collection('AUSENCIAS')
      .where('studentId', '==', studentId)
      .orderBy('fecha', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbsenceData));
  }
};

// 5. OBSERVATION SERVICE
export const observationService = {
  async getObservationsByClass(classId: string): Promise<any[]> {
    const snapshot = await db.collection('OBSERVACIONES')
      .where('classId', '==', classId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getRecentObservations(limit: number = 50): Promise<any[]> {
    const snapshot = await db.collection('OBSERVACIONES')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

// 6. TEACHER SERVICE
export const teacherService = {
  async getAllTeachers(): Promise<TeacherData[]> {
    const snapshot = await db.collection('MAESTROS').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherData));
  },

  async getTeacher(teacherId: string): Promise<TeacherData | null> {
    const doc = await db.collection('MAESTROS').doc(teacherId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as TeacherData : null;
  },

  async getTeachersWithWhatsApp(): Promise<TeacherData[]> {
    const snapshot = await db.collection('MAESTROS')
      .where('whatsappPhone', '!=', null)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherData));
  }
};

// 7. ALERT SERVICE
export const alertService = {
  async checkExcessiveAbsences(
    studentId: string,
    daysWindow: number = 14,
    threshold: number = 4
  ): Promise<{ hasAlert: boolean; count: number; dates: string[] }> {
    const snapshot = await db.collection('AUSENCIAS')
      .where('studentId', '==', studentId)
      .orderBy('fecha', 'desc')
      .limit(20)
      .get();

    const absences = snapshot.docs.map(doc => doc.data().fecha);
    return {
      hasAlert: absences.length >= threshold,
      count: absences.length,
      dates: absences
    };
  },

  async detectSuspiciousPatterns(studentId: string): Promise<{
    isSuspicious: boolean;
    pattern: string;
  }> {
    const absences = await absenceService.getStudentAbsences(studentId, 15);
    
    const dayNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const dayCount: { [key: string]: number } = {};
    
    absences.forEach(a => {
      const date = new Date(a.fecha);
      const dayName = dayNames[date.getDay()];
      dayCount[dayName] = (dayCount[dayName] || 0) + 1;
    });

    const entries = Object.entries(dayCount);
    if (entries.length === 0) {
         return { isSuspicious: false, pattern: 'Sin datos' };
    }

    const maxDay = entries.reduce((a, b) =>
      b[1] > a[1] ? b : a
    );

    const isSuspicious = maxDay[1] > 0 && 
                        maxDay[1] / absences.length > 0.5;

    return {
      isSuspicious,
      pattern: isSuspicious ? `Patrón: Falta ${maxDay[0]}s` : 'Sin patrón'
    };
  }
};
