import { Request, Response } from 'express';
import BotService from '../services/botService';
import { getErrorMessage } from '../utils/errorUtils';

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
    } catch (error: unknown) {
        if (getErrorMessage(error).includes('Connection is not ready')) {
            res.status(503).json({
                success: false,
                error: 'WhatsApp connection is not ready',
                hint: 'Scan QR and wait until status is connected'
            });
            return;
        }

        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const sendMedia = async (req: Request, res: Response): Promise<void> => {
    try {
        const { number, caption } = req.body;
        // Priority: uploaded file > mediaUrl in body
        const mediaPath = req.file?.path || req.body.mediaUrl;

        if (!number || !mediaPath) {
            res.status(400).json({
                success: false,
                error: 'number and media (file or mediaUrl) are required'
            });
            return;
        }

        const botService = BotService.getInstance();
        const result = await botService.sendMedia(number, mediaPath, caption || '');

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

export const sendFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { number } = req.body;
        // Priority: uploaded file > fileUrl in body
        const filePath = req.file?.path || req.body.fileUrl;

        if (!number || !filePath) {
            res.status(400).json({
                success: false,
                error: 'number and file (file or fileUrl) are required'
            });
            return;
        }

        const botService = BotService.getInstance();
        const result = await botService.sendFile(number, filePath);

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

export const sendAudio = async (req: Request, res: Response): Promise<void> => {
    try {
        const { number } = req.body;
        // Priority: uploaded file > audioUrl in body
        const audioPath = req.file?.path || req.body.audioUrl;

        if (!number || !audioPath) {
            res.status(400).json({
                success: false,
                error: 'number and audio (file or audioUrl) are required'
            });
            return;
        }

        const botService = BotService.getInstance();
        const result = await botService.sendAudio(number, audioPath);

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
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
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
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
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
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
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
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};
