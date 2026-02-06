import { Request, Response } from 'express';
import BotService from '../services/botService';

export const getStatus = (req: Request, res: Response): void => {
    const botService = BotService.getInstance();

    res.json({
        success: true,
        data: {
            status: botService.getConnectionStatus(),
            hasQR: botService.getCurrentQR() !== null
        }
    });
};

export const getQR = (req: Request, res: Response): void => {
    const botService = BotService.getInstance();
    const qr = botService.getCurrentQR();

    if (!qr) {
        res.status(404).json({
            success: false,
            error: 'No QR code available'
        });
        return;
    }

    res.json({
        success: true,
        data: { qr }
    });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        const botService = BotService.getInstance();
        const bot = botService.getBot();

        if (bot) {
            await (bot as any).clearSessionAndRestart();
        }

        res.json({
            success: true,
            message: 'Session cleared, reconnecting...'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
