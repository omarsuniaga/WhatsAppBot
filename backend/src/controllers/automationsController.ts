/**
 * Automations Controller - Generate and manage automation drafts
 */

import { Request, Response } from 'express';
import AutomationService from '../../../src/server/services/automationService';

const automationService = AutomationService.getInstance();

/**
 * Generate absence notification drafts
 * POST /api/admin/automations/absences/drafts
 */
export const generateAbsenceDrafts = async (req: Request, res: Response) => {
    try {
        const { days, threshold, templateId, includeStudentsWithoutContacts } = req.body;

        // Validate required fields
        if (!days || !threshold) {
            return res.status(400).json({
                success: false,
                error: 'days and threshold are required'
            });
        }

        if (typeof days !== 'number' || days < 1 || days > 365) {
            return res.status(400).json({
                success: false,
                error: 'days must be a number between 1 and 365'
            });
        }

        if (typeof threshold !== 'number' || threshold < 1) {
            return res.status(400).json({
                success: false,
                error: 'threshold must be a positive number'
            });
        }

        const result = await automationService.generateAbsenceDrafts({
            days,
            threshold,
            templateId,
            includeStudentsWithoutContacts
        });

        res.json({
            success: result.success,
            data: result
        });
    } catch (error: any) {
        console.error('[AutomationsController] Error generating absence drafts:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Preview a single draft (dry run for one student)
 * POST /api/admin/automations/absences/preview
 */
export const previewAbsenceDraft = async (req: Request, res: Response) => {
    try {
        const { studentId, contactId, templateId } = req.body;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                error: 'studentId is required'
            });
        }

        // Use the preview function from the new service
        // Note: The new service signature might differ slightly, check AutomationService.ts
        if (!contactId || !templateId) {
             return res.status(400).json({
                success: false,
                error: 'studentId, contactId, and templateId are required for preview'
            });
        }

        const draft = await automationService.previewDraft(studentId, contactId, templateId);

        if (!draft) {
            return res.json({
                success: true,
                data: null,
                message: 'No preview generated'
            });
        }

        res.json({
            success: true,
            data: draft
        });
    } catch (error: any) {
        console.error('[AutomationsController] Error previewing draft:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
