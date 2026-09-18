/**
 * Driving adapter — Express controller for the appointments dashboard
 * (view proposed/confirmed appointments, spec section 12 Fase C).
 * Confirmation and cancellation are human-only actions (section 6 and 10):
 * the bot never calls confirm() itself.
 */
import { Request, Response } from 'express';
import AppointmentService from '../application/AppointmentService';

export const getAll = async (req: Request, res: Response): Promise<void> => {
    try {
        res.json({ success: true, data: AppointmentService.getInstance().getAll() });
    } catch (error: any) {
        console.error('Error getting appointments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
    try {
        const appointment = AppointmentService.getInstance().getById(req.params.id);
        if (!appointment) {
            res.status(404).json({ success: false, error: 'Appointment not found' });
            return;
        }
        res.json({ success: true, data: appointment });
    } catch (error: any) {
        console.error('Error getting appointment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getByChat = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        res.json({ success: true, data: AppointmentService.getInstance().getByChat(decodeURIComponent(jid)) });
    } catch (error: any) {
        console.error('Error getting appointments by chat:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const confirm = async (req: Request, res: Response): Promise<void> => {
    try {
        const { confirmedBy } = req.body;
        if (!confirmedBy || typeof confirmedBy !== 'string') {
            res.status(400).json({ success: false, error: 'confirmedBy is required' });
            return;
        }

        const appointment = AppointmentService.getInstance().confirm(req.params.id, confirmedBy);
        if (!appointment) {
            res.status(404).json({ success: false, error: 'Appointment not found' });
            return;
        }
        res.json({ success: true, data: appointment });
    } catch (error: any) {
        console.error('Error confirming appointment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const cancel = async (req: Request, res: Response): Promise<void> => {
    try {
        const { notes } = req.body;
        const appointment = AppointmentService.getInstance().cancel(req.params.id, notes);
        if (!appointment) {
            res.status(404).json({ success: false, error: 'Appointment not found' });
            return;
        }
        res.json({ success: true, data: appointment });
    } catch (error: any) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const reschedule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { newDate } = req.body;
        if (!newDate || typeof newDate !== 'string') {
            res.status(400).json({ success: false, error: 'newDate is required' });
            return;
        }

        const appointment = AppointmentService.getInstance().reschedule(req.params.id, newDate);
        if (!appointment) {
            res.status(404).json({ success: false, error: 'Appointment not found' });
            return;
        }
        res.json({ success: true, data: appointment });
    } catch (error: any) {
        console.error('Error rescheduling appointment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
