/**
 * AI API Client - Frontend service for AI features
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/admin';

export interface GenerateTemplateRequest {
    purpose: string;         // "recordatorio" | "bienvenida" | "confirmacion" | "promocion" | "personalizado"
    tone: string;            // "formal" | "amigable" | "profesional"
    additionalContext?: string;
    targetAudience: string;  // "padres" | "alumnos" | "todos"
}

export interface GenerateTemplateResponse {
    success: boolean;
    template?: {
        nombre: string;
        contenido: string;
        categoria: string;
        variables: string[];
    };
    error?: string;
}

export interface GenerateVariationRequest {
    baseContent: string;
    baseName?: string;
    newTone: string;
    purpose?: string;
}

export interface GenerateVariationResponse {
    success: boolean;
    variation?: {
        nombre: string;
        contenido: string;
        categoria: string;
        variables: string[];
        cambios: string;
    };
    error?: string;
}

/**
 * Generate a template using AI (Gemini)
 */
export async function generateTemplate(request: GenerateTemplateRequest): Promise<GenerateTemplateResponse> {
    const response = await fetch(`${API_BASE}/ai/generate-template`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        credentials: 'include' // Include auth cookies
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al generar plantilla con IA');
    }

    return response.json();
}

/**
 * Generate a variation of an existing template
 */
export async function generateVariation(request: GenerateVariationRequest): Promise<GenerateVariationResponse> {
    const response = await fetch(`${API_BASE}/ai/generate-variation`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al generar variación con IA');
    }

    return response.json();
}

export const aiApi = {
    generateTemplate,
    generateVariation
};
