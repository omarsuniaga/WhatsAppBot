import { Router } from 'express';
import * as statusController from '../controllers/statusController';
import * as messageController from '../controllers/messageController';
import * as chatController from '../controllers/chatController';
import * as aiController from '../controllers/aiController';
import * as contactController from '../controllers/contactController';
import * as contactGroupController from '../controllers/contactGroupController';
import * as whatsappGroupController from '../controllers/whatsappGroupController';
import * as botController from '../controllers/botController';
import * as knowledgeController from '../controllers/knowledgeController';
import * as escalationController from '../controllers/escalationController';
import * as broadcastController from '../controllers/broadcastController';
import * as alertController from '../controllers/alertController';
import * as botAssignmentController from '../controllers/botAssignmentController';
import * as learningController from '../controllers/learningController';
import * as conversationContextController from '../controllers/conversationContextController';
import * as triggerController from '../controllers/triggerController';
import { checkRateLimit, conditionalRateLimit } from '../middlewares/rateLimitMiddleware';
import RateLimitService from '../services/rateLimitService';
import MessageQueueService from '../services/messageQueueService';
import institutionalRoutes from './institutional';
import { adminRoutes } from '../../../backend/src/routes';

const router = Router();

import { upload } from '../middlewares/uploadMiddleware';

// ==========================================
// Status routes
// ==========================================
router.get('/status', statusController.getStatus);
router.get('/status/qr', statusController.getQR);
router.post('/auth/logout', statusController.logout);

// ==========================================
// Chat routes
// ==========================================
router.get('/chats', chatController.getChats);
router.get('/chats/diagnostics/visual', chatController.diagnoseChatLoadVisual);
router.get('/chats/diagnostics/chat-load', chatController.diagnoseChatLoad);
router.get('/chats/:jid/messages', chatController.getChatMessages);
router.post('/chats/:jid/bot-toggle', chatController.toggleBot);
router.post('/chats/:jid/mark-read', chatController.markAsRead);

// ==========================================
// Contact routes
// ==========================================
router.get('/contacts', contactController.getAllContacts);
router.get('/contacts/search', contactController.searchContacts);
router.get('/contacts/:jid', contactController.getContactInfo);

// ==========================================
// AI Configuration routes
// ==========================================
router.get('/config/ai', aiController.getAIConfig);
router.post('/config/ai', aiController.updateAIConfig);

// ==========================================
// Message routes (with rate limiting)
// ==========================================
router.post('/messages/text', conditionalRateLimit, messageController.sendText);
router.post('/messages/media', conditionalRateLimit, upload.single('file'), messageController.sendMedia);
router.post('/messages/file', conditionalRateLimit, upload.single('file'), messageController.sendFile);
router.post('/messages/audio', conditionalRateLimit, upload.single('file'), messageController.sendAudio);
router.post('/messages/location', conditionalRateLimit, messageController.sendLocation);
router.post('/messages/contact', conditionalRateLimit, messageController.sendContact);
router.post('/messages/poll', conditionalRateLimit, messageController.sendPoll);
router.post('/messages/sticker', conditionalRateLimit, messageController.sendSticker);

// ==========================================
// Rate Limit Status routes
// ==========================================
router.get('/rate-limit/status', (req, res) => {
    const rateLimitService = RateLimitService.getInstance();
    res.json({
        success: true,
        data: rateLimitService.getStatus()
    });
});

router.get('/rate-limit/stats', (req, res) => {
    const rateLimitService = RateLimitService.getInstance();
    res.json({
        success: true,
        data: rateLimitService.getStats()
    });
});

router.post('/rate-limit/reset', (req, res) => {
    const rateLimitService = RateLimitService.getInstance();
    rateLimitService.reset();
    res.json({
        success: true,
        message: 'Rate limits reset'
    });
});

router.post('/rate-limit/clear-block', (req, res) => {
    const rateLimitService = RateLimitService.getInstance();
    rateLimitService.clearBlock();
    res.json({
        success: true,
        message: 'Block cleared'
    });
});

// ==========================================
// Message Queue routes
// ==========================================
router.get('/queue/status', (req, res) => {
    const queueService = MessageQueueService.getInstance();
    res.json({
        success: true,
        data: queueService.getQueueStatus()
    });
});

router.get('/queue/message/:messageId', (req, res) => {
    const queueService = MessageQueueService.getInstance();
    const message = queueService.getMessage(req.params.messageId);

    if (!message) {
        res.status(404).json({
            success: false,
            error: 'Message not found'
        });
        return;
    }

    res.json({
        success: true,
        data: message
    });
});

router.delete('/queue/message/:messageId', (req, res) => {
    const queueService = MessageQueueService.getInstance();
    const cancelled = queueService.cancel(req.params.messageId);

    if (!cancelled) {
        res.status(404).json({
            success: false,
            error: 'Message not found or not pending'
        });
        return;
    }

    res.json({
        success: true,
        message: 'Message cancelled'
    });
});

router.delete('/queue/clear', (req, res) => {
    const queueService = MessageQueueService.getInstance();
    const count = queueService.clearQueue();
    res.json({
        success: true,
        message: `${count} pending messages cleared`
    });
});

router.delete('/queue/history', (req, res) => {
    const queueService = MessageQueueService.getInstance();
    queueService.clearHistory();
    res.json({
        success: true,
        message: 'History cleared'
    });
});

// ==========================================
// Contact Groups routes (local tags/labels)
// ==========================================
router.get('/contact-groups', contactGroupController.getAllGroups);
router.get('/contact-groups/stats', contactGroupController.getStats);
router.get('/contact-groups/search', contactGroupController.searchGroups);
router.get('/contact-groups/by-contact/:jid', contactGroupController.getGroupsForContact);
router.get('/contact-groups/:id', contactGroupController.getGroupById);
router.post('/contact-groups', contactGroupController.createGroup);
router.put('/contact-groups/:id', contactGroupController.updateGroup);
router.delete('/contact-groups/:id', contactGroupController.deleteGroup);
router.post('/contact-groups/:id/contacts', contactGroupController.addContacts);
router.delete('/contact-groups/:id/contacts/:jid', contactGroupController.removeContact);
router.post('/contact-groups/:id/send', contactGroupController.sendBulkMessage);

// ==========================================
// WhatsApp Groups routes (real WA groups)
// ==========================================
router.get('/wa-groups', whatsappGroupController.getAllGroups);
router.get('/wa-groups/:groupJid', whatsappGroupController.getGroupMetadata);
router.post('/wa-groups', whatsappGroupController.createGroup);
router.put('/wa-groups/:groupJid/subject', whatsappGroupController.updateGroupSubject);
router.put('/wa-groups/:groupJid/description', whatsappGroupController.updateGroupDescription);
router.post('/wa-groups/:groupJid/participants', whatsappGroupController.manageParticipants);
router.delete('/wa-groups/:groupJid/leave', whatsappGroupController.leaveGroup);
router.get('/wa-groups/:groupJid/invite', whatsappGroupController.getInviteCode);
router.post('/wa-groups/:groupJid/invite/revoke', whatsappGroupController.revokeInviteCode);
router.post('/wa-groups/join', whatsappGroupController.joinGroup);
router.put('/wa-groups/:groupJid/settings', whatsappGroupController.updateSettings);

// ==========================================
// Bot Intelligence routes
// ==========================================

// Bot configuration
router.get('/bot/config', botController.getConfig);
router.put('/bot/config', botController.updateConfig);
router.post('/bot/toggle/:jid', botController.toggleBot);
router.post('/bot/test', botController.testResponse);
router.get('/bot/stats', botController.getStats);
router.post('/bot/stats/reset', botController.resetStats);

// Knowledge base
router.get('/bot/knowledge', botController.getKnowledgeBase);
router.post('/bot/knowledge/reload', botController.reloadKnowledgeBase);
router.put('/bot/knowledge/business', botController.updateBusinessContext);
router.put('/bot/knowledge/fallback', botController.updateFallback);

// Categories
router.post('/bot/knowledge/category', botController.createCategory);
router.put('/bot/knowledge/category/:id', botController.updateCategory);
router.delete('/bot/knowledge/category/:id', botController.deleteCategory);

// Questions
router.post('/bot/knowledge/question', botController.createQuestion);
router.put('/bot/knowledge/question/:id', botController.updateQuestion);
router.delete('/bot/knowledge/question/:id', botController.deleteQuestion);

// ==========================================
// Knowledge Base routes (FAQ System)
// ==========================================
router.get('/knowledge/config', knowledgeController.getConfig);
router.put('/knowledge/config', knowledgeController.updateConfig);
router.get('/knowledge/categories', knowledgeController.getCategories);
router.post('/knowledge/categories', knowledgeController.addCategory);
router.put('/knowledge/categories/:id', knowledgeController.updateCategory);
router.delete('/knowledge/categories/:id', knowledgeController.deleteCategory);
router.get('/knowledge/faqs', knowledgeController.getFaqs);
router.get('/knowledge/faqs/:id', knowledgeController.getFaq);
router.post('/knowledge/faqs', knowledgeController.addFaq);
router.put('/knowledge/faqs/:id', knowledgeController.updateFaq);
router.delete('/knowledge/faqs/:id', knowledgeController.deleteFaq);
router.post('/knowledge/faqs/:id/approve', knowledgeController.approveFaq);
router.get('/knowledge/search', knowledgeController.searchFaqs);
router.post('/knowledge/learn', knowledgeController.learnFromResponse);
router.post('/knowledge/variations', knowledgeController.generateVariations);
router.get('/knowledge/export', knowledgeController.exportData);
router.post('/knowledge/import', knowledgeController.importData);
router.get('/knowledge/stats', knowledgeController.getStats);

// ==========================================
// Escalation routes (Ticket System)
// ==========================================
router.get('/escalation/config', escalationController.getConfig);
router.put('/escalation/config', escalationController.updateConfig);
router.get('/escalation/admins', escalationController.getAdmins);
router.post('/escalation/admins', escalationController.addAdmin);
router.put('/escalation/admins/:jid', escalationController.updateAdmin);
router.delete('/escalation/admins/:jid', escalationController.removeAdmin);
router.get('/escalation/tickets', escalationController.getTickets);
router.get('/escalation/tickets/pending', escalationController.getPendingTickets);
router.get('/escalation/tickets/:id', escalationController.getTicket);
router.post('/escalation/tickets', escalationController.createTicket);
router.put('/escalation/tickets/:id', escalationController.updateTicket);
router.post('/escalation/tickets/:id/assign', escalationController.assignTicket);
router.post('/escalation/tickets/:id/resolve', escalationController.resolveTicket);
router.post('/escalation/tickets/:id/close', escalationController.closeTicket);
router.post('/escalation/admin-response', escalationController.handleAdminResponse);
router.get('/escalation/stats', escalationController.getStats);

// ==========================================
// Broadcast routes (Mass Messaging)
// ==========================================
router.get('/broadcast/config', broadcastController.getConfig);
router.put('/broadcast/config', broadcastController.updateConfig);
router.get('/broadcast/lists', broadcastController.getContactLists);
router.get('/broadcast/lists/:id', broadcastController.getContactList);
router.post('/broadcast/lists', broadcastController.createContactList);
router.put('/broadcast/lists/:id', broadcastController.updateContactList);
router.delete('/broadcast/lists/:id', broadcastController.deleteContactList);
router.post('/broadcast/lists/:id/contacts', broadcastController.addContactToList);
router.delete('/broadcast/lists/:id/contacts/:jid', broadcastController.removeContactFromList);
router.post('/broadcast/lists/:id/import', broadcastController.importContacts);
router.get('/broadcast/templates', broadcastController.getTemplates);
router.get('/broadcast/templates/:id', broadcastController.getTemplate);
router.post('/broadcast/templates', broadcastController.createTemplate);
router.put('/broadcast/templates/:id', broadcastController.updateTemplate);
router.delete('/broadcast/templates/:id', broadcastController.deleteTemplate);
router.get('/broadcast/campaigns', broadcastController.getCampaigns);
router.get('/broadcast/campaigns/:id', broadcastController.getCampaign);
router.post('/broadcast/campaigns', broadcastController.createCampaign);
router.put('/broadcast/campaigns/:id', broadcastController.updateCampaign);
router.delete('/broadcast/campaigns/:id', broadcastController.deleteCampaign);
router.post('/broadcast/campaigns/:id/start', broadcastController.startCampaign);
router.post('/broadcast/campaigns/:id/pause', broadcastController.pauseCampaign);
router.get('/broadcast/campaigns/:id/progress', broadcastController.getCampaignProgress);
router.get('/broadcast/stats', broadcastController.getStats);

// ==========================================
// Pending Alerts routes (Smart Bot Escalations)
// ==========================================
router.get('/alerts', alertController.getAlerts);
router.get('/alerts/stats', alertController.getAlertStats);
router.get('/alerts/:id', alertController.getAlert);
router.get('/alerts/chat/:jid', alertController.getAlertsByChat);
router.post('/alerts/:id/respond', alertController.respondToAlert);
router.post('/alerts/:id/dismiss', alertController.dismissAlert);

// ==========================================
// Bot Assignments routes (Per-chat bot config)
// ==========================================
router.get('/bot-assignments', botAssignmentController.getAll);
router.get('/bot-assignments/default', botAssignmentController.getDefaultConfig);
router.get('/bot-assignments/stats', botAssignmentController.getStats);
router.get('/bot-assignments/:jid', botAssignmentController.getByJid);
router.post('/bot-assignments', botAssignmentController.createOrUpdate);
router.put('/bot-assignments/default', botAssignmentController.updateDefaultConfig);
router.put('/bot-assignments/:jid', botAssignmentController.update);
router.post('/bot-assignments/:jid/toggle', botAssignmentController.toggleBot);
router.delete('/bot-assignments/:jid', botAssignmentController.deleteAssignment);

// ==========================================
// Conversation Context routes (per-chat contact profile — Fase A)
// ==========================================
router.get('/conversation-context', conversationContextController.getAll);
router.get('/conversation-context/:jid', conversationContextController.getByChat);
router.put('/conversation-context/:jid/profile', conversationContextController.updateProfile);
router.put('/conversation-context/:jid/opt-out', conversationContextController.setOptedOut);

// ==========================================
// Learning routes (AI Learning from responses)
// ==========================================
router.get('/learning', learningController.getAll);
router.get('/learning/pending', learningController.getPending);
router.get('/learning/settings', learningController.getSettings);
router.get('/learning/stats', learningController.getStats);
router.get('/learning/:id', learningController.getById);
router.put('/learning/settings', learningController.updateSettings);
router.post('/learning/:id/approve', learningController.approve);
router.post('/learning/:id/reject', learningController.reject);
router.delete('/learning/cleanup', learningController.cleanup);

// ==========================================
// Triggers routes (Bot activation keywords)
// ==========================================
router.get('/triggers/config', triggerController.getConfig);
router.post('/triggers/listener/toggle', triggerController.toggleListener);
router.post('/triggers/require/toggle', triggerController.toggleRequireTrigger);
router.put('/triggers/settings', triggerController.updateSettings);
router.get('/triggers', triggerController.getAllTriggers);
router.get('/triggers/stats', triggerController.getStats);
router.get('/triggers/export', triggerController.exportTriggers);
router.post('/triggers/import', triggerController.importTriggers);
router.post('/triggers/test', triggerController.testMessage);
router.post('/triggers/enable-all', triggerController.enableAllTriggers);
router.post('/triggers/disable-all', triggerController.disableAllTriggers);
router.post('/triggers/stats/reset', triggerController.resetStats);
router.get('/triggers/:id', triggerController.getTrigger);
router.post('/triggers', triggerController.createTrigger);
router.put('/triggers/:id', triggerController.updateTrigger);
router.delete('/triggers/:id', triggerController.deleteTrigger);
router.post('/triggers/:id/toggle', triggerController.toggleTrigger);

// ==========================================
// Admin API routes (Domain Entities CRUD)
// ==========================================
router.use('/admin', adminRoutes);

// ==========================================
// Institutional routes (Contacts, Students, Templates, Attendance)
// ==========================================
router.use('/', institutionalRoutes);

// ==========================================
// Phase 3: Data & Analytics API
// ==========================================
import apiRouter from './api';
router.use('/', apiRouter);

export default router;
