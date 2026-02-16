import { Request, Response } from 'express';
import BotService from '../services/botService';
import { getErrorMessage } from '../utils/errorUtils';

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

/**
 * GET /api/status/health — connection health details
 */
export const getHealth = (req: Request, res: Response): void => {
    const botService = BotService.getInstance();
    res.json({
        success: true,
        data: botService.getConnectionHealth()
    });
};

/**
 * POST /api/session/disconnect — graceful disconnect (preserves session)
 */
export const disconnect = async (req: Request, res: Response): Promise<void> => {
    try {
        const botService = BotService.getInstance();
        await botService.disconnect();
        res.json({
            success: true,
            message: 'WhatsApp disconnected. Session preserved — use reconnect to resume.'
        });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

/**
 * POST /api/session/reconnect — manual reconnect
 */
export const reconnect = async (req: Request, res: Response): Promise<void> => {
    try {
        const botService = BotService.getInstance();
        await botService.reconnect();
        res.json({
            success: true,
            message: 'Reconnecting to WhatsApp...'
        });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

/**
 * GET /api/status/rate-limiter — WhatsApp rate limiter statistics
 */
export const getRateLimiterStats = (req: Request, res: Response): void => {
    const botService = BotService.getInstance();
    res.json({
        success: true,
        data: botService.getRateLimiterStats()
    });
};

/**
 * POST /api/auth/logout — full logout (clears session, requires new QR)
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        const botService = BotService.getInstance();
        await botService.forceSessionReset();
        res.json({
            success: true,
            message: 'Session cleared. Scan QR code to reconnect.'
        });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};
