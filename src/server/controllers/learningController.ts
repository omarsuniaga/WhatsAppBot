/**
 * Learning Controller - Handles API routes for learned responses
 */
import { Request, Response } from 'express';
import { BotOrchestrator } from '../../agents/BotOrchestrator';

/**
 * Get pending reviews
 */
export const getPending = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const learningService = orchestrator.getLearningService();

        const pending = learningService.getPendingReviews();

        res.json({
            success: true,
            data: pending,
            stats: learningService.getStats()
        });
    } catch (error: any) {
        console.error('Error getting pending reviews:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get all learned responses
 */
export const getAll = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const learningService = orchestrator.getLearningService();

        const limit = parseInt(req.query.limit as string) || 100;
        const responses = learningService.getAllResponses(limit);

        res.json({
            success: true,
            data: responses,
            stats: learningService.getStats()
        });
    } catch (error: any) {
        console.error('Error getting learned responses:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get single learned response
 */
export const getById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const orchestrator = BotOrchestrator.getInstance();
        const learningService = orchestrator.getLearningService();

        const response = learningService.getResponse(id);

        if (!response) {
            res.status(404).json({
                success: false,
                error: 'Learned response not found'
            });
            return;
        }

        res.json({
            success: true,
            data: response
        });
    } catch (error: any) {
        console.error('Error getting learned response:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Approve a learned response and create FAQ
 */
export const approve = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { reviewedBy = 'admin', category } = req.body;

        const orchestrator = BotOrchestrator.getInstance();
        const learningService = orchestrator.getLearningService();
        const qaAgent = orchestrator.getQAAgent();

        // Approve the learned response
        const learned = learningService.approveResponse(id, reviewedBy);

        if (!learned) {
            res.status(404).json({
                success: false,
                error: 'Learned response not found'
            });
            return;
        }

        // Create FAQ from learned response
        try {
            const faqCategory = category || learned.suggestedCategory || 'general';
            
            const faq = await qaAgent.addLearnedFaq({
                questions: learned.extractedQuestions,
                answer: learned.userResponse,
                keywords: learned.extractedKeywords,
                category: faqCategory
            });

            // Link to FAQ
            learningService.linkToFaq(id, faq.id);

            // Emit WebSocket event
            const io = (req as any).io;
            if (io) {
                io.emit('learning:approved', { learnedId: id, faqId: faq.id });
            }

            res.json({
                success: true,
                data: {
                    learned,
                    faq
                }
            });
        } catch (faqError: any) {
            console.error('Error creating FAQ from learned response:', faqError);
            res.json({
                success: true,
                data: { learned },
                warning: 'Response approved but FAQ creation failed: ' + faqError.message
            });
        }
    } catch (error: any) {
        console.error('Error approving learned response:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Reject a learned response
 */
export const reject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { reason = 'Rejected by admin', reviewedBy = 'admin' } = req.body;

        const orchestrator = BotOrchestrator.getInstance();
        const learningService = orchestrator.getLearningService();

        const learned = learningService.rejectResponse(id, reason, reviewedBy);

        if (!learned) {
            res.status(404).json({
                success: false,
                error: 'Learned response not found'
            });
            return;
        }

        // Emit WebSocket event
        const io = (req as any).io;
        if (io) {
            io.emit('learning:rejected', { learnedId: id, reason });
        }

        res.json({
            success: true,
            data: learned
        });
    } catch (error: any) {
        console.error('Error rejecting learned response:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get learning settings
 */
export const getSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const learningService = orchestrator.getLearningService();

        const settings = learningService.getSettings();

        res.json({
            success: true,
            data: settings
        });
    } catch (error: any) {
        console.error('Error getting learning settings:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Update learning settings
 */
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const { autoApprove, minConfidenceForAutoApprove } = req.body;

        const orchestrator = BotOrchestrator.getInstance();
        const learningService = orchestrator.getLearningService();

        learningService.updateSettings({ autoApprove, minConfidenceForAutoApprove });

        res.json({
            success: true,
            data: learningService.getSettings()
        });
    } catch (error: any) {
        console.error('Error updating learning settings:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get learning statistics
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const learningService = orchestrator.getLearningService();

        const stats = learningService.getStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error: any) {
        console.error('Error getting learning stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Cleanup old rejected responses
 */
export const cleanup = async (req: Request, res: Response): Promise<void> => {
    try {
        const olderThanDays = parseInt(req.query.days as string) || 30;

        const orchestrator = BotOrchestrator.getInstance();
        const learningService = orchestrator.getLearningService();

        const removed = learningService.cleanupRejected(olderThanDays);

        res.json({
            success: true,
            data: { removed }
        });
    } catch (error: any) {
        console.error('Error cleaning up learned responses:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
