/**
 * Institutional Controller - CRUD endpoints for institutional data
 * 
 * Handles:
 * - /api/contacts - Contact management
 * - /api/students - Student management
 * - /api/templates - Template management
 * - /api/attendance - Attendance records
 */

import { Request, Response } from 'express';
import Logger from '../services/loggerService';
import { ContactsRepository } from '../persistence/ContactsRepository';
import { StudentsRepository } from '../persistence/StudentsRepository';
import { TemplatesRepository } from '../persistence/TemplatesRepository';
import { AttendanceRepository } from '../persistence/AttendanceRepository';
import { IdentityService } from '../services/identityService';
import { TemplateService } from '../services/templateService';
import { AttendanceService } from '../services/attendanceService';
import AutomationService from '../services/automationService';
import type { Contact, Student, Template, AttendanceStatus } from '../types/entities';
import { getErrorMessage } from '../utils/errorUtils';

// ==========================================
// CONTACTS
// ==========================================

export const getContacts = async (req: Request, res: Response) => {
    try {
        const repo = ContactsRepository.getInstance();
        const { status, type, search } = req.query;

        let contacts: Contact[];

        if (search && typeof search === 'string') {
            contacts = await repo.search(search);
        } else if (status && typeof status === 'string') {
            contacts = await repo.findByStatus(status as Contact['status']);
        } else if (type && typeof type === 'string') {
            contacts = await repo.findByType(type as Contact['type']);
        } else {
            contacts = await repo.findAll();
        }

        res.json({
            success: true,
            data: contacts,
            count: contacts.length
        });
    } catch (error: unknown) {
        Logger.error('[Contacts] Error fetching contacts:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const getContactById = async (req: Request, res: Response) => {
    try {
        const repo = ContactsRepository.getInstance();
        const contact = await repo.findById(req.params.id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                error: 'Contact not found'
            });
        }

        res.json({
            success: true,
            data: contact
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const createContact = async (req: Request, res: Response) => {
    try {
        const repo = ContactsRepository.getInstance();
        const identityService = IdentityService.getInstance();

        const {
            firstName,
            lastName,
            displayName,
            phones = [],
            email,
            type = 'parent',
            notes,
            tags = []
        } = req.body;

        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                error: 'firstName and lastName are required'
            });
        }

        // Normalize phone numbers
        const normalizedPhones = phones
            .map((p: string) => identityService.normalizePhone(p))
            .filter((p: string) => p);

        const contact = await repo.create({
            firstName,
            lastName,
            displayName,
            phones: normalizedPhones,
            email,
            type,
            status: 'active',
            whatsappVerified: false,
            studentIds: [],
            notes,
            tags,
            notificationPreferences: {
                enabled: true,
                channels: ['whatsapp']
            }
        });

        // Index phones
        for (const phone of normalizedPhones) {
            await identityService.linkPhoneToContact(contact.id, phone, 'manual');
        }

        res.status(201).json({
            success: true,
            data: contact
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const updateContact = async (req: Request, res: Response) => {
    try {
        const repo = ContactsRepository.getInstance();
        const identityService = IdentityService.getInstance();
        const { id } = req.params;

        const existing = await repo.findById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'Contact not found'
            });
        }

        // Normalize phones if provided
        const updates = { ...req.body };
        if (updates.phones) {
            updates.phones = updates.phones
                .map((p: string) => identityService.normalizePhone(p))
                .filter((p: string) => p);
        }

        const contact = await repo.update(id, updates);

        res.json({
            success: true,
            data: contact
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const deleteContact = async (req: Request, res: Response) => {
    try {
        const repo = ContactsRepository.getInstance();
        const deleted = await repo.delete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Contact not found'
            });
        }

        res.json({
            success: true,
            message: 'Contact deleted'
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

// ==========================================
// STUDENTS
// ==========================================

export const getStudents = async (req: Request, res: Response) => {
    try {
        const repo = StudentsRepository.getInstance();
        const { status, ensemble, instrument, search } = req.query;

        let students: Student[];

        if (search && typeof search === 'string') {
            students = await repo.search(search);
        } else if (status && typeof status === 'string') {
            students = await repo.findByStatus(status as Student['status']);
        } else if (ensemble && typeof ensemble === 'string') {
            students = await repo.findByEnsemble(ensemble);
        } else if (instrument && typeof instrument === 'string') {
            students = await repo.findByInstrument(instrument);
        } else {
            students = await repo.findAll();
        }

        res.json({
            success: true,
            data: students,
            count: students.length
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const getStudentById = async (req: Request, res: Response) => {
    try {
        const repo = StudentsRepository.getInstance();
        const student = await repo.findById(req.params.id);

        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }

        res.json({
            success: true,
            data: student
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const createStudent = async (req: Request, res: Response) => {
    try {
        const repo = StudentsRepository.getInstance();

        const {
            firstName,
            lastName,
            dateOfBirth,
            instruments = [],
            ensembles = [],
            contactIds = [],
            notes,
            tags = []
        } = req.body;

        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                error: 'firstName and lastName are required'
            });
        }

        const student = await repo.create({
            firstName,
            lastName,
            dateOfBirth,
            enrollmentDate: new Date().toISOString().split('T')[0],
            status: 'active',
            instruments,
            ensembles,
            contactIds,
            currentClasses: [],
            notes,
            tags
        });

        // Link to contacts if provided
        if (contactIds.length > 0) {
            const contactsRepo = ContactsRepository.getInstance();
            for (const contactId of contactIds) {
                await contactsRepo.addStudent(contactId, student.id);
            }
        }

        res.status(201).json({
            success: true,
            data: student
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const updateStudent = async (req: Request, res: Response) => {
    try {
        const repo = StudentsRepository.getInstance();
        const { id } = req.params;

        const existing = await repo.findById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }

        const student = await repo.update(id, req.body);

        res.json({
            success: true,
            data: student
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const deleteStudent = async (req: Request, res: Response) => {
    try {
        const repo = StudentsRepository.getInstance();
        const deleted = await repo.delete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }

        res.json({
            success: true,
            message: 'Student deleted'
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const getStudentMetadata = async (req: Request, res: Response) => {
    try {
        const repo = StudentsRepository.getInstance();
        
        const [ensembles, instruments] = await Promise.all([
            repo.getEnsembles(),
            repo.getInstruments()
        ]);

        res.json({
            success: true,
            data: {
                ensembles,
                instruments
            }
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

// ==========================================
// TEMPLATES
// ==========================================

export const getTemplates = async (req: Request, res: Response) => {
    try {
        const repo = TemplatesRepository.getInstance();
        const { category, active, search } = req.query;

        let templates: Template[];

        if (search && typeof search === 'string') {
            templates = await repo.search(search);
        } else if (category && typeof category === 'string') {
            templates = await repo.findByCategory(category as Template['category']);
        } else if (active === 'true') {
            templates = await repo.findActive();
        } else {
            templates = await repo.findAll();
        }

        res.json({
            success: true,
            data: templates,
            count: templates.length
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const getTemplateById = async (req: Request, res: Response) => {
    try {
        const repo = TemplatesRepository.getInstance();
        const template = await repo.findById(req.params.id);

        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }

        res.json({
            success: true,
            data: template
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const createTemplate = async (req: Request, res: Response) => {
    try {
        const templateService = TemplateService.getInstance();

        const { name, body, category, description, tags } = req.body;

        if (!name || !body || !category) {
            return res.status(400).json({
                success: false,
                error: 'name, body, and category are required'
            });
        }

        const result = await templateService.createTemplate({
            name,
            body,
            category,
            description,
            tags
        });

        if (!result.success) {
            return res.status(400).json({
                success: false,
                errors: result.errors
            });
        }

        res.status(201).json({
            success: true,
            data: result.template
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const updateTemplate = async (req: Request, res: Response) => {
    try {
        const repo = TemplatesRepository.getInstance();
        const { id } = req.params;

        const existing = await repo.findById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }

        // Validate body if changed
        if (req.body.body) {
            const templateService = TemplateService.getInstance();
            const validation = templateService.validateTemplate(req.body.body);
            
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    errors: validation.errors
                });
            }
        }

        const template = await repo.update(id, req.body);

        res.json({
            success: true,
            data: template
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const deleteTemplate = async (req: Request, res: Response) => {
    try {
        const repo = TemplatesRepository.getInstance();
        const deleted = await repo.delete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }

        res.json({
            success: true,
            message: 'Template deleted'
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const renderTemplate = async (req: Request, res: Response) => {
    try {
        const templateService = TemplateService.getInstance();
        const { id } = req.params;
        const { variables } = req.body;

        const result = await templateService.renderTemplateById(id, variables || {});

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error,
                missingVariables: result.missingVariables
            });
        }

        res.json({
            success: true,
            data: {
                rendered: result.rendered
            }
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const previewTemplate = async (req: Request, res: Response) => {
    try {
        const templateService = TemplateService.getInstance();
        const { body, variables } = req.body;

        if (!body) {
            return res.status(400).json({
                success: false,
                error: 'body is required'
            });
        }

        const validation = templateService.validateTemplate(body);
        const preview = templateService.previewTemplate(body, variables);

        res.json({
            success: true,
            data: {
                preview: preview.rendered,
                validation,
                extractedVariables: templateService.extractVariablesWithMeta(body)
            }
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

// ==========================================
// ATTENDANCE
// ==========================================

export const getAttendance = async (req: Request, res: Response) => {
    try {
        const repo = AttendanceRepository.getInstance();
        const { date, startDate, endDate, studentId } = req.query;

        if (date && typeof date === 'string') {
            const attendance = await repo.getByDate(date);
            return res.json({
                success: true,
                data: attendance
            });
        }

        if (startDate && endDate && typeof startDate === 'string' && typeof endDate === 'string') {
            if (studentId && typeof studentId === 'string') {
                const records = await repo.getStudentAttendance(studentId, startDate, endDate);
                return res.json({
                    success: true,
                    data: records
                });
            }

            const records = await repo.getByDateRange(startDate, endDate);
            return res.json({
                success: true,
                data: records
            });
        }

        // Default: return today's attendance
        const today = await repo.getToday();
        res.json({
            success: true,
            data: today
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const recordAttendance = async (req: Request, res: Response) => {
    try {
        const repo = AttendanceRepository.getInstance();
        const { date, studentId, status, classId, ensembleId, arrivalTime, notes } = req.body;

        if (!date || !studentId || !status) {
            return res.status(400).json({
                success: false,
                error: 'date, studentId, and status are required'
            });
        }

        const validStatuses: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        await repo.recordStudentAttendance(date, studentId, status, {
            classId,
            ensembleId,
            arrivalTime,
            notes
        });

        const updated = await repo.getByDate(date);

        res.json({
            success: true,
            data: updated
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const importAttendance = async (req: Request, res: Response) => {
    try {
        const repo = AttendanceRepository.getInstance();
        const { records } = req.body;

        if (!Array.isArray(records)) {
            return res.status(400).json({
                success: false,
                error: 'records must be an array'
            });
        }

        const result = await repo.importBulk(records);

        res.json({
            success: true,
            data: result
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const getStudentAttendanceSummary = async (req: Request, res: Response) => {
    try {
        const repo = AttendanceRepository.getInstance();
        const { studentId } = req.params;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'startDate and endDate are required'
            });
        }

        const summary = await repo.getStudentSummary(studentId, startDate, endDate);

        res.json({
            success: true,
            data: summary
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * GET /api/attendance/stats
 * Query params: days (default: 7)
 * Returns absence statistics for all students over the specified period
 */
export const getAttendanceStats = async (req: Request, res: Response) => {
    try {
        const attendanceService = AttendanceService.getInstance();
        const days = parseInt(req.query.days as string) || 7;

        if (days < 1 || days > 365) {
            return res.status(400).json({
                success: false,
                error: 'days must be between 1 and 365'
            });
        }

        const stats = await attendanceService.computeAbsenceStats(days);

        res.json({
            success: true,
            data: stats
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * GET /api/attendance/at-risk
 * Query params: days (default: 7), threshold (default: 2)
 * Returns students with absences >= threshold
 */
export const getStudentsAtRisk = async (req: Request, res: Response) => {
    try {
        const attendanceService = AttendanceService.getInstance();
        const days = parseInt(req.query.days as string) || 7;
        const threshold = parseInt(req.query.threshold as string) || 2;

        const atRisk = await attendanceService.getStudentsAtRisk(days, threshold);

        res.json({
            success: true,
            data: {
                days,
                threshold,
                studentsAtRisk: atRisk.length,
                students: atRisk
            }
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

// import { AutomationService } from '../services/automationService';

// ==========================================
// AUTOMATIONS
// ==========================================

/**
 * POST /api/automations/drafts/absences
 * Body: { days, threshold, templateId, includeStudentsWithoutContacts? }
 * Generates notification drafts for students with excessive absences
 */
export const generateAbsenceDrafts = async (req: Request, res: Response) => {
    try {
        const automationService = AutomationService.getInstance();
        const { days, threshold, templateId, includeStudentsWithoutContacts } = req.body;

        // Validate required fields
        if (!days || !threshold) {
            return res.status(400).json({
                success: false,
                error: 'days, and threshold are required'
            });
        }
        
        // Use default template if none provided
        const safeTemplateId = templateId || 'default-absence';

        // Validate ranges
        const daysNum = parseInt(days as string);
        const thresholdNum = parseInt(threshold as string);

        if (daysNum < 1 || daysNum > 365) {
            return res.status(400).json({
                success: false,
                error: 'days must be between 1 and 365'
            });
        }

        if (thresholdNum < 1 || thresholdNum > 30) {
            return res.status(400).json({
                success: false,
                error: 'threshold must be between 1 and 30'
            });
        }

        const result = await automationService.generateAbsenceDrafts({
            days: daysNum,
            threshold: thresholdNum,
            templateId: safeTemplateId,
            includeStudentsWithoutContacts: includeStudentsWithoutContacts || false
        });

        res.json({
            success: result.success,
            data: result
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * GET /api/automations/templates/absences
 * Returns templates suitable for absence notifications
 */
export const getAbsenceTemplates = async (req: Request, res: Response) => {
    try {
        const automationService = AutomationService.getInstance();
        const templates = await automationService.getAbsenceTemplates();

        res.json({
            success: true,
            data: templates
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * POST /api/automations/drafts/preview
 * Body: { studentId, contactId, templateId }
 * Preview a single draft for testing
 */
export const previewAutomationDraft = async (req: Request, res: Response) => {
    try {
        const automationService = AutomationService.getInstance();
        const { studentId, contactId, templateId } = req.body;

        if (!studentId || !contactId || !templateId) {
            return res.status(400).json({
                success: false,
                error: 'studentId, contactId, and templateId are required'
            });
        }

        const draft = await automationService.previewDraft(studentId, contactId, templateId);

        if (!draft) {
            return res.status(404).json({
                success: false,
                error: 'Could not generate preview - student, contact, or template not found'
            });
        }

        res.json({
            success: true,
            data: draft
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

