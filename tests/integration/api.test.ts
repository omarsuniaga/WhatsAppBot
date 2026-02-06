/**
 * Integration Tests for API Endpoints
 * Testing full request/response cycle
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// Mock Express app setup
const mockRequest = (path: string, params: any = {}, body: any = {}) => ({
  params,
  body,
  query: {},
  path
});

const mockResponse = () => {
  const res: any = {
    statusCode: 200,
    data: null
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((data: any) => {
    res.data = data;
    return res;
  });
  return res;
};

// Mock services
vi.mock('../../firebaseConfig', () => ({
  db: {
    collection: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn(() => ({
          empty: false,
          docs: [
            {
              id: 'test123',
              data: () => ({
                nombre: 'Test',
                apellido: 'Student',
                grupo: 'orquesta-a'
              })
            }
          ]
        }))
      })),
      get: vi.fn(() => ({
        empty: false,
        docs: []
      }))
    }))
  }
}));

describe('API Integration Tests', () => {
  describe('Data Endpoints', () => {
    describe('GET /api/data/students', () => {
      it('should return list of students', async () => {
        const { dataController } = await import('../../src/server/controllers/dataController');
        const req = mockRequest('/api/data/students');
        const res = mockResponse();
        
        await dataController.getAllStudents(req as any, res as any);
        
        expect(res.statusCode).toBe(200);
        expect(res.data).toBeDefined();
        expect(res.data.success).toBe(true);
        expect(Array.isArray(res.data.data)).toBe(true);
      });
    });

    describe('GET /api/data/students/group/:groupId', () => {
      it('should return students filtered by group', async () => {
        const { dataController } = await import('../../src/server/controllers/dataController');
        const req = mockRequest('/api/data/students/group/orquesta-a', { groupId: 'orquesta-a' });
        const res = mockResponse();
        
        await dataController.getStudentsByGroup(req as any, res as any);
        
        expect(res.statusCode).toBe(200);
        expect(res.data.success).toBe(true);
        expect(Array.isArray(res.data.data)).toBe(true);
      });
    });

    describe('GET /api/data/students/:id', () => {
      it('should return specific student', async () => {
        const { dataController } = await import('../../src/server/controllers/dataController');
        const req = mockRequest('/api/data/students/test123', { id: 'test123' });
        const res = mockResponse();
        
        await dataController.getStudent(req as any, res as any);
        
        expect(res.statusCode).toBe(200);
        expect(res.data.success).toBe(true);
        expect(res.data.data).toBeDefined();
      });

      it('should return 404 for non-existent student', async () => {
        const { dataController } = await import('../../src/server/controllers/dataController');
        const req = mockRequest('/api/data/students/non-existent', { id: 'non-existent' });
        const res = mockResponse();
        
        // Mock null response
        vi.mocked((await import('../services/dataService')).studentService.getStudent)
          .mockResolvedValueOnce(null);
        
        await dataController.getStudent(req as any, res as any);
        
        expect(res.statusCode).toBe(404);
      });
    });

    describe('GET /api/data/classes/today/:date', () => {
      it('should return classes for specific date', async () => {
        const { dataController } = await import('../../src/server/controllers/dataController');
        const req = mockRequest('/api/data/classes/today/2026-01-29', { date: '2026-01-29' });
        const res = mockResponse();
        
        await dataController.getClassesToday(req as any, res as any);
        
        expect(res.statusCode).toBe(200);
        expect(res.data.success).toBe(true);
        expect(Array.isArray(res.data.data)).toBe(true);
      });
    });
  });

  describe('Analytics Endpoints', () => {
    describe('GET /api/analytics/classes/:classId/date/:date', () => {
      it('should return class attendance analysis', async () => {
        const { analyticsController } = await import('../../src/server/controllers/analyticsController');
        const req = mockRequest(
          '/api/analytics/classes/class123/date/2026-01-29',
          { classId: 'class123', date: '2026-01-29' }
        );
        const res = mockResponse();
        
        await analyticsController.analyzeClass(req as any, res as any);
        
        expect(res.statusCode).toBe(200);
        expect(res.data).toBeDefined();
        expect(res.data).toHaveProperty('classId');
        expect(res.data).toHaveProperty('porcentajeAsistencia');
      });
    });

    describe('GET /api/analytics/day/:date', () => {
      it('should return daily analytics summary', async () => {
        const { analyticsController } = await import('../../src/server/controllers/analyticsController');
        const req = mockRequest('/api/analytics/day/2026-01-29', { date: '2026-01-29' });
        const res = mockResponse();
        
        await analyticsController.analyzeDay(req as any, res as any);
        
        expect(res.statusCode).toBe(200);
        expect(res.data).toBeDefined();
        expect(res.data).toHaveProperty('fecha');
        expect(res.data).toHaveProperty('overallPercentage');
        expect(res.data).toHaveProperty('classesSummary');
      });
    });

    describe('GET /api/analytics/discrepancies/:classId/date/:date', () => {
      it('should detect discrepancies', async () => {

        const { analyticsController } = await import('../../src/server/controllers/analyticsController');
        const req = mockRequest(
          '/api/analytics/discrepancies/class123/date/2026-01-29',
          { classId: 'class123', date: '2026-01-29' }
        );
        const res = mockResponse();
        
        await analyticsController.detectDiscrepancies(req as any, res as any);
        
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.data)).toBe(true);
      });
    });
  });

  describe('Automation Endpoints', () => {
    describe('POST /api/automations/trigger/absence-created', () => {
      it('should trigger absence creation automation', async () => {
        const { automationController } = await import('../../src/server/controllers/automationController');
        const req = mockRequest(
          '/api/automations/trigger/absence-created',
          {},
          { absenceId: 'abs123' }
        );
        const res = mockResponse();
        
        await automationController.triggerAbsenceCreated(req as any, res as any);
        
        expect(res.statusCode).toBe(200);
        expect(res.data.success).toBe(true);
      });

      it('should return 400 when absenceId is missing', async () => {
        const { automationController } = await import('../../src/server/controllers/automationController');
        const req = mockRequest('/api/automations/trigger/absence-created', {}, {});
        const res = mockResponse();
        
        await automationController.triggerAbsenceCreated(req as any, res as any);
        
        expect(res.statusCode).toBe(400);
        expect(res.data.success).toBe(false);
      });
    });

    describe('POST /api/automations/trigger/attendance-completed', () => {
      it('should trigger attendance completion automation', async () => {
        const { automationController } = await import('../../src/server/controllers/automationController');
        const req = mockRequest(
          '/api/automations/trigger/attendance-completed',
          {},
          { classId: 'class123', date: '2026-01-29', teacherId: 'teacher123' }
        );
        const res = mockResponse();
        
        await automationController.triggerAttendanceCompleted(req as any, res as any);
        
        expect(res.statusCode).toBe(200);
        expect(res.data.success).toBe(true);
      });

      it('should validate required parameters', async () => {
        const { automationController } = await import('../../src/server/controllers/automationController');
        const req = mockRequest(
          '/api/automations/trigger/attendance-completed',
          {},
          { classId: 'class123' } // Missing date and teacherId
        );
        const res = mockResponse();
        
        await automationController.triggerAttendanceCompleted(req as any, res as any);
        
        expect(res.statusCode).toBe(400);
      });
    });

    describe('POST /api/automations/alerts/send-absence', () => {
      it('should send absence alert', async () => {
        const { automationController } = await import('../../src/server/controllers/automationController');
        const req = mockRequest(
          '/api/automations/alerts/send-absence',
          {},
          {
            recipientPhone: '+58123456789',
            studentName: 'Juan Pérez',
            className: 'Violín',
            date: '2026-01-29'
          }
        );
        const res = mockResponse();
        
        await automationController.sendAbsenceAlert(req as any, res as any);
        
        expect(res.statusCode).toBe(200);
        expect(res.data.success).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const { dataController } = await import('../../src/server/controllers/dataController');
      
      // Mock service to throw error
      vi.mocked((await import('../services/dataService')).studentService.getAll)
        .mockRejectedValueOnce(new Error('Database connection failed'));
      
      const req = mockRequest('/api/data/students');
      const res = mockResponse();
      
      await dataController.getAllStudents(req as any, res as any);
      
      expect(res.statusCode).toBe(500);
      expect(res.data.success).toBe(false);
    });
  });
});

describe('API Response Format', () => {
  it('should return consistent success response format', async () => {
    const { dataController } = await import('../../controllers/dataController');
    const req = mockRequest('/api/data/students');
    const res = mockResponse();
    
    await dataController.getAllStudents(req as any, res as any);
    
    expect(res.data).toHaveProperty('success');
    expect(res.data).toHaveProperty('data');
  });

  it('should return consistent error response format', async () => {
    const { dataController } = await import('../../controllers/dataController');
    
    vi.mocked((await import('../services/dataService')).studentService.getAll)
      .mockRejectedValueOnce(new Error('Test error'));
    
    const req = mockRequest('/api/data/students');
    const res = mockResponse();
    
    await dataController.getAllStudents(req as any, res as any);
    
    expect(res.data).toHaveProperty('success', false);
    expect(res.data).toHaveProperty('error');
  });
});
