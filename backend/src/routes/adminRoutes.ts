/**
 * Admin API Routes - REST endpoints for admin dashboard
 */

import { Router } from 'express';
import { requireAdminAuth, optionalAdminAuth } from '../middleware/adminAuth';
import {
    contactsController,
    studentsController,
    teachersController,
    roomsController,
    classGroupsController,
    enrollmentsController,
    sessionsController,
    attendanceController,
    templatesController,
    waGroupsController,
    kbController,
    automationsController,
    whatsappSendController,
    triggersController,
    aiController
} from '../controllers';

const router = Router();

// ============================================================
// CONTACTS
// ============================================================
router.get('/contacts', contactsController.list);
router.get('/contacts/:id', contactsController.getById);
router.post('/contacts', requireAdminAuth, contactsController.create);
router.put('/contacts/:id', requireAdminAuth, contactsController.update);
router.delete('/contacts/:id', requireAdminAuth, contactsController.remove);

// ============================================================
// STUDENTS
// ============================================================
router.get('/students', studentsController.list);
router.get('/students/:id', studentsController.getById);
router.post('/students', requireAdminAuth, studentsController.create);
router.put('/students/:id', requireAdminAuth, studentsController.update);
router.delete('/students/:id', requireAdminAuth, studentsController.remove);

// ============================================================
// TEACHERS
// ============================================================
router.get('/teachers', teachersController.list);
router.get('/teachers/:id', teachersController.getById);
router.post('/teachers', requireAdminAuth, teachersController.create);
router.put('/teachers/:id', requireAdminAuth, teachersController.update);
router.delete('/teachers/:id', requireAdminAuth, teachersController.remove);

// ============================================================
// ROOMS
// ============================================================
router.get('/rooms', roomsController.list);

// ============================================================
// CLASS GROUPS
// ============================================================
router.get('/class-groups', classGroupsController.list);
router.get('/class-groups/:id', classGroupsController.getById);
router.get('/class-groups/:id/students', classGroupsController.getStudents);
router.post('/class-groups', requireAdminAuth, classGroupsController.create);
router.put('/class-groups/:id', requireAdminAuth, classGroupsController.update);
router.delete('/class-groups/:id', requireAdminAuth, classGroupsController.remove);

// ============================================================
// ENROLLMENTS
// ============================================================
router.get('/enrollments', enrollmentsController.list);
router.get('/enrollments/:id', enrollmentsController.getById);
router.post('/enrollments', requireAdminAuth, enrollmentsController.create);
router.delete('/enrollments/:id', requireAdminAuth, enrollmentsController.remove);

// ============================================================
// SESSIONS
// ============================================================
router.get('/sessions', sessionsController.list);
router.get('/sessions/by-date', sessionsController.getByDate);
router.get('/sessions/:id', sessionsController.getById);
router.post('/sessions/generate', requireAdminAuth, sessionsController.generate);

// ============================================================
// ATTENDANCE
// ============================================================
router.get('/attendance', attendanceController.list);
router.post('/attendance/mark', requireAdminAuth, attendanceController.mark);
router.get('/attendance/daily-report', attendanceController.dailyReport);
router.get('/attendance/absence-stats', attendanceController.absenceStats);

// ============================================================
// TEMPLATES
// ============================================================
router.get('/templates', templatesController.list);
router.get('/templates/:id', templatesController.getById);
router.post('/templates', requireAdminAuth, templatesController.create);
router.put('/templates/:id', requireAdminAuth, templatesController.update);
router.delete('/templates/:id', requireAdminAuth, templatesController.remove);
router.post('/templates/:id/render', templatesController.render);

// ============================================================
// WHATSAPP GROUPS
// ============================================================
router.get('/wa-groups', waGroupsController.list);
router.get('/wa-groups/:id', waGroupsController.getById);
router.post('/wa-groups', requireAdminAuth, waGroupsController.create);
router.put('/wa-groups/:id', requireAdminAuth, waGroupsController.update);
router.delete('/wa-groups/:id', requireAdminAuth, waGroupsController.remove);
router.post('/wa-groups/:id/toggle-bot', requireAdminAuth, waGroupsController.toggleBot);

// ============================================================
// KNOWLEDGE BASE (Legacy)
// ============================================================
router.get('/kb/index', kbController.getIndex);
router.get('/kb/index/:id', kbController.getById);
router.post('/kb/index', requireAdminAuth, kbController.create);
router.put('/kb/index/:id', requireAdminAuth, kbController.updateIndex);
router.delete('/kb/index/:id', requireAdminAuth, kbController.remove);
router.get('/kb/file', kbController.readKbFile);
router.put('/kb/file', requireAdminAuth, kbController.writeKbFile);

// ============================================================
// KNOWLEDGE BASE RAG (New)
// ============================================================
router.post('/kb/import', requireAdminAuth, kbController.importDocument);
router.get('/kb/docs', kbController.listDocs);
router.get('/kb/docs/:id', kbController.getDoc);
router.delete('/kb/docs/:id', requireAdminAuth, kbController.deleteDoc);
router.post('/kb/docs/:id/reindex', requireAdminAuth, kbController.reindexDoc);
router.get('/kb/docs/:id/chunks', kbController.getDocChunks);
router.post('/kb/ask', kbController.askKB);
router.get('/kb/queries', kbController.getQueries);
router.get('/kb/gaps', kbController.getGaps);
router.get('/kb/stats', kbController.getKBStats);

// ============================================================
// AUTOMATIONS
// ============================================================
router.post('/automations/absences/drafts', requireAdminAuth, automationsController.generateAbsenceDrafts);
router.post('/automations/absences/preview', automationsController.previewAbsenceDraft);

// ============================================================
// WHATSAPP SENDING (requires auth - safety first!)
// ============================================================
router.post('/whatsapp/send', requireAdminAuth, whatsappSendController.send);
router.post('/whatsapp/send-batch', requireAdminAuth, whatsappSendController.sendBatch);
router.post('/whatsapp/send-drafts', requireAdminAuth, whatsappSendController.sendDrafts);

// ============================================================
// TRIGGERS (Bot Activation Keywords)
// ============================================================
// Config & Control
router.get('/triggers/config', triggersController.getConfig);
router.post('/triggers/listener/toggle', requireAdminAuth, triggersController.toggleListener);
router.post('/triggers/require/toggle', requireAdminAuth, triggersController.toggleRequireTrigger);
router.put('/triggers/settings', requireAdminAuth, triggersController.updateSettings);

// CRUD
router.get('/triggers', triggersController.getAll);
router.get('/triggers/:id', triggersController.getById);
router.post('/triggers', requireAdminAuth, triggersController.create);
router.put('/triggers/:id', requireAdminAuth, triggersController.update);
router.delete('/triggers/:id', requireAdminAuth, triggersController.remove);
router.post('/triggers/:id/toggle', requireAdminAuth, triggersController.toggle);

// Bulk Operations
router.post('/triggers/enable-all', requireAdminAuth, triggersController.enableAll);
router.post('/triggers/disable-all', requireAdminAuth, triggersController.disableAll);
router.post('/triggers/import', requireAdminAuth, triggersController.importTriggers);
router.get('/triggers/export', triggersController.exportTriggers);

// Stats & Testing
router.get('/triggers/stats', triggersController.getStats);
router.post('/triggers/stats/reset', requireAdminAuth, triggersController.resetStats);
router.post('/triggers/test', triggersController.testMessage);

// ============================================================
// AI FEATURES (Gemini-powered)
// ============================================================
router.post('/ai/generate-template', requireAdminAuth, aiController.generateTemplate);
router.post('/ai/generate-variation', requireAdminAuth, aiController.generateVariation);

export default router;
