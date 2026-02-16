import { describe, it, expect, vi, beforeEach } from 'vitest';

const dataServiceMocks = vi.hoisted(() => ({
  studentService: {
    getAllStudents: vi.fn(),
    getStudentsByGroup: vi.fn(),
    getStudent: vi.fn(),
    createStudent: vi.fn(),
    updateStudent: vi.fn(),
    deleteStudent: vi.fn()
  },
  classService: {
    getAllClasses: vi.fn(),
    getClassesToday: vi.fn(),
    getClass: vi.fn()
  },
  attendanceService: {
    getAttendancesToday: vi.fn(),
    getAttendancesByDateRange: vi.fn(),
    getAttendance: vi.fn(),
    updateAttendance: vi.fn()
  },
  absenceService: {
    getAbsencesToday: vi.fn()
  },
  teacherService: {
    getAllTeachers: vi.fn()
  },
  contactService: {
    getAllContacts: vi.fn()
  }
}));

vi.mock('../services/dataService', () => dataServiceMocks);

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

describe('dataController contract and input guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when classes date is invalid', async () => {
    const { dataController } = await import('./dataController');
    const req: any = { params: { date: '2026/02/10' }, query: {}, body: {} };
    const res = mockResponse();

    await dataController.getClassesToday(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('YYYY-MM-DD');
  });

  it('returns 400 when attendance range has startDate after endDate', async () => {
    const { dataController } = await import('./dataController');
    const req: any = {
      params: {},
      query: { startDate: '2026-02-11', endDate: '2026-02-10' },
      body: {}
    };
    const res = mockResponse();

    await dataController.getAttendancesByRange(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('cannot be greater');
  });

  it('returns 400 when updateAttendance body is empty', async () => {
    const { dataController } = await import('./dataController');
    const req: any = { params: { id: 'att-1' }, query: {}, body: {} };
    const res = mockResponse();

    await dataController.updateAttendance(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when updateAttendance target does not exist', async () => {
    dataServiceMocks.attendanceService.getAttendance.mockResolvedValueOnce(null);

    const { dataController } = await import('./dataController');
    const req: any = { params: { id: 'att-404' }, query: {}, body: { estado: 'presente' } };
    const res = mockResponse();

    await dataController.updateAttendance(req, res);

    expect(dataServiceMocks.attendanceService.getAttendance).toHaveBeenCalledWith('att-404');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Attendance not found');
  });

  it('returns success/data on valid getAttendancesByRange', async () => {
    dataServiceMocks.attendanceService.getAttendancesByDateRange.mockResolvedValueOnce([
      { id: 'a1', fecha: '2026-02-10' }
    ]);

    const { dataController } = await import('./dataController');
    const req: any = {
      params: {},
      query: { startDate: '2026-02-01', endDate: '2026-02-10' },
      body: {}
    };
    const res = mockResponse();

    await dataController.getAttendancesByRange(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
