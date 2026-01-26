import { Router } from 'express';
import * as statusController from '../controllers/statusController';
import * as messageController from '../controllers/messageController';
import * as chatController from '../controllers/chatController';
import * as aiController from '../controllers/aiController';
import * as contactGroupController from '../controllers/contactGroupController';
import * as whatsappGroupController from '../controllers/whatsappGroupController';
import * as botController from '../controllers/botController';
import { checkRateLimit, conditionalRateLimit } from '../middlewares/rateLimitMiddleware';
import RateLimitService from '../services/rateLimitService';
import MessageQueueService from '../services/messageQueueService';

const router = Router();

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
router.get('/chats/:jid/messages', chatController.getChatMessages);
router.post('/chats/:jid/bot-toggle', chatController.toggleBot);

// ==========================================
// AI Configuration routes
// ==========================================
router.post('/config/ai', aiController.updateAIConfig);

// ==========================================
// Message routes (with rate limiting)
// ==========================================
router.post('/messages/text', conditionalRateLimit, messageController.sendText);
router.post('/messages/media', conditionalRateLimit, messageController.sendMedia);
router.post('/messages/file', conditionalRateLimit, messageController.sendFile);
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

export default router;
