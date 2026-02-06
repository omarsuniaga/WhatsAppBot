/**
 * TemplateService - Template variable extraction, rendering, and validation
 * 
 * This service handles:
 * - Extracting {{variables}} from template bodies
 * - Rendering templates with provided variables
 * - Validating that required variables are provided
 * - Safe rendering (no code execution)
 */

import { TemplatesRepository } from '../persistence/TemplatesRepository';
import type { Template, TemplateVariable } from '../types/entities';

export interface RenderResult {
    success: boolean;
    rendered?: string;
    missingVariables?: string[];
    error?: string;
}

export interface TemplateValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    variables: TemplateVariable[];
}

export class TemplateService {
    private static instance: TemplateService | null = null;
    private templatesRepo: TemplatesRepository;

    // Regex for matching {{variable}} patterns
    private readonly VARIABLE_REGEX = /\{\{(\w+)\}\}/g;
    
    // Reserved variable names (built-in)
    private readonly RESERVED_VARIABLES = new Set([
        'fecha',
        'hora',
        'dia',
        'mes',
        'año',
        'timestamp'
    ]);

    private constructor() {
        this.templatesRepo = TemplatesRepository.getInstance();
    }

    static getInstance(): TemplateService {
        if (!TemplateService.instance) {
            TemplateService.instance = new TemplateService();
        }
        return TemplateService.instance;
    }

    /**
     * Extract all variables from a template body
     * Returns unique variable names found in {{variable}} format
     */
    extractVariables(body: string): string[] {
        if (!body) return [];

        const variables = new Set<string>();
        let match;

        // Reset regex lastIndex
        this.VARIABLE_REGEX.lastIndex = 0;

        while ((match = this.VARIABLE_REGEX.exec(body)) !== null) {
            variables.add(match[1]);
        }

        return Array.from(variables);
    }

    /**
     * Extract variables with metadata
     */
    extractVariablesWithMeta(body: string): TemplateVariable[] {
        const variableNames = this.extractVariables(body);
        
        return variableNames.map(name => ({
            name,
            required: !this.RESERVED_VARIABLES.has(name.toLowerCase()),
            description: this.getVariableDescription(name)
        }));
    }

    /**
     * Get description for known variable names
     */
    private getVariableDescription(name: string): string | undefined {
        const descriptions: Record<string, string> = {
            nombre: 'Nombre del destinatario',
            apellido: 'Apellido del destinatario',
            nombreCompleto: 'Nombre completo',
            alumno: 'Nombre del alumno',
            fecha: 'Fecha actual (auto)',
            hora: 'Hora actual (auto)',
            dia: 'Día de la semana (auto)',
            mes: 'Mes actual (auto)',
            año: 'Año actual (auto)',
            clase: 'Nombre de la clase',
            horario: 'Horario de la clase',
            instrumento: 'Instrumento del alumno',
            grupo: 'Nombre del grupo/ensamble',
            evento: 'Nombre del evento',
            fechaEvento: 'Fecha del evento',
            lugar: 'Lugar del evento',
            motivo: 'Motivo o razón',
            mensaje: 'Mensaje personalizado'
        };

        return descriptions[name];
    }

    /**
     * Get built-in variable values
     */
    private getBuiltInVariables(): Record<string, string> {
        const now = new Date();
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        return {
            fecha: now.toLocaleDateString('es-DO'),
            hora: now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
            dia: dias[now.getDay()],
            mes: meses[now.getMonth()],
            año: now.getFullYear().toString(),
            timestamp: now.toISOString()
        };
    }

    /**
     * Render a template with provided variables
     * 
     * @param body - Template body with {{variables}}
     * @param vars - Object with variable values
     * @returns RenderResult with rendered text or errors
     */
    renderTemplate(body: string, vars: Record<string, string> = {}): RenderResult {
        if (!body) {
            return {
                success: false,
                error: 'Template body is empty'
            };
        }

        // Merge with built-in variables (user vars take precedence)
        const allVars = {
            ...this.getBuiltInVariables(),
            ...vars
        };

        // Extract required variables
        const requiredVars = this.extractVariables(body).filter(
            v => !this.RESERVED_VARIABLES.has(v.toLowerCase())
        );

        // Check for missing required variables
        const missingVars = requiredVars.filter(v => !allVars[v]);
        
        if (missingVars.length > 0) {
            return {
                success: false,
                missingVariables: missingVars,
                error: `Missing required variables: ${missingVars.join(', ')}`
            };
        }

        // Perform safe replacement
        let rendered = body;
        
        // Reset regex
        this.VARIABLE_REGEX.lastIndex = 0;
        
        rendered = body.replace(this.VARIABLE_REGEX, (match, varName) => {
            const value = allVars[varName];
            if (value !== undefined && value !== null) {
                return String(value);
            }
            // Leave unmatched variables as-is (shouldn't happen if validation passed)
            return match;
        });

        return {
            success: true,
            rendered
        };
    }

    /**
     * Render a template by ID
     */
    async renderTemplateById(
        templateId: string, 
        vars: Record<string, string> = {}
    ): Promise<RenderResult> {
        const template = await this.templatesRepo.findById(templateId);
        
        if (!template) {
            return {
                success: false,
                error: `Template not found: ${templateId}`
            };
        }

        const result = this.renderTemplate(template.body, vars);
        
        if (result.success) {
            // Increment usage count
            await this.templatesRepo.incrementUsage(templateId);
        }

        return result;
    }

    /**
     * Render a template by slug
     */
    async renderTemplateBySlug(
        slug: string, 
        vars: Record<string, string> = {}
    ): Promise<RenderResult> {
        const template = await this.templatesRepo.findBySlug(slug);
        
        if (!template) {
            return {
                success: false,
                error: `Template not found: ${slug}`
            };
        }

        const result = this.renderTemplate(template.body, vars);
        
        if (result.success) {
            await this.templatesRepo.incrementUsage(template.id);
        }

        return result;
    }

    /**
     * Validate a template body
     */
    validateTemplate(body: string): TemplateValidation {
        const errors: string[] = [];
        const warnings: string[] = [];
        const variables = this.extractVariablesWithMeta(body);

        // Check for empty body
        if (!body || body.trim().length === 0) {
            errors.push('Template body cannot be empty');
        }

        // Check for unclosed brackets
        const openBrackets = (body.match(/\{\{/g) || []).length;
        const closeBrackets = (body.match(/\}\}/g) || []).length;
        
        if (openBrackets !== closeBrackets) {
            errors.push('Mismatched brackets: check for unclosed {{ or }}');
        }

        // Check for invalid variable names
        const invalidVars = variables.filter(v => !/^\w+$/.test(v.name));
        if (invalidVars.length > 0) {
            errors.push(`Invalid variable names: ${invalidVars.map(v => v.name).join(', ')}`);
        }

        // Warnings for very long templates
        if (body.length > 4096) {
            warnings.push('Template is very long. Consider breaking into smaller templates.');
        }

        // Warning for too many variables
        if (variables.length > 10) {
            warnings.push(`Template has ${variables.length} variables. Consider simplifying.`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            variables
        };
    }

    /**
     * Validate that all required variables are provided
     */
    validateRequiredVars(
        body: string, 
        providedVars: Record<string, string>
    ): { valid: boolean; missing: string[] } {
        const requiredVars = this.extractVariables(body).filter(
            v => !this.RESERVED_VARIABLES.has(v.toLowerCase())
        );

        const missing = requiredVars.filter(v => !providedVars[v]);

        return {
            valid: missing.length === 0,
            missing
        };
    }

    /**
     * Preview a template with sample data
     */
    previewTemplate(body: string, sampleVars?: Record<string, string>): RenderResult {
        const variables = this.extractVariables(body);
        
        // Generate sample values for any missing variables
        const allVars: Record<string, string> = {
            ...this.getBuiltInVariables(),
            ...(sampleVars || {})
        };

        for (const varName of variables) {
            if (!allVars[varName]) {
                allVars[varName] = `[${varName}]`;
            }
        }

        return this.renderTemplate(body, allVars);
    }

    /**
     * Get commonly used templates
     */
    async getPopularTemplates(limit: number = 10): Promise<Template[]> {
        const templates = await this.templatesRepo.findActive();
        
        return templates
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, limit);
    }

    /**
     * Create a template with validation
     */
    async createTemplate(input: {
        name: string;
        body: string;
        category: Template['category'];
        description?: string;
        tags?: string[];
    }): Promise<{ success: boolean; template?: Template; errors?: string[] }> {
        // Validate
        const validation = this.validateTemplate(input.body);
        
        if (!validation.isValid) {
            return {
                success: false,
                errors: validation.errors
            };
        }

        // Check for duplicate name
        const existing = await this.templatesRepo.findBySlug(
            input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        );
        
        if (existing) {
            return {
                success: false,
                errors: ['A template with a similar name already exists']
            };
        }

        // Create template
        const template = await this.templatesRepo.create({
            name: input.name,
            slug: '', // Will be auto-generated
            body: input.body,
            category: input.category,
            variables: validation.variables,
            isActive: true,
            usageCount: 0,
            description: input.description,
            tags: input.tags || []
        });

        return {
            success: true,
            template
        };
    }
}

export default TemplateService;
