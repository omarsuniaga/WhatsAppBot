/**
 * Templates Controller - CRUD operations for Template entities
 */

import { Request, Response } from 'express';
import { TemplatesRepo } from '../repos';
import { TemplateCategory, TemplateStatus } from '../domain';

const repo = TemplatesRepo.getInstance();

// Extract variables from template body
const extractVariables = (body: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(body)) !== null) {
        if (!variables.includes(match[1])) {
            variables.push(match[1]);
        }
    }
    return variables;
};

export const list = async (req: Request, res: Response) => {
    try {
        const { category, status, tag } = req.query;
        let templates = await repo.list();

        if (category) {
            templates = templates.filter(t => t.category === category);
        }
        if (status) {
            templates = templates.filter(t => t.status === status);
        }
        if (tag && typeof tag === 'string') {
            templates = templates.filter(t => t.tags.includes(tag));
        }

        res.json({ success: true, data: templates, count: templates.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getById = async (req: Request, res: Response) => {
    try {
        const template = await repo.getById(req.params.id);
        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        res.json({ success: true, data: template });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const create = async (req: Request, res: Response) => {
    try {
        const { name, code, body, category, description, requiredVariables, tags } = req.body;

        if (!name || !code || !body || !category) {
            return res.status(400).json({
                success: false,
                error: 'name, code, body, and category are required'
            });
        }

        // Check code uniqueness
        const existing = await repo.findByCode(code);
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'Template with this code already exists'
            });
        }

        const variables = extractVariables(body);

        const template = await repo.upsert({
            name,
            code,
            body,
            category,
            description,
            variables,
            requiredVariables: requiredVariables || variables,
            status: TemplateStatus.Active,
            useCount: 0,
            tags: tags || []
        });

        res.status(201).json({ success: true, data: template });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const update = async (req: Request, res: Response) => {
    try {
        const existing = await repo.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        // Re-extract variables if body changed
        let variables = existing.variables;
        if (req.body.body) {
            variables = extractVariables(req.body.body);
        }

        const template = await repo.upsert({
            ...existing,
            ...req.body,
            variables,
            id: req.params.id
        });

        res.json({ success: true, data: template });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const remove = async (req: Request, res: Response) => {
    try {
        const deleted = await repo.remove(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        res.json({ success: true, message: 'Template deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Render a template with variables
 */
export const render = async (req: Request, res: Response) => {
    try {
        const template = await repo.getById(req.params.id);
        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        const { variables } = req.body;
        if (!variables || typeof variables !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'variables object is required'
            });
        }

        // Check required variables
        const missing = template.requiredVariables.filter(v => !variables[v]);
        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required variables: ${missing.join(', ')}`
            });
        }

        // Render template
        let rendered = template.body;
        for (const [key, value] of Object.entries(variables)) {
            rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
        }

        // Increment use count
        await repo.incrementUseCount(template.id);

        res.json({
            success: true,
            data: {
                templateId: template.id,
                rendered
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
