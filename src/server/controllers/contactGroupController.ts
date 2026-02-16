import { Request, Response } from 'express';
import ContactGroupService from '../services/contactGroupService';
import MessageQueueService from '../services/messageQueueService';
import { ApiResponse, ContactGroup, BulkSendResult } from '../types';
import { getErrorMessage } from '../utils/errorUtils';

const contactGroupService = ContactGroupService.getInstance();
const messageQueueService = MessageQueueService.getInstance();

/**
 * Get all contact groups
 */
export const getAllGroups = async (req: Request, res: Response): Promise<void> => {
    try {
        const groups = contactGroupService.getAllGroups();
        res.json({
            success: true,
            data: groups
        } as ApiResponse<ContactGroup[]>);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Get a single group by ID
 */
export const getGroupById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const group = contactGroupService.getGroupById(id);

        if (!group) {
            res.status(404).json({
                success: false,
                error: 'Group not found'
            } as ApiResponse);
            return;
        }

        res.json({
            success: true,
            data: group
        } as ApiResponse<ContactGroup>);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Create a new group
 */
export const createGroup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, color } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            res.status(400).json({
                success: false,
                error: 'Group name is required'
            } as ApiResponse);
            return;
        }

        const group = contactGroupService.createGroup(name, description, color);

        res.status(201).json({
            success: true,
            data: group,
            message: 'Group created successfully'
        } as ApiResponse<ContactGroup>);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Update a group
 */
export const updateGroup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, description, color } = req.body;

        const group = contactGroupService.updateGroup(id, { name, description, color });

        if (!group) {
            res.status(404).json({
                success: false,
                error: 'Group not found'
            } as ApiResponse);
            return;
        }

        res.json({
            success: true,
            data: group,
            message: 'Group updated successfully'
        } as ApiResponse<ContactGroup>);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Delete a group
 */
export const deleteGroup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const deleted = contactGroupService.deleteGroup(id);

        if (!deleted) {
            res.status(404).json({
                success: false,
                error: 'Group not found'
            } as ApiResponse);
            return;
        }

        res.json({
            success: true,
            message: 'Group deleted successfully'
        } as ApiResponse);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Add contacts to a group
 */
export const addContacts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { contacts } = req.body;

        if (!Array.isArray(contacts) || contacts.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Contacts array is required'
            } as ApiResponse);
            return;
        }

        const group = contactGroupService.addContacts(id, contacts);

        if (!group) {
            res.status(404).json({
                success: false,
                error: 'Group not found'
            } as ApiResponse);
            return;
        }

        res.json({
            success: true,
            data: group,
            message: `${contacts.length} contact(s) added`
        } as ApiResponse<ContactGroup>);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Remove a contact from a group
 */
export const removeContact = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id, jid } = req.params;

        const group = contactGroupService.removeContact(id, decodeURIComponent(jid));

        if (!group) {
            res.status(404).json({
                success: false,
                error: 'Group not found'
            } as ApiResponse);
            return;
        }

        res.json({
            success: true,
            data: group,
            message: 'Contact removed'
        } as ApiResponse<ContactGroup>);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Get groups for a specific contact
 */
export const getGroupsForContact = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const groups = contactGroupService.getGroupsForContact(decodeURIComponent(jid));

        res.json({
            success: true,
            data: groups
        } as ApiResponse<ContactGroup[]>);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Search groups by name
 */
export const searchGroups = async (req: Request, res: Response): Promise<void> => {
    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Search query is required'
            } as ApiResponse);
            return;
        }

        const groups = contactGroupService.searchGroups(q);

        res.json({
            success: true,
            data: groups
        } as ApiResponse<ContactGroup[]>);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Get group statistics
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const stats = contactGroupService.getStats();

        res.json({
            success: true,
            data: stats
        } as ApiResponse);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};

/**
 * Send bulk message to all contacts in a group
 */
export const sendBulkMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { type, content, priority } = req.body;

        if (!type || !content) {
            res.status(400).json({
                success: false,
                error: 'Message type and content are required'
            } as ApiResponse);
            return;
        }

        const jids = contactGroupService.getGroupJids(id);

        if (jids.length === 0) {
            res.status(404).json({
                success: false,
                error: 'Group not found or has no contacts'
            } as ApiResponse);
            return;
        }

        // Queue messages for all contacts in the group
        const messages = messageQueueService.enqueueBulk(type, jids, content, { priority });

        res.json({
            success: true,
            data: {
                queued: messages.length,
                messageIds: messages.map((m) => m.id)
            } as BulkSendResult,
            message: `${messages.length} messages queued for delivery`
        } as ApiResponse<BulkSendResult>);
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        } as ApiResponse);
    }
};
