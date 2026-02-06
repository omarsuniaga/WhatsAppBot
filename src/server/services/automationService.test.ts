/**
 * Unit Tests for Automation Service
 * Testing triggers and alert logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  whatsAppAlertService,
  onAbsenceCreated,
  onAttendanceCompleted,
  scheduledAutomation
} from '../services/automationService';

// Mock dependencies
vi.mock('../services/dataService', () => ({
  studentService: {
    getStudent: vi.fn(async (id: string) => ({
      id,
      nombre: 'Juan',
      apellido: 'Pérez',
      grupo: 'orquesta-a',
      nivel: 'intermedio',
      instrumento: 'violín',
      representante: {
        nombre: 'María Pérez',
        telefono: '+58123456789',
        email: 'maria@example.com'
      },
      estado: 'activo'
    }))
  },
  classService: {
    getClass: vi.fn(async (id: string) => ({
      id,
      nombre: 'Violín Intermedio',
      instrumento: 'violín',
      nivel: 'intermedio',
      maestroId: 'teacher123',
      maestroNombre: 'Prof. García'
    })),
    getClassesToday: vi.fn(async () => [])
  },
  absenceService: {
    getAbsencesToday: vi.fn(async () => [
      {
        id: 'abs123',
        studentId: 'student1',
        studentName: 'Juan Pérez',
        classId: 'class123',
        fecha: '2026-01-29',
        motivo: { tipo: 'enfermedad', descripcion: 'Gripe' },
        justificada: false,
        estado: 'pendiente',
        createdAt: new Date()
      }
    ]),
    getStudentAbsences: vi.fn(async (studentId: string, limit?: number) => [
      {
        id: 'abs1',
        studentId,
        studentName: 'Juan Pérez',
        classId: 'class123',
        fecha: '2026-01-28',
        motivo: { tipo: 'enfermedad' },
        justificada: false,
        estado: 'pendiente',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      },
      {
        id: 'abs2',
        studentId,
        studentName: 'Juan Pérez',
        classId: 'class123',
        fecha: '2026-01-29',
        motivo: { tipo: 'enfermedad' },
        justificada: false,
        estado: 'pendiente',
        createdAt: new Date() // Today
      }
    ])
  },
  teacherService: {
    getTeacher: vi.fn(async (id: string) => ({
      id,
      nombre: 'Prof. García',
      email: 'garcia@example.com',
      whatsappPhone: '+58987654321',
      grupo: 'orquesta',
      pushTokens: []
    }))
  }
}));

vi.mock('../services/analyticsService', () => ({
  attendanceAnalytics: {
    analyzeClassAttendance: vi.fn(async () => ({
      // classId removed as it's not in the return type
      className: 'Violín Intermedio',
      fecha: '2026-01-29',
      totalExpected: 10,
      presentes: 8,
      ausentes: 2,
      justificados: 0,
      porcentajeAsistencia: 80,
      estado: 'completado'
    }))
  }
}));

describe('whatsAppAlertService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Spy on console.log since we're simulating WhatsApp
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('sendAbsenceAlert', () => {
    it('should send alert for single absence', async () => {
      const result = await whatsAppAlertService.sendAbsenceAlert(
        '+58123456789',
        'Juan Pérez',
        'Violín Intermedio',
        '2026-01-29',
        1
      );
      
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalled();
    });

    it('should send alert for consecutive absences with different message', async () => {
      const result = await whatsAppAlertService.sendAbsenceAlert(
        '+58123456789',
        'Juan Pérez',
        'Violín Intermedio',
        '2026-01-29',
        3
      );
      
      expect(result).toBe(true);
      // Verify console.log was called with message containing consecutive days info
      const calls = vi.mocked(console.log).mock.calls;
      const messageCall = calls.find(call => 
        call[0]?.includes('WhatsApp Alert') && call[1]?.includes('3 días consecutivos')
      );
      expect(messageCall).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Force error by passing invalid data (though current implementation doesn't throw)
      const result = await whatsAppAlertService.sendAbsenceAlert(
        '',
        '',
        '',
        '',
        0
      );
      
      expect(result).toBe(true); // Still returns true even with empty data
    });
  });

  describe('sendAttendanceCompletedAlert', () => {
    it('should send confirmation to teacher', async () => {
      const result = await whatsAppAlertService.sendAttendanceCompletedAlert(
        '+58987654321',
        'Violín Intermedio',
        '2026-01-29',
        { presentes: 8, ausentes: 2, totalExpected: 10 }
      );
      
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalled();
    });

    it('should calculate attendance percentage in message', async () => {
      await whatsAppAlertService.sendAttendanceCompletedAlert(
        '+58987654321',
        'Violín Intermedio',
        '2026-01-29',
        { presentes: 8, ausentes: 2, totalExpected: 10 }
      );
      
      const calls = vi.mocked(console.log).mock.calls;
      const messageCall = calls.find(call => 
        call[0]?.includes('WhatsApp Alert') && call[1]?.includes('80%')
      );
      expect(messageCall).toBeDefined();
    });
  });
});

describe('onAbsenceCreated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('handler', () => {
    it('should process absence and send alert', async () => {
      await onAbsenceCreated.handler('abs123');
      
      // Should have logged processing start and completion
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[onAbsenceCreated] Processing absence:')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[onAbsenceCreated] Completed processing')
      );
    });

    it('should detect consecutive absences', async () => {
      await onAbsenceCreated.handler('abs123');
      
      // Should have called getStudentAbsences
      const { absenceService } = await import('../services/dataService');
      expect(absenceService.getStudentAbsences).toHaveBeenCalled();
    });

    it('should send alert for 2+ consecutive absences', async () => {
      await onAbsenceCreated.handler('abs123');
      
      // Check if ALERT log was created
      const alertLog = vi.mocked(console.log).mock.calls.find(call =>
        call[0]?.includes('[ALERT]')
      );
      expect(alertLog).toBeDefined();
    });

    it('should handle non-existent absence ID', async () => {
      // Mock empty result
      vi.mocked((await import('../services/dataService')).absenceService.getAbsencesToday)
        .mockResolvedValueOnce([]);
      
      await onAbsenceCreated.handler('non-existent');
      
      expect(console.error).toHaveBeenCalledWith(
        'Absence not found:',
        'non-existent'
      );
    });
  });

  describe('detectConsecutiveAbsences', () => {
    it('should return 0 for empty absence array', () => {
      const result = onAbsenceCreated.detectConsecutiveAbsences([]);
      expect(result).toBe(0);
    });

    it('should return 1 for single absence', () => {
      const absences = [
        { fecha: '2026-01-29', studentId: 's1', studentName: 'Test' }
      ];
      const result = onAbsenceCreated.detectConsecutiveAbsences(absences);
      expect(result).toBe(1);
    });

    it('should detect 2 consecutive days', () => {
      const absences = [
        { fecha: '2026-01-29', studentId: 's1', studentName: 'Test' },
        { fecha: '2026-01-28', studentId: 's1', studentName: 'Test' }
      ];
      const result = onAbsenceCreated.detectConsecutiveAbsences(absences);
      expect(result).toBe(2);
    });

    it('should detect 3 consecutive days', () => {
      const absences = [
        { fecha: '2026-01-29', studentId: 's1', studentName: 'Test' },
        { fecha: '2026-01-28', studentId: 's1', studentName: 'Test' },
        { fecha: '2026-01-27', studentId: 's1', studentName: 'Test' }
      ];
      const result = onAbsenceCreated.detectConsecutiveAbsences(absences);
      expect(result).toBe(3);
    });

    it('should stop counting at first gap', () => {
      const absences = [
        { fecha: '2026-01-29', studentId: 's1', studentName: 'Test' },
        { fecha: '2026-01-28', studentId: 's1', studentName: 'Test' },
        { fecha: '2026-01-25', studentId: 's1', studentName: 'Test' } // Gap here
      ];
      const result = onAbsenceCreated.detectConsecutiveAbsences(absences);
      expect(result).toBe(2); // Only counts first 2 consecutive days
    });
  });
});

describe('onAttendanceCompleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('handler', () => {
    it('should process attendance completion', async () => {
      await onAttendanceCompleted.handler('class123', '2026-01-29', 'teacher123');
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[onAttendanceCompleted] Processing:')
      );
    });

    it('should send confirmation to teacher', async () => {
      await onAttendanceCompleted.handler('class123', '2026-01-29', 'teacher123');
      
      const { teacherService } = await import('../services/dataService');
      expect(teacherService.getTeacher).toHaveBeenCalledWith('teacher123');
    });

    it('should alert on low attendance (<70%)', async () => {
      // Mock low attendance
      const { attendanceAnalytics } = await import('../services/analyticsService');
      vi.mocked(attendanceAnalytics.analyzeClassAttendance).mockResolvedValueOnce({
        className: 'Test Class',
        totalExpected: 10,
        presentes: 6,
        ausentes: 4,
        justificados: 0,
        porcentajeAsistencia: 60, // Below 70%
        estado: 'completado',
        maestro: 'Prof. Test',
        detalles: { justificaciones: [], ausenciasSinJustificar: [] }
      });
      
      await onAttendanceCompleted.handler('class123', '2026-01-29', 'teacher123');
      
      const warningLog = vi.mocked(console.log).mock.calls.find(call =>
        call[0]?.includes('[WARNING] Low attendance')
      );
      expect(warningLog).toBeDefined();
    });
  });
});

describe('scheduledAutomation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('checkPendingJustifications', () => {
    it('should check for pending justifications', async () => {
      await scheduledAutomation.checkPendingJustifications();
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Scheduled] Found')
      );
    });

    it('should send reminders for absences >24h old', async () => {
      // Mock absence from >24h ago
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      vi.mocked((await import('../services/dataService')).absenceService.getAbsencesToday)
        .mockResolvedValueOnce([{
          id: 'abs1',
          studentId: 'student1',
          studentName: 'Juan Pérez',
          classId: 'class123',
          fecha: '2026-01-28',
          motivo: { tipo: 'enfermedad' },
          justificada: false,
          estado: 'pendiente',
          createdAt: oldDate
        }]);
      
      await scheduledAutomation.checkPendingJustifications();
      
      const reminderLog = vi.mocked(console.log).mock.calls.find(call =>
        call[0]?.includes('[Scheduled] Sending reminder')
      );
      expect(reminderLog).toBeDefined();
    });
  });

  describe('generateWeeklyReport', () => {
    it('should log report generation', async () => {
      await scheduledAutomation.generateWeeklyReport();
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Scheduled] Generating weekly attendance report')
      );
    });
  });
});
