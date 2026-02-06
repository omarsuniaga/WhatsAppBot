/**
 * WhatsApp Send Controller - Send messages via Baileys
 * 
 * SAFETY NOTES (from the architect 😄):
 * - All automations should pass through: rules → drafts → confirmation → event log
 * - Never send directly from automation without human confirmation
 * - The most expensive error is sending wrong message to wrong guardian
 * 
 * This controller is for CONFIRMED sends only - after staff review.
 */

import { Request, Response } from 'express';
import { EventLogRepo } from '../repos';
import { EventLogType, EventLogLevel } from '../domain/enums';

// Import from the main server (relative path from backend)
// Note: This creates a coupling to the main server - could be abstracted later
import BotService from '../../../src/server/services/botService';
import { normalizeRawJid, isValidJid } from '../../../src/server/utils/jidUtils';

const eventLogRepo = EventLogRepo.getInstance();

// Types
interface SendRequest {
    to: string;                    // Phone (E164) or JID
    text: string;                  // Message text
    context?: {
        templateId?: string;       // Template used
        studentId?: string;        // Related student
        draftId?: string;          // Original draft ID
        automationType?: string;   // e.g., "absence_notification"
    };
}

interface SendResult {
    success: boolean;
    to: string;
    jid: string | null;
    messageId?: string;
    error?: string;
    timestamp: number;
}

/**
 * Convert phone or JID to valid WhatsApp JID
 */
function toWhatsAppJid(input: string): string | null {
    // If already looks like a JID, normalize it
    if (input.includes('@')) {
        return normalizeRawJid(input);
    }
    
    // Clean phone number (remove +, spaces, dashes)
    const cleaned = input.replace(/[\s\-\+\(\)]/g, '');
    
    // Must be digits only
    if (!/^\d+$/.test(cleaned)) {
        return null;
    }
    
    // Build JID
    return `${cleaned}@s.whatsapp.net`;
}

/**
 * Send a single message
 */
async function sendSingleMessage(req: SendRequest): Promise<SendResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    const { to, text, context } = req;
    
    // Validate input
    if (!to || !text) {
        return {
            success: false,
            to,
            jid: null,
            error: 'Missing required fields: to and text',
            timestamp
        };
    }
    
    // Convert to JID
    const jid = toWhatsAppJid(to);
    if (!jid) {
        return {
            success: false,
            to,
            jid: null,
            error: `Invalid phone/JID format: ${to}`,
            timestamp
        };
    }
    
    // Validate JID format
    if (!isValidJid(jid)) {
        return {
            success: false,
            to,
            jid,
            error: `Invalid JID after normalization: ${jid}`,
            timestamp
        };
    }
    
    // Get bot service
    const botService = BotService.getInstance();
    
    try {
        // Send message via Baileys
        const result = await botService.sendText(jid, text);
        const messageId = result?.key?.id || 'unknown';
        
        // Log success
        await eventLogRepo.log(
            EventLogType.MessageSent,
            EventLogLevel.Info,
            `WhatsApp message sent to ${jid}`,
            {
                entityType: 'whatsapp_message',
                entityId: messageId,
                data: {
                    to,
                    jid,
                    messageId,
                    textLength: text.length,
                    context
                },
                actorType: 'system'
            }
        );
        
        return {
            success: true,
            to,
            jid,
            messageId,
            timestamp
        };
    } catch (error: any) {
        // Log failure
        await eventLogRepo.log(
            EventLogType.SystemError,
            EventLogLevel.Error,
            `Failed to send WhatsApp message to ${jid}: ${error.message}`,
            {
                entityType: 'whatsapp_message',
                data: {
                    to,
                    jid,
                    error: error.message,
                    context
                },
                actorType: 'system'
            }
        );
        
        return {
            success: false,
            to,
            jid,
            error: error.message,
            timestamp
        };
    }
}

/**
 * POST /api/admin/whatsapp/send
 * Send a single WhatsApp message
 */
export const send = async (req: Request, res: Response) => {
    try {
        const { to, text, context } = req.body;
        
        if (!to || !text) {
            return res.status(400).json({
                success: false,
                error: 'Required fields: to (phone or JID) and text'
            });
        }
        
        if (typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'text must be a non-empty string'
            });
        }
        
        if (text.length > 4096) {
            return res.status(400).json({
                success: false,
                error: 'text exceeds WhatsApp limit of 4096 characters'
            });
        }
        
        const result = await sendSingleMessage({ to, text, context });
        
        if (result.success) {
            res.json({
                success: true,
                data: result
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                data: result
            });
        }
    } catch (error: any) {
        console.error('[WhatsAppSendController] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * POST /api/admin/whatsapp/send-batch
 * Send multiple WhatsApp messages
 * 
 * Body: { messages: SendRequest[] }
 */
export const sendBatch = async (req: Request, res: Response) => {
    try {
        const { messages } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                success: false,
                error: 'Required field: messages (array of { to, text, context? })'
            });
        }
        
        if (messages.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'messages array is empty'
            });
        }
        
        if (messages.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 50 messages per batch (safety limit)'
            });
        }
        
        // Validate all messages first
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (!msg.to || !msg.text) {
                return res.status(400).json({
                    success: false,
                    error: `Message at index ${i} missing required fields: to and text`
                });
            }
        }
        
        // Send messages sequentially with delay to avoid rate limiting
        const results: SendResult[] = [];
        let successCount = 0;
        let failCount = 0;
        
        for (const msg of messages) {
            const result = await sendSingleMessage(msg);
            results.push(result);
            
            if (result.success) {
                successCount++;
            } else {
                failCount++;
            }
            
            // Small delay between messages to avoid WhatsApp rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Log batch operation
        await eventLogRepo.log(
            EventLogType.AutomationTriggered,
            EventLogLevel.Info,
            `Batch send completed: ${successCount} success, ${failCount} failed`,
            {
                entityType: 'whatsapp_batch',
                data: {
                    totalMessages: messages.length,
                    successCount,
                    failCount,
                    results: results.map(r => ({
                        to: r.to,
                        success: r.success,
                        messageId: r.messageId,
                        error: r.error
                    }))
                },
                actorType: 'system'
            }
        );
        
        res.json({
            success: failCount === 0,
            data: {
                total: messages.length,
                successCount,
                failCount,
                results
            }
        });
    } catch (error: any) {
        console.error('[WhatsAppSendController] Batch error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * POST /api/admin/whatsapp/send-drafts
 * Send confirmed drafts (from AutomationService)
 * 
 * Body: { drafts: AbsenceDraft[], confirmedBy: string }
 */
export const sendDrafts = async (req: Request, res: Response) => {
    try {
        const { drafts, confirmedBy } = req.body;
        
        if (!drafts || !Array.isArray(drafts)) {
            return res.status(400).json({
                success: false,
                error: 'Required field: drafts (array from automation service)'
            });
        }
        
        if (!confirmedBy) {
            return res.status(400).json({
                success: false,
                error: 'Required field: confirmedBy (who confirmed these drafts)'
            });
        }
        
        if (drafts.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'drafts array is empty'
            });
        }
        
        if (drafts.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 50 drafts per batch (safety limit)'
            });
        }
        
        // Log confirmation before sending
        await eventLogRepo.log(
            EventLogType.AutomationTriggered,
            EventLogLevel.Info,
            `Drafts confirmed for sending by ${confirmedBy}`,
            {
                entityType: 'draft_confirmation',
                data: {
                    confirmedBy,
                    draftCount: drafts.length,
                    studentIds: drafts.map((d: any) => d.studentId)
                },
                actorType: 'user',
                actorId: confirmedBy
            }
        );
        
        // Convert drafts to send requests
        const messages: SendRequest[] = drafts.map((draft: any) => ({
            to: draft.phone,
            text: draft.messageText,
            context: {
                templateId: draft.templateId,
                studentId: draft.studentId,
                automationType: 'absence_notification'
            }
        }));
        
        // Send sequentially
        const results: SendResult[] = [];
        let successCount = 0;
        let failCount = 0;
        
        for (const msg of messages) {
            const result = await sendSingleMessage(msg);
            results.push(result);
            
            if (result.success) {
                successCount++;
            } else {
                failCount++;
            }
            
            // Delay between messages
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        res.json({
            success: failCount === 0,
            data: {
                confirmedBy,
                total: drafts.length,
                successCount,
                failCount,
                results
            }
        });
    } catch (error: any) {
        console.error('[WhatsAppSendController] Send drafts error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
