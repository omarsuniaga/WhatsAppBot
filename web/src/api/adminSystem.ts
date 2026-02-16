
import { api } from './client';

export interface DashboardSummary {
    fecha: string;
    clasesToday: number;
    classesCompleted: number;
    classesInProgress: number;
    totalStudentsExpected: number;
    totalPresent: number;
    totalAbsent: number;
    totalJustified: number;
    overallPercentage: number;
    pendingJustifications: any[];
}

export const dataApi = {
    // Student endpoints
    getAllStudents: () => api.get('/data/students'),
    getStudentsByGroup: (groupId: string) => api.get(`/data/students/group/${groupId}`),
    getStudent: (id: string) => api.get(`/data/students/${id}`),

    // Class endpoints
    getAllClasses: () => api.get('/data/classes'),
    getClassesToday: (date: string) => api.get(`/data/classes/today/${date}`),
    getClass: (id: string) => api.get(`/data/classes/${id}`),

    // Attendance endpoints
    getAttendancesToday: (date: string) => api.get(`/data/attendance/today/${date}`),
    getAttendancesByRange: (startDate: string, endDate: string) =>
        api.get('/data/attendance/range', { params: { startDate, endDate } }),
    updateAttendance: (id: string, data: any) => api.put(`/data/attendance/${id}`, data),

    // Absence endpoints
    getAbsencesToday: (date: string) => api.get(`/data/absences/today/${date}`),

    // Contact endpoints
    getAllContacts: () => api.get('/data/contacts'),

    // Teacher endpoints
    getAllTeachers: () => api.get('/data/teachers'),
};

export const analyticsApi = {
    analyzeClass: (classId: string, date: string) => 
        api.get(`/analytics/classes/${classId}/date/${date}`),
    
    analyzeDay: (date: string) => 
        api.get(`/analytics/day/${date}`),
    
    detectDiscrepancies: (classId: string, date: string) =>
        api.get(`/analytics/discrepancies/${classId}/date/${date}`),
        
    preFillJustifications: (classId: string, date: string) =>
        api.get(`/analytics/prefill/${classId}/date/${date}`),
};
