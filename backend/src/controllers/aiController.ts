/**
 * AI Controller - Gemini-powered intelligent features
 */

import { Request, Response } from 'express';

// Gemini API configuration
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

interface GenerateTemplateRequest {
    purpose: string;      // "recordatorio" | "bienvenida" | "confirmacion" | "promocion" | "personalizado"
    tone: string;         // "formal" | "amigable" | "profesional"
    additionalContext?: string;
    targetAudience: string; // "padres" | "alumnos" | "todos"
}

interface GenerateTemplateResponse {
    success: boolean;
    template?: {
        nombre: string;
        contenido: string;
        categoria: string;
        variables: string[];
    };
    error?: string;
}

// Extract variables from template content
function extractVariables(content: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        if (!variables.includes(match[1])) {
            variables.push(match[1]);
        }
    }
    return variables;
}

// Build prompt for Gemini
function buildPrompt(request: GenerateTemplateRequest): string {
    const { purpose, tone, additionalContext, targetAudience } = request;

    const purposeDescriptions: Record<string, string> = {
        recordatorio: 'un recordatorio de evento o actividad',
        bienvenida: 'un mensaje de bienvenida para nuevos estudiantes o padres',
        confirmacion: 'solicitar confirmación de asistencia a un evento',
        promocion: 'promocionar o invitar a una actividad',
        personalizado: 'un mensaje personalizado'
    };

    const toneDescriptions: Record<string, string> = {
        formal: 'formal y respetuoso',
        amigable: 'amigable y cercano',
        profesional: 'profesional pero accesible'
    };

    const prompt = `Eres un asistente especializado en redactar mensajes profesionales para WhatsApp de una academia de música.

TAREA:
Redacta un mensaje de WhatsApp para ${targetAudience} con el propósito de ${purposeDescriptions[purpose] || purpose}.

REQUISITOS:
1. Tono: ${toneDescriptions[tone] || tone}
2. Formato WhatsApp (breve, directo, con emojis apropiados)
3. Incluir variables entre {{}} para personalización (ej: {{nombre}}, {{fecha}}, {{hora}}, {{instrumento}}, {{profesor}})
4. Máximo 400 caracteres
5. Incluir llamada a la acción clara
${additionalContext ? `6. Contexto adicional: ${additionalContext}` : ''}

EJEMPLOS DE VARIABLES ÚTILES:
- {{nombre}} - Nombre del destinatario
- {{fecha}} - Fecha del evento
- {{hora}} - Hora del evento
- {{instrumento}} - Instrumento musical
- {{profesor}} - Nombre del profesor
- {{salon}} - Salón de clase
- {{alumno}} - Nombre del alumno

Devuelve SOLO formato JSON válido sin markdown:
{
  "nombre": "Título descriptivo de la plantilla (máx 50 caracteres)",
  "contenido": "texto del mensaje con {{variables}}",
  "categoria": "general|ventas|soporte|marketing|recordatorios"
}`;

    return prompt;
}

// Call Gemini API
async function callGemini(prompt: string, apiKey: string): Promise<any> {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 512
            }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('No response from Gemini');
    }

    return text;
}

// Parse Gemini response
function parseGeminiResponse(text: string): { nombre: string; contenido: string; categoria: string } {
    // Remove markdown code blocks if present
    let jsonStr = text.trim();

    if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
    }

    jsonStr = jsonStr.trim();

    try {
        const parsed = JSON.parse(jsonStr);
        return {
            nombre: parsed.nombre || 'Plantilla Generada',
            contenido: parsed.contenido || '',
            categoria: parsed.categoria || 'general'
        };
    } catch (e) {
        // If parsing fails, try to extract content manually
        const nameMatch = text.match(/"nombre":\s*"([^"]+)"/);
        const contentMatch = text.match(/"contenido":\s*"([^"]+)"/);
        const categoriaMatch = text.match(/"categoria":\s*"([^"]+)"/);

        return {
            nombre: nameMatch?.[1] || 'Plantilla Generada',
            contenido: contentMatch?.[1] || text,
            categoria: categoriaMatch?.[1] || 'general'
        };
    }
}

/**
 * Generate template using Gemini AI
 */
export async function generateTemplate(req: Request, res: Response) {
    try {
        const requestData: GenerateTemplateRequest = req.body;

        // Validate request
        if (!requestData.purpose || !requestData.tone || !requestData.targetAudience) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: purpose, tone, targetAudience'
            });
        }

        // Get API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                error: 'Gemini API key not configured'
            });
        }

        // Build prompt
        const prompt = buildPrompt(requestData);

        // Call Gemini
        const rawResponse = await callGemini(prompt, apiKey);

        // Parse response
        const parsedTemplate = parseGeminiResponse(rawResponse);

        // Extract variables
        const variables = extractVariables(parsedTemplate.contenido);

        // Return template
        const response: GenerateTemplateResponse = {
            success: true,
            template: {
                nombre: parsedTemplate.nombre,
                contenido: parsedTemplate.contenido,
                categoria: parsedTemplate.categoria,
                variables
            }
        };

        res.json(response);

    } catch (error: any) {
        console.error('[AI Controller] Error generating template:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al generar plantilla con IA'
        });
    }
}

/**
 * Generate a variation of an existing template
 */
export async function generateVariation(req: Request, res: Response) {
    try {
        const { baseContent, baseName, newTone, purpose } = req.body;

        // Validate request
        if (!baseContent || !newTone) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: baseContent, newTone'
            });
        }

        // Get API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                error: 'Gemini API key not configured'
            });
        }

        // Build variation prompt
        const toneDescriptions: Record<string, string> = {
            formal: 'más formal y respetuoso, usando usted en lugar de tú',
            amigable: 'más amigable y cercano, cálido y acogedor',
            conciso: 'más breve y directo al punto, sin perder claridad',
            profesional: 'profesional pero accesible, manteniendo cordialidad'
        };

        const prompt = `Eres un experto en redacción de mensajes para WhatsApp.

TAREA:
Genera una VARIACIÓN del siguiente mensaje con un tono ${toneDescriptions[newTone] || newTone}.

MENSAJE ORIGINAL:
${baseContent}

REQUISITOS ESTRICTOS:
1. Mantener EXACTAMENTE las mismas variables {{}} que el original
2. Mantener el mismo propósito general del mensaje
3. Cambiar la redacción aplicando tono: ${newTone}
4. Formato WhatsApp (emojis apropiados si son necesarios)
5. Máximo 400 caracteres
6. Mantener llamada a la acción si la hay

Devuelve SOLO formato JSON válido sin markdown:
{
  "nombre": "Título descriptivo de esta variación (máx 50 caracteres)",
  "contenido": "nueva versión con {{variables}}",
  "cambios": "breve descripción de qué cambió (1 línea)"
}`;

        // Call Gemini
        const rawResponse = await callGemini(prompt, apiKey);

        // Parse response
        const parsed = parseGeminiResponse(rawResponse);

        // Extract variables to ensure consistency
        const originalVars = extractVariables(baseContent);
        const newVars = extractVariables(parsed.contenido);

        // Verify variables match
        const varsMatch = originalVars.length === newVars.length &&
            originalVars.every(v => newVars.includes(v));

        if (!varsMatch) {
            console.warn('[AI] Variable mismatch in variation, using original variables');
            // This is a warning, but we'll still return the variation
        }

        // Return variation
        const response = {
            success: true,
            variation: {
                nombre: parsed.nombre || `${baseName || 'Plantilla'} (${newTone})`,
                contenido: parsed.contenido,
                categoria: 'general',
                variables: newVars,
                cambios: (rawResponse.match(/"cambios":\s*"([^"]+)"/) || [])[1] || `Versión ${newTone}`
            }
        };

        res.json(response);

    } catch (error: any) {
        console.error('[AI Controller] Error generating variation:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al generar variación con IA'
        });
    }
}

export default { generateTemplate, generateVariation };

