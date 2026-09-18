/**
 * Driving adapter — Express controller for the guided-flows dashboard
 * editor (create/edit/activate, spec section 12 Fase B).
 */
import { Request, Response } from 'express';
import GuidedFlowService from '../application/GuidedFlowService';

export const getAll = async (req: Request, res: Response): Promise<void> => {
    try {
        const flows = GuidedFlowService.getInstance().getAllFlows();
        res.json({ success: true, data: flows });
    } catch (error: any) {
        console.error('Error getting guided flows:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
    try {
        const flow = GuidedFlowService.getInstance().getFlow(req.params.id);
        if (!flow) {
            res.status(404).json({ success: false, error: 'Flow not found' });
            return;
        }
        res.json({ success: true, data: flow });
    } catch (error: any) {
        console.error('Error getting guided flow:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.body;
        if (!id || typeof id !== 'string') {
            res.status(400).json({ success: false, error: 'id is required (lowercase, digits, -, _)' });
            return;
        }

        const flow = GuidedFlowService.getInstance().createFlow(id, req.body);
        if (!flow) {
            res.status(400).json({ success: false, error: 'Invalid id or a flow with this id already exists' });
            return;
        }

        res.status(201).json({ success: true, data: flow });
    } catch (error: any) {
        console.error('Error creating guided flow:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const flow = GuidedFlowService.getInstance().updateFlow(req.params.id, req.body);
        if (!flow) {
            res.status(404).json({ success: false, error: 'Flow not found' });
            return;
        }
        res.json({ success: true, data: flow });
    } catch (error: any) {
        console.error('Error updating guided flow:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const toggleActive = async (req: Request, res: Response): Promise<void> => {
    try {
        const { active } = req.body;
        if (typeof active !== 'boolean') {
            res.status(400).json({ success: false, error: 'active must be a boolean' });
            return;
        }

        const flow = GuidedFlowService.getInstance().setActive(req.params.id, active);
        if (!flow) {
            res.status(404).json({ success: false, error: 'Flow not found' });
            return;
        }
        res.json({ success: true, data: flow });
    } catch (error: any) {
        console.error('Error toggling guided flow:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
    try {
        const deleted = GuidedFlowService.getInstance().deleteFlow(req.params.id);
        if (!deleted) {
            res.status(404).json({ success: false, error: 'Flow not found' });
            return;
        }
        res.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting guided flow:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getStateByChat = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const state = GuidedFlowService.getInstance().getState(decodeURIComponent(jid));
        if (!state) {
            res.status(404).json({ success: false, error: 'No active flow state for this chat' });
            return;
        }
        res.json({ success: true, data: state });
    } catch (error: any) {
        console.error('Error getting flow state:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
