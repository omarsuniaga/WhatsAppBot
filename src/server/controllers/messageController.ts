import { Request, Response } from 'express';
import BotService from '../services/botService';

export const sendText = async (req: Request, res: Response): Promise<void> => {
    try {
        const { number, message } = req.body;

        if (!number || !message) {
            res.status(400).json({
                success: false,
                error: 'number and message are required'
            });
            return;
        }

        const botService = BotService.getInstance();
        const result = await botService.sendText(number, message);

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const sendMedia = async (req: Request, res: Response): Promise<void> => {
    try {
        const { number, mediaUrl, caption } = req.body;

        if (!number || !mediaUrl) {
            res.status(400).json({
                success: false,
                error: 'number and mediaUrl are required'
            });
            return;
        }

        const botService = BotService.getInstance();
        const result = await botService.sendMedia(number, mediaUrl, caption || '');

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const sendFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { number, fileUrl } = req.body;

        if (!number || !fileUrl) {
            res.status(400).json({
                success: false,
                error: 'number and fileUrl are required'
            });
            return;
        }

        const botService = BotService.getInstance();
        const result = await botService.sendFile(number, fileUrl);

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const sendLocation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { number, latitude, longitude } = req.body;

        if (!number || !latitude || !longitude) {
            res.status(400).json({
                success: false,
                error: 'number, latitude, and longitude are required'
            });
            return;
        }

        const botService = BotService.getInstance();
        const result = await botService.sendLocation(number, latitude, longitude);

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const sendContact = async (req: Request, res: Response): Promise<void> => {
    try {
        const { number, contactNumber, displayName } = req.body;

        if (!number || !contactNumber || !displayName) {
            res.status(400).json({
                success: false,
                error: 'number, contactNumber, and displayName are required'
            });
            return;
        }

        const botService = BotService.getInstance();
        const result = await botService.sendContact(number, contactNumber, displayName);

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const sendPoll = async (req: Request, res: Response): Promise<void> => {
    try {
        const { number, question, options } = req.body;

        if (!number || !question || !options || !Array.isArray(options)) {
            res.status(400).json({
                success: false,
                error: 'number, question, and options (array) are required'
            });
            return;
        }

        const botService = BotService.getInstance();
        const result = await botService.sendPoll(number, question, options);

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const sendSticker = async (req: Request, res: Response): Promise<void> => {
    try {
        const { number, stickerUrl, pack, author } = req.body;

        if (!number || !stickerUrl) {
            res.status(400).json({
                success: false,
                error: 'number and stickerUrl are required'
            });
            return;
        }

        const botService = BotService.getInstance();
        const result = await botService.sendSticker(number, stickerUrl, { pack, author });

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
