/**
 * AI Routes - Generate templates and variations
 */

import { Router, Request, Response } from 'express';
import { aiService } from '../services/AiService';

const router = Router();

/**
 * POST /api/ai/generate-template
 * Generate a new template with AI
 * 
 * Body:
 * {
 *   purpose: string (recordatorio, bienvenida, confirmacion, promocion, personalizado)
 *   tone: string (formal, amigable, profesional, casual)
 *   additionalContext?: string (optional context)
 *   targetAudience?: string (optional target audience)
 * }
 */
router.post('/generate-template', async (req: Request, res: Response) => {
    try {
        const { purpose, tone, additionalContext, targetAudience } = req.body;

        if (!purpose || !tone) {
            return res.status(400).json({
                success: false,
                error: 'purpose and tone are required',
            });
        }

        const template = await aiService.generateTemplate({
            purpose,
            tone,
            additionalContext,
            targetAudience,
        });

        res.json({
            success: true,
            message: 'Template generated successfully',
            data: {
                template,
            },
        });
    } catch (error: any) {
        console.error('[AI Routes] Error generating template:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate template',
        });
    }
});

/**
 * POST /api/ai/generate-variation
 * Generate a variation of an existing template
 * 
 * Body:
 * {
 *   baseContent: string (original message)
 *   baseName: string (original name)
 *   newTone: string (tone to apply: formal, amigable, conciso, etc)
 *   purpose?: string (optional purpose for context)
 * }
 */
router.post('/generate-variation', async (req: Request, res: Response) => {
    try {
        const { baseContent, baseName, newTone, purpose } = req.body;

        if (!baseContent || !baseName || !newTone) {
            return res.status(400).json({
                success: false,
                error: 'baseContent, baseName, and newTone are required',
            });
        }

        const variation = await aiService.generateVariation({
            baseContent,
            baseName,
            newTone,
            purpose,
        });

        res.json({
            success: true,
            message: 'Variation generated successfully',
            data: {
                variation,
            },
        });
    } catch (error: any) {
        console.error('[AI Routes] Error generating variation:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate variation',
        });
    }
});

export default router;
