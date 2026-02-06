/**
 * TemplateService - Template variable extraction and rendering
 * 
 * Domain service for message template handling. No HTTP/UI dependencies.
 */

import { EventEmitter } from 'events';

export class TemplateService extends EventEmitter {
    private static instance: TemplateService;

    private constructor() {
        super();
    }

    public static getInstance(): TemplateService {
        if (!TemplateService.instance) {
            TemplateService.instance = new TemplateService();
        }
        return TemplateService.instance;
    }

    /**
     * Extracts variable names from a template string.
     * @param body - The template with {{variable}} placeholders.
     * @returns A list of unique variable names.
     */
    extractVariables(body: string): string[] {
        const regex = /{{\s*(\w+)\s*}}/g;
        const matches = body.match(regex) || [];
        const variables = matches.map(match => match.replace(/{{\s*|\s*}}/g, ''));
        return Array.from(new Set(variables));
    }

    /**
     * Renders a template with the given variables.
     * Replaces {{variable}} placeholders safely.
     * @param body - The template string.
     * @param vars - An object with variable keys and values.
     * @returns The rendered string.
     */
    render(body: string, vars: Record<string, string | number>): string {
        const rendered = body.replace(/{{\s*(\w+)\s*}}/g, (placeholder, varName) => {
            const value = vars[varName];
            // Return the value if it exists, otherwise return the original placeholder
            return value !== undefined ? String(value) : placeholder;
        });
        this.emit('template:rendered', { body, vars, rendered });
        return rendered;
    }

    /**
     * Validates if all variables in a template are provided.
     * @param template - The template string.
     * @param vars - The variables object to check.
     * @returns An object with a boolean `ok` and a list of `missingVars`.
     */
    validate(template: string, vars: Record<string, unknown>): { ok: boolean; missingVars: string[] } {
        const requiredVars = this.extractVariables(template);
        const providedVars = Object.keys(vars);
        const missingVars = requiredVars.filter(v => !providedVars.includes(v));
        const result = {
            ok: missingVars.length === 0,
            missingVars,
        };
        this.emit('template:validated', { template, vars, result });
        return result;
    }
}

export default TemplateService;
