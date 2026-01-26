import { Request, Response } from 'express';
import { BotOrchestrator } from '../../agents';
import { v4 as uuidv4 } from 'uuid';

const botOrchestrator = BotOrchestrator.getInstance();

/**
 * Get bot configuration
 */
export const getConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const config = botOrchestrator.getConfig();
        // Don't expose the full API key
        const safeConfig = {
            ...config,
            geminiApiKey: config.geminiApiKey ? '***configured***' : null
        };

        res.json({
            success: true,
            data: safeConfig
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Update bot configuration
 */
export const updateConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const { geminiApiKey, settings, enabled } = req.body;

        if (geminiApiKey) {
            botOrchestrator.initGemini(geminiApiKey);
        }

        if (settings) {
            botOrchestrator.updateConfig(settings);
        }

        if (typeof enabled === 'boolean') {
            botOrchestrator.setEnabled(enabled);
        }

        res.json({
            success: true,
            message: 'Configuration updated'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Toggle bot for a specific chat
 */
export const toggleBot = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const { active } = req.body;

        if (!jid) {
            res.status(400).json({
                success: false,
                error: 'JID is required'
            });
            return;
        }

        botOrchestrator.toggleChat(jid, !!active);

        res.json({
            success: true,
            data: {
                jid,
                active: !!active
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Test bot response without sending
 */
export const testResponse = async (req: Request, res: Response): Promise<void> => {
    try {
        const { message } = req.body;

        if (!message) {
            res.status(400).json({
                success: false,
                error: 'Message is required'
            });
            return;
        }

        const response = await botOrchestrator.testMessage(message);

        res.json({
            success: true,
            data: response
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get bot statistics
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const stats = botOrchestrator.getStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Reset bot statistics
 */
export const resetStats = async (req: Request, res: Response): Promise<void> => {
    try {
        botOrchestrator.resetStats();

        res.json({
            success: true,
            message: 'Statistics reset'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ==========================================
// Knowledge Base Endpoints
// ==========================================

/**
 * Get entire knowledge base
 */
export const getKnowledgeBase = async (req: Request, res: Response): Promise<void> => {
    try {
        const qaAgent = botOrchestrator.getQAAgent();
        const kb = qaAgent.getAll();

        res.json({
            success: true,
            data: kb
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Reload knowledge base from file
 */
export const reloadKnowledgeBase = async (req: Request, res: Response): Promise<void> => {
    try {
        botOrchestrator.reloadKnowledgeBase();

        res.json({
            success: true,
            message: 'Knowledge base reloaded'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Update business context
 */
export const updateBusinessContext = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, tone } = req.body;
        const qaAgent = botOrchestrator.getQAAgent();

        const result = qaAgent.updateBusinessContext({ name, description, tone });

        if (!result) {
            res.status(500).json({
                success: false,
                error: 'Failed to update business context'
            });
            return;
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Update fallback configuration
 */
export const updateFallback = async (req: Request, res: Response): Promise<void> => {
    try {
        const { noMatch, useGemini, geminiPrompt } = req.body;
        const qaAgent = botOrchestrator.getQAAgent();

        const result = qaAgent.updateFallback({ noMatch, useGemini, geminiPrompt });

        if (!result) {
            res.status(500).json({
                success: false,
                error: 'Failed to update fallback'
            });
            return;
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ==========================================
// Category CRUD
// ==========================================

/**
 * Create a new category
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, icon } = req.body;

        if (!name) {
            res.status(400).json({
                success: false,
                error: 'Category name is required'
            });
            return;
        }

        const qaAgent = botOrchestrator.getQAAgent();
        const category = qaAgent.addCategory({
            id: uuidv4(),
            name,
            icon: icon || 'folder'
        });

        res.status(201).json({
            success: true,
            data: category
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Update a category
 */
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, icon } = req.body;

        const qaAgent = botOrchestrator.getQAAgent();
        const result = qaAgent.updateCategory(id, { name, icon });

        if (!result) {
            res.status(404).json({
                success: false,
                error: 'Category not found'
            });
            return;
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Delete a category
 */
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const qaAgent = botOrchestrator.getQAAgent();
        const deleted = qaAgent.deleteCategory(id);

        if (!deleted) {
            res.status(404).json({
                success: false,
                error: 'Category not found'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Category deleted'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ==========================================
// Question CRUD
// ==========================================

/**
 * Create a new question
 */
export const createQuestion = async (req: Request, res: Response): Promise<void> => {
    try {
        const { categoryId, keywords, questions, answer, priority } = req.body;

        if (!categoryId || !keywords || !questions || !answer) {
            res.status(400).json({
                success: false,
                error: 'categoryId, keywords, questions, and answer are required'
            });
            return;
        }

        const qaAgent = botOrchestrator.getQAAgent();
        const question = qaAgent.addQuestion(categoryId, {
            id: uuidv4(),
            keywords: Array.isArray(keywords) ? keywords : [keywords],
            questions: Array.isArray(questions) ? questions : [questions],
            answer,
            priority: priority || 1
        });

        if (!question) {
            res.status(404).json({
                success: false,
                error: 'Category not found'
            });
            return;
        }

        res.status(201).json({
            success: true,
            data: question
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Update a question
 */
export const updateQuestion = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { keywords, questions, answer, priority } = req.body;

        const qaAgent = botOrchestrator.getQAAgent();
        const result = qaAgent.updateQuestion(id, {
            keywords: keywords ? (Array.isArray(keywords) ? keywords : [keywords]) : undefined,
            questions: questions ? (Array.isArray(questions) ? questions : [questions]) : undefined,
            answer,
            priority
        });

        if (!result) {
            res.status(404).json({
                success: false,
                error: 'Question not found'
            });
            return;
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Delete a question
 */
export const deleteQuestion = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const qaAgent = botOrchestrator.getQAAgent();
        const deleted = qaAgent.deleteQuestion(id);

        if (!deleted) {
            res.status(404).json({
                success: false,
                error: 'Question not found'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Question deleted'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
