/**
 * Institutional Routes - API endpoints for institutional data management
 * 
 * Routes:
 * - /api/contacts - Contact CRUD
 * - /api/students - Student CRUD
 * - /api/templates - Template CRUD + rendering
 * - /api/attendance - Attendance records
 */

import { Router } from 'express';
import {
    // Contacts
    getContacts,
    getContactById,
    createContact,
    updateContact,
    deleteContact,
    
    // Students
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    getStudentMetadata,
    
    // Templates
    getTemplates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    renderTemplate,
    previewTemplate,
    
    // Attendance
    getAttendance,
    recordAttendance,
    importAttendance,
    getStudentAttendanceSummary,
    getAttendanceStats,
    getStudentsAtRisk,
    
    // Automations
    generateAbsenceDrafts,
    getAbsenceTemplates,
    previewAutomationDraft
} from '../controllers/institutionalController';

const router = Router();

// ==========================================
// CONTACTS ROUTES
// ==========================================

/**
 * GET /api/contacts
 * Query params: status, type, search
 */
router.get('/contacts', getContacts);

/**
 * GET /api/contacts/:id
 */
router.get('/contacts/:id', getContactById);

/**
 * POST /api/contacts
 * Body: { firstName, lastName, displayName?, phones[], email?, type?, notes?, tags[] }
 */
router.post('/contacts', createContact);

/**
 * PUT /api/contacts/:id
 * Body: Partial<Contact>
 */
router.put('/contacts/:id', updateContact);

/**
 * DELETE /api/contacts/:id
 */
router.delete('/contacts/:id', deleteContact);

// ==========================================
// STUDENTS ROUTES
// ==========================================

/**
 * GET /api/students
 * Query params: status, ensemble, instrument, search
 */
router.get('/students', getStudents);

/**
 * GET /api/students/metadata
 * Returns available ensembles and instruments
 */
router.get('/students/metadata', getStudentMetadata);

/**
 * GET /api/students/:id
 */
router.get('/students/:id', getStudentById);

/**
 * POST /api/students
 * Body: { firstName, lastName, dateOfBirth?, instruments[], ensembles[], contactIds[], notes?, tags[] }
 */
router.post('/students', createStudent);

/**
 * PUT /api/students/:id
 * Body: Partial<Student>
 */
router.put('/students/:id', updateStudent);

/**
 * DELETE /api/students/:id
 */
router.delete('/students/:id', deleteStudent);

// ==========================================
// TEMPLATES ROUTES
// ==========================================

/**
 * GET /api/templates
 * Query params: category, active, search
 */
router.get('/templates', getTemplates);

/**
 * POST /api/templates/preview
 * Body: { body, variables? }
 * Preview a template without saving
 */
router.post('/templates/preview', previewTemplate);

/**
 * GET /api/templates/:id
 */
router.get('/templates/:id', getTemplateById);

/**
 * POST /api/templates
 * Body: { name, body, category, description?, tags[] }
 */
router.post('/templates', createTemplate);

/**
 * PUT /api/templates/:id
 * Body: Partial<Template>
 */
router.put('/templates/:id', updateTemplate);

/**
 * DELETE /api/templates/:id
 */
router.delete('/templates/:id', deleteTemplate);

/**
 * POST /api/templates/:id/render
 * Body: { variables: { key: value, ... } }
 * Render a template with provided variables
 */
router.post('/templates/:id/render', renderTemplate);

// ==========================================
// ATTENDANCE ROUTES
// ==========================================

/**
 * GET /api/attendance
 * Query params: date, startDate, endDate, studentId
 */
router.get('/attendance', getAttendance);

/**
 * POST /api/attendance
 * Body: { date, studentId, status, classId?, ensembleId?, arrivalTime?, notes? }
 * Record single attendance entry
 */
router.post('/attendance', recordAttendance);

/**
 * POST /api/attendance/import
 * Body: { records: [{ date, studentId, status, ... }, ...] }
 * Bulk import attendance records
 */
router.post('/attendance/import', importAttendance);

/**
 * GET /api/attendance/summary/:studentId
 * Query params: startDate, endDate
 * Get attendance summary for a student
 */
router.get('/attendance/summary/:studentId', getStudentAttendanceSummary);

/**
 * GET /api/attendance/stats
 * Query params: days (default: 7)
 * Get absence statistics for all students
 */
router.get('/attendance/stats', getAttendanceStats);

/**
 * GET /api/attendance/at-risk
 * Query params: days (default: 7), threshold (default: 2)
 * Get students with absences >= threshold
 */
router.get('/attendance/at-risk', getStudentsAtRisk);

// ==========================================
// AUTOMATIONS ROUTES
// ==========================================

/**
 * GET /api/automations/templates/absences
 * Get templates suitable for absence notifications
 */
router.get('/automations/templates/absences', getAbsenceTemplates);

/**
 * POST /api/automations/drafts/absences
 * Body: { days, threshold, templateId, includeStudentsWithoutContacts? }
 * Generate notification drafts for students with excessive absences
 */
router.post('/automations/drafts/absences', generateAbsenceDrafts);

/**
 * POST /api/automations/drafts/preview
 * Body: { studentId, contactId, templateId }
 * Preview a single draft for testing
 */
router.post('/automations/drafts/preview', previewAutomationDraft);

export default router;
