import { describe, it, expect, vi, beforeEach } from 'vitest';

const analyticsMocks = vi.hoisted(() => ({
  attendanceAnalytics: {
    analyzeClassAttendance: vi.fn(),
    analyzeDayAttendance: vi.fn()
  },
  absenceProcessing: {
    detectDiscrepancies: vi.fn(),
    preFillJustifications: vi.fn()
  }
}));

vi.mock('../services/analyticsService', () => analyticsMocks);

const mockResponse = () => {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
};

describe('analyticsController API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps analyzeClass response in success/data', async () => {
    analyticsMocks.attendanceAnalytics.analyzeClassAttendance.mockResolvedValueOnce({
      classId: 'class-1',
      porcentajeAsistencia: 95
    });

    const { analyticsController } = await import('./analyticsController');
    const req: any = { params: { classId: 'class-1', date: '2026-02-10' } };
    const res = mockResponse();

    await analyticsController.analyzeClass(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.classId).toBe('class-1');
  });

  it('returns fallback success/data when Firebase is unavailable', async () => {
    analyticsMocks.attendanceAnalytics.analyzeDayAttendance.mockRejectedValueOnce(
      new Error('Firebase Admin not initialized')
    );

    const { analyticsController } = await import('./analyticsController');
    const req: any = { params: { date: '2026-02-10' } };
    const res = mockResponse();

    await analyticsController.analyzeDay(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fecha).toBe('2026-02-10');
    expect(res.body.data._warning).toBeDefined();
  });

  it('returns 500 with success false on generic analyzeDay error', async () => {
    analyticsMocks.attendanceAnalytics.analyzeDayAttendance.mockRejectedValueOnce(
      new Error('Unexpected downstream failure')
    );

    const { analyticsController } = await import('./analyticsController');
    const req: any = { params: { date: '2026-02-10' } };
    const res = mockResponse();

    await analyticsController.analyzeDay(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Unexpected downstream failure');
  });
});
