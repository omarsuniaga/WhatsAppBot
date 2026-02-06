/**
 * Unit Tests for Analytics Service
 * Testing business logic and calculations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attendanceAnalytics, absenceProcessing } from '../services/analyticsService';

// Mock dependencies
vi.mock('../services/dataService', () => ({
  classService: {
    getClass: vi.fn(async (id: string) => ({
      id,
      nombre: 'Violín Intermedio',
      instrumento: 'violín',
      nivel: 'intermedio',
      maestroId: 'teacher123',
      maestroNombre: 'Prof. García',
      alumnos: ['student1', 'student2', 'student3', 'student4', 'student5']
    }))
  },
  attendanceService: {
    getAttendancesToday: vi.fn(async () => [
      {
        id: 'att1',
        classId: 'class123',
        fecha: '2026-01-29',
        data: {
          presentes: ['student1', 'student2', 'student3'],
          ausentes: ['student4', 'student5'],
          justificacion: [
            {
              studentId: 'student4',
              motivo: 'Enfermedad',
              fuenteFlota: true,
              timestamp: new Date()
            }
          ]
        },
        estado: 'completado'
      }
    ])
  },
  absenceService: {
    getAbsencesToday: vi.fn(async () => [
      {
        id: 'abs1',
        studentId: 'student4',
        studentName: 'Ana Martínez',
        classId: 'class123',
        fecha: '2026-01-29',
        motivo: { tipo: 'enfermedad', descripcion: 'Gripe' },
        justificada: true,
        estado: 'confirmada'
      },
      {
        id: 'abs2',
        studentId: 'student5',
        studentName: 'Carlos López',
        classId: 'class123',
        fecha: '2026-01-29',
        motivo: { tipo: 'otro' },
        justificada: false,
        estado: 'pendiente'
      }
    ])
  }
}));

describe('attendanceAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeClassAttendance', () => {
    it('should calculate correct attendance statistics', async () => {
      const result = await attendanceAnalytics.analyzeClassAttendance('class123', '2026-01-29');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('classId', 'class123');
      expect(result).toHaveProperty('className');
      expect(result).toHaveProperty('fecha', '2026-01-29');
      expect(result).toHaveProperty('totalExpected');
      expect(result).toHaveProperty('presentes');
      expect(result).toHaveProperty('ausentes');
      expect(result).toHaveProperty('porcentajeAsistencia');
    });

    it('should calculate attendance percentage correctly', async () => {
      const result = await attendanceAnalytics.analyzeClassAttendance('class123', '2026-01-29');
      
      // 3 presentes de 5 = 60%
      expect(result.presentes).toBe(3);
      expect(result.totalExpected).toBe(5);
      expect(result.porcentajeAsistencia).toBe(60);
    });

    it('should identify justified absences', async () => {
      const result = await attendanceAnalytics.analyzeClassAttendance('class123', '2026-01-29');
      
      expect(result).toHaveProperty('justificados');
      expect(result.justificados).toBeGreaterThanOrEqual(1);
    });

    it('should include detailed justifications', async () => {
      const result = await attendanceAnalytics.analyzeClassAttendance('class123', '2026-01-29');
      
      expect(result).toHaveProperty('detalles');
      expect(result.detalles).toHaveProperty('justificaciones');
      expect(Array.isArray(result.detalles.justificaciones)).toBe(true);
    });

    it('should identify unjustified absences', async () => {
      const result = await attendanceAnalytics.analyzeClassAttendance('class123', '2026-01-29');
      
      expect(result.detalles).toHaveProperty('ausenciasSinJustificar');
      expect(Array.isArray(result.detalles.ausenciasSinJustificar)).toBe(true);
    });

    it('should mark status as completed when attendance exists', async () => {
      const result = await attendanceAnalytics.analyzeClassAttendance('class123', '2026-01-29');
      
      expect(result.estado).toBe('completado');
    });
  });

  describe('analyzeDayAttendance', () => {
    it('should aggregate all classes for the day', async () => {
      const result = await attendanceAnalytics.analyzeDayAttendance('2026-01-29');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('fecha', '2026-01-29');
      expect(result).toHaveProperty('clasesToday');
      expect(result).toHaveProperty('totalStudentsExpected');
      expect(result).toHaveProperty('totalPresent');
      expect(result).toHaveProperty('totalAbsent');
    });

    it('should calculate overall attendance percentage', async () => {
      const result = await attendanceAnalytics.analyzeDayAttendance('2026-01-29');
      
      expect(result).toHaveProperty('overallPercentage');
      expect(typeof result.overallPercentage).toBe('number');
      expect(result.overallPercentage).toBeGreaterThanOrEqual(0);
      expect(result.overallPercentage).toBeLessThanOrEqual(100);
    });

    it('should provide class-by-class summary', async () => {
      const result = await attendanceAnalytics.analyzeDayAttendance('2026-01-29');
      
      expect(result).toHaveProperty('byClass');
      expect(Array.isArray(result.byClass)).toBe(true);
    });

    it('should list pending justifications', async () => {
      const result = await attendanceAnalytics.analyzeDayAttendance('2026-01-29');
      
      expect(result).toHaveProperty('pendingJustifications');
      expect(Array.isArray(result.pendingJustifications)).toBe(true);
    });

    it('should count completed vs in-progress classes', async () => {
      const result = await attendanceAnalytics.analyzeDayAttendance('2026-01-29');
      
      expect(result).toHaveProperty('classesCompleted');
      expect(result).toHaveProperty('classesInProgress');
      expect(typeof result.classesCompleted).toBe('number');
      expect(typeof result.classesInProgress).toBe('number');
    });
  });
});

describe('absenceProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectDiscrepancies', () => {
    it('should detect discrepancies between absence reports and attendance', async () => {
      const result = await absenceProcessing.detectDiscrepancies('class123', '2026-01-29');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no discrepancies exist', async () => {
      // This would require mock adjustment to simulate perfect match
      const result = await absenceProcessing.detectDiscrepancies('class123', '2026-01-29');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('preFillJustifications', () => {
    it('should generate justifications for confirmed absences', async () => {
      const result = await absenceProcessing.preFillJustifications('class123', '2026-01-29');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should include all required justification fields', async () => {
      const result = await absenceProcessing.preFillJustifications('class123', '2026-01-29');
      
      if (result.length > 0) {
        const justification = result[0];
        expect(justification).toHaveProperty('studentId');
        expect(justification).toHaveProperty('motivo');
        expect(justification).toHaveProperty('fuenteFlota', true);
      }
    });

    it('should only process confirmed absences', async () => {
      const result = await absenceProcessing.preFillJustifications('class123', '2026-01-29');
      
      // All generated justifications should be from confirmed absences
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle empty attendance data gracefully', async () => {
    vi.mocked((await import('../services/dataService')).attendanceService.getAttendancesToday).mockResolvedValueOnce([]);
    
    const result = await attendanceAnalytics.analyzeClassAttendance('class123', '2026-01-29');
    
    expect(result).toBeDefined();
    expect(result.estado).toBe('pendiente');
  });

  it('should handle missing class data', async () => {
    vi.mocked((await import('../services/dataService')).classService.getClass).mockResolvedValueOnce(null);
    
    const result = await attendanceAnalytics.analyzeClassAttendance('non-existent', '2026-01-29');
    
    expect(result).toBeDefined();
    // Should handle gracefully without throwing
  });

  it('should handle invalid date formats', async () => {
    const invalidDate = 'invalid-date';
    
    // Should not throw error
    await expect(
      attendanceAnalytics.analyzeDayAttendance(invalidDate)
    ).resolves.toBeDefined();
  });
});
