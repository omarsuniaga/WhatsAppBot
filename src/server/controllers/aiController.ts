import { Request, Response } from 'express';
import BotService from '../services/botService';
import { BotOrchestrator } from '../../agents/BotOrchestrator';

/**
 * Get AI configuration status
 */
export const getAIConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const config = orchestrator.getConfig();
        const hasApiKey = !!config.geminiApiKey;

        res.json({
            success: true,
            configured: hasApiKey,
            maskedKey: hasApiKey ? `***${config.geminiApiKey?.slice(-4) || ''}` : null,
            settings: {
                useGeminiFallback: config.settings.useGeminiFallback,
                minConfidenceForQA: config.settings.minConfidenceForQA
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Update AI configuration (API Key)
 */
export const updateAIConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const { apiKey } = req.body;

        if (!apiKey) {
            res.status(400).json({
                success: false,
                error: 'apiKey parameter is required'
            });
            return;
        }

        // Validar formato basico de API Key de Google
        if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
            res.status(400).json({
                success: false,
                error: 'API Key invalida. Debe comenzar con "AIza" y tener al menos 30 caracteres'
            });
            return;
        }

        const botService = BotService.getInstance();
        await botService.updateGeminiApiKey(apiKey);

        res.json({
            success: true,
            message: 'AI Config updated successfully',
            configured: true
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
