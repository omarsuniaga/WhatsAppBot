import { Request, Response } from 'express';
import BotService from '../services/botService';
import { ApiResponse, WhatsAppGroupMetadata, ParticipantAction } from '../types';
import { getErrorMessage } from '../utils/errorUtils';

const botService = BotService.getInstance();

/**
 * Get all WhatsApp groups
 */
export const getAllGroups = async (req: Request, res: Response): Promise<void> => {
    try {
        const groups = await botService.getWhatsAppGroups();

        res.json({
            success: true,
            data: groups
        } as ApiResponse);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Get metadata for a specific group
 */
export const getGroupMetadata = async (req: Request, res: Response): Promise<void> => {
    try {
        const { groupJid } = req.params;

        if (!groupJid || !groupJid.endsWith('@g.us')) {
            res.status(400).json({
                success: false,
                error: 'Valid group JID required (must end with @g.us)'
            } as ApiResponse);
            return;
        }

        const metadata = await botService.getGroupMetadata(groupJid);

        res.json({
            success: true,
            data: metadata
        } as ApiResponse<WhatsAppGroupMetadata>);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Create a new WhatsApp group
 */
export const createGroup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, participants } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            res.status(400).json({
                success: false,
                error: 'Group name is required'
            } as ApiResponse);
            return;
        }

        if (!Array.isArray(participants) || participants.length === 0) {
            res.status(400).json({
                success: false,
                error: 'At least one participant is required'
            } as ApiResponse);
            return;
        }

        const result = await botService.createWhatsAppGroup(name, participants);

        res.status(201).json({
            success: true,
            data: result,
            message: 'Group created successfully'
        } as ApiResponse);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Update group subject (name)
 */
export const updateGroupSubject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { groupJid } = req.params;
        const { subject } = req.body;

        if (!groupJid || !groupJid.endsWith('@g.us')) {
            res.status(400).json({
                success: false,
                error: 'Valid group JID required'
            } as ApiResponse);
            return;
        }

        if (!subject || typeof subject !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Subject is required'
            } as ApiResponse);
            return;
        }

        await botService.updateGroupSubject(groupJid, subject);

        res.json({
            success: true,
            message: 'Group subject updated'
        } as ApiResponse);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Update group description
 */
export const updateGroupDescription = async (req: Request, res: Response): Promise<void> => {
    try {
        const { groupJid } = req.params;
        const { description } = req.body;

        if (!groupJid || !groupJid.endsWith('@g.us')) {
            res.status(400).json({
                success: false,
                error: 'Valid group JID required'
            } as ApiResponse);
            return;
        }

        await botService.updateGroupDescription(groupJid, description || '');

        res.json({
            success: true,
            message: 'Group description updated'
        } as ApiResponse);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Manage participants (add, remove, promote, demote)
 */
export const manageParticipants = async (req: Request, res: Response): Promise<void> => {
    try {
        const { groupJid } = req.params;
        const { action, participants } = req.body;

        if (!groupJid || !groupJid.endsWith('@g.us')) {
            res.status(400).json({
                success: false,
                error: 'Valid group JID required'
            } as ApiResponse);
            return;
        }

        if (!Array.isArray(participants) || participants.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Participants array is required'
            } as ApiResponse);
            return;
        }

        const validActions: ParticipantAction[] = ['add', 'remove', 'promote', 'demote'];
        if (!validActions.includes(action)) {
            res.status(400).json({
                success: false,
                error: 'Invalid action. Must be: add, remove, promote, or demote'
            } as ApiResponse);
            return;
        }

        let result;
        switch (action) {
            case 'add':
                result = await botService.addGroupParticipants(groupJid, participants);
                break;
            case 'remove':
                result = await botService.removeGroupParticipants(groupJid, participants);
                break;
            case 'promote':
                result = await botService.promoteGroupParticipants(groupJid, participants);
                break;
            case 'demote':
                result = await botService.demoteGroupParticipants(groupJid, participants);
                break;
        }

        res.json({
            success: true,
            data: result,
            message: `Participants ${action} successful`
        } as ApiResponse);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Leave a group
 */
export const leaveGroup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { groupJid } = req.params;

        if (!groupJid || !groupJid.endsWith('@g.us')) {
            res.status(400).json({
                success: false,
                error: 'Valid group JID required'
            } as ApiResponse);
            return;
        }

        await botService.leaveGroup(groupJid);

        res.json({
            success: true,
            message: 'Left group successfully'
        } as ApiResponse);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Get group invite code
 */
export const getInviteCode = async (req: Request, res: Response): Promise<void> => {
    try {
        const { groupJid } = req.params;

        if (!groupJid || !groupJid.endsWith('@g.us')) {
            res.status(400).json({
                success: false,
                error: 'Valid group JID required'
            } as ApiResponse);
            return;
        }

        const code = await botService.getGroupInviteCode(groupJid);

        res.json({
            success: true,
            data: {
                code,
                link: `https://chat.whatsapp.com/${code}`
            }
        } as ApiResponse);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Revoke group invite code
 */
export const revokeInviteCode = async (req: Request, res: Response): Promise<void> => {
    try {
        const { groupJid } = req.params;

        if (!groupJid || !groupJid.endsWith('@g.us')) {
            res.status(400).json({
                success: false,
                error: 'Valid group JID required'
            } as ApiResponse);
            return;
        }

        const newCode = await botService.revokeGroupInviteCode(groupJid);

        res.json({
            success: true,
            data: {
                code: newCode,
                link: `https://chat.whatsapp.com/${newCode}`
            },
            message: 'Invite code revoked'
        } as ApiResponse);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Join a group via invite code
 */
export const joinGroup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { inviteCode } = req.body;

        if (!inviteCode || typeof inviteCode !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Invite code is required'
            } as ApiResponse);
            return;
        }

        // Extract code from full link if provided
        const code = inviteCode.includes('chat.whatsapp.com/')
            ? inviteCode.split('chat.whatsapp.com/')[1]
            : inviteCode;

        const groupJid = await botService.joinGroupViaInvite(code);

        res.json({
            success: true,
            data: { groupJid },
            message: 'Joined group successfully'
        } as ApiResponse);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Update group settings
 */
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const { groupJid } = req.params;
        const { setting } = req.body;

        if (!groupJid || !groupJid.endsWith('@g.us')) {
            res.status(400).json({
                success: false,
                error: 'Valid group JID required'
            } as ApiResponse);
            return;
        }

        const validSettings = ['announcement', 'not_announcement', 'locked', 'unlocked'];
        if (!validSettings.includes(setting)) {
            res.status(400).json({
                success: false,
                error: 'Invalid setting. Must be: announcement, not_announcement, locked, or unlocked'
            } as ApiResponse);
            return;
        }

        await botService.updateGroupSettings(groupJid, setting);

        res.json({
            success: true,
            message: 'Group settings updated'
        } as ApiResponse);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};
