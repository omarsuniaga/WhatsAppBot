import { Request, Response } from 'express';
import BotService from '../services/botService';

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

        const botService = BotService.getInstance();
        await botService.updateGeminiApiKey(apiKey);

        res.json({
            success: true,
            message: 'AI Config updated successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
