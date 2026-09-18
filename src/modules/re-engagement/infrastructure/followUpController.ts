/**
 * Driving adapter — Express controller for the re-engagement dashboard
 * queue (spec section 12 Fase D). Approve/discard are the only actions;
 * there is no "auto-send" endpoint on purpose.
 */
import { Request, Response } from 'express';
import ReEngagementService from '../application/ReEngagementService';

export const getAll = async (req: Request, res: Response): Promise<void> => {
    try {
        const service = ReEngagementService.getInstance();
        const status = req.query.status as string;
        const data = status === 'pending' ? service.getPending() : service.getAll();
        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error getting follow-up suggestions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const approve = async (req: Request, res: Response): Promise<void> => {
    try {
        const { message, respondedBy = 'admin' } = req.body;
        const suggestion = await ReEngagementService.getInstance().approveAndSend(req.params.id, respondedBy, message);
        if (!suggestion) {
            res.status(404).json({ success: false, error: 'Suggestion not found or already resolved' });
            return;
        }
        res.json({ success: true, data: suggestion });
    } catch (error: any) {
        console.error('Error approving follow-up suggestion:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const discard = async (req: Request, res: Response): Promise<void> => {
    try {
        const { reason, respondedBy = 'admin' } = req.body;
        const suggestion = ReEngagementService.getInstance().discard(req.params.id, respondedBy, reason);
        if (!suggestion) {
            res.status(404).json({ success: false, error: 'Suggestion not found or already resolved' });
            return;
        }
        res.json({ success: true, data: suggestion });
    } catch (error: any) {
        console.error('Error discarding follow-up suggestion:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/** Manual trigger for testing the sweep without waiting for the interval. */
export const runSweep = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await ReEngagementService.getInstance().sweep();
        res.json({ success: true, data: result });
    } catch (error: any) {
        console.error('Error running re-engagement sweep:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
