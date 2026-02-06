/**
 * Knowledge Base Controller
 * API endpoints para gestión de FAQ y respuestas automáticas
 */

import { Request, Response } from 'express';
import { KnowledgeBaseService } from '../services/knowledgeBaseService';

const knowledgeService = KnowledgeBaseService.getInstance();

// ==========================================
// Configuration
// ==========================================

export const getConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const config = knowledgeService.getConfig();
        res.json({ success: true, data: config });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const config = knowledgeService.updateConfig(req.body);
        res.json({ success: true, data: config });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// Categories
// ==========================================

export const getCategories = async (req: Request, res: Response): Promise<void> => {
    try {
        const all = req.query.all === 'true';
        const categories = all 
            ? knowledgeService.getAllCategories()
            : knowledgeService.getCategories();
        res.json({ success: true, data: categories });
    } catch (error: any) {
        console.error('[KnowledgeController] getCategories error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const addCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, icon, order, isActive } = req.body;
        
        if (!name) {
            res.status(400).json({ success: false, error: 'Name is required' });
            return;
        }

        const category = knowledgeService.addCategory({
            name,
            description: description || '',
            icon,
            order: order || 0,
            isActive: isActive !== false
        });

        res.json({ success: true, data: category });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const category = knowledgeService.updateCategory(id, req.body);
        
        if (!category) {
            res.status(404).json({ success: false, error: 'Category not found' });
            return;
        }

        res.json({ success: true, data: category });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const success = knowledgeService.deleteCategory(id);
        
        if (!success) {
            res.status(404).json({ success: false, error: 'Category not found' });
            return;
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// FAQs
// ==========================================

export const getFaqs = async (req: Request, res: Response): Promise<void> => {
    try {
        const { category, approved } = req.query;
        let faqs = knowledgeService.getAllFaqs();

        if (category) {
            faqs = faqs.filter(f => f.category === category);
        }

        if (approved !== undefined) {
            const isApproved = approved === 'true';
            faqs = faqs.filter(f => f.approved === isApproved);
        }

        res.json({ success: true, data: faqs });
    } catch (error: any) {
        console.error('[KnowledgeController] getFaqs error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getFaq = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const faq = knowledgeService.getFaqById(id);
        
        if (!faq) {
            res.status(404).json({ success: false, error: 'FAQ not found' });
            return;
        }

        res.json({ success: true, data: faq });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const addFaq = async (req: Request, res: Response): Promise<void> => {
    try {
        const { category, questions, answer, keywords, approved } = req.body;

        if (!category || !questions || !answer) {
            res.status(400).json({ 
                success: false, 
                error: 'category, questions, and answer are required' 
            });
            return;
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            res.status(400).json({ 
                success: false, 
                error: 'questions must be a non-empty array' 
            });
            return;
        }

        const faq = knowledgeService.addFaq({
            category,
            questions,
            answer,
            keywords,
            approved: approved !== false
        });

        res.json({ success: true, data: faq });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateFaq = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const faq = knowledgeService.updateFaq(id, req.body);
        
        if (!faq) {
            res.status(404).json({ success: false, error: 'FAQ not found' });
            return;
        }

        res.json({ success: true, data: faq });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteFaq = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const success = knowledgeService.deleteFaq(id);
        
        if (!success) {
            res.status(404).json({ success: false, error: 'FAQ not found' });
            return;
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const approveFaq = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const faq = knowledgeService.approveFaq(id);
        
        if (!faq) {
            res.status(404).json({ success: false, error: 'FAQ not found' });
            return;
        }

        res.json({ success: true, data: faq });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// Search
// ==========================================

export const searchFaqs = async (req: Request, res: Response): Promise<void> => {
    try {
        const { query, limit } = req.query;

        if (!query) {
            res.status(400).json({ success: false, error: 'Query is required' });
            return;
        }

        const results = knowledgeService.searchFaqs(
            query as string,
            limit ? parseInt(limit as string) : 5
        );

        res.json({ success: true, data: results });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// Learning
// ==========================================

export const learnFromResponse = async (req: Request, res: Response): Promise<void> => {
    try {
        const { question, answer, category, autoApprove } = req.body;

        if (!question || !answer) {
            res.status(400).json({ 
                success: false, 
                error: 'question and answer are required' 
            });
            return;
        }

        const faq = knowledgeService.learnFromResponse(
            question,
            answer,
            category || 'general',
            autoApprove || false
        );

        res.json({ success: true, data: faq });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const generateVariations = async (req: Request, res: Response): Promise<void> => {
    try {
        const { question } = req.body;

        if (!question) {
            res.status(400).json({ success: false, error: 'question is required' });
            return;
        }

        const variations = knowledgeService.generateQuestionVariations(question);
        res.json({ success: true, data: variations });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// Import / Export
// ==========================================

export const exportData = async (req: Request, res: Response): Promise<void> => {
    try {
        const json = knowledgeService.exportToJson();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=knowledge-base.json');
        res.send(json);
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const importData = async (req: Request, res: Response): Promise<void> => {
    try {
        const { data } = req.body;

        if (!data) {
            res.status(400).json({ success: false, error: 'data is required' });
            return;
        }

        const result = knowledgeService.importFromJson(
            typeof data === 'string' ? data : JSON.stringify(data)
        );

        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// Stats
// ==========================================

export const getStats = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('[KnowledgeController] getStats called');
        const stats = knowledgeService.getStats();
        console.log('[KnowledgeController] getStats success:', stats ? 'ok' : 'null');
        res.json({ success: true, data: stats });
    } catch (error: any) {
        console.error('[KnowledgeController] getStats CRITICAL error:', error);
        if (error.stack) console.error(error.stack);
        res.status(500).json({ success: false, error: error.message });
    }
};
