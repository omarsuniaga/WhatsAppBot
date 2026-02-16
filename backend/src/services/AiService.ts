/**
 * AiService - Generate templates and variations with AI
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

interface TemplateGenerationRequest {
    purpose: string;
    tone: string;
    additionalContext?: string;
    targetAudience?: string;
}

interface VariationRequest {
    baseContent: string;
    baseName: string;
    newTone: string;
    purpose?: string;
}

interface TemplateResponse {
    nombre: string;
    contenido: string;
    variables?: string[];
}

interface VariationResponse {
    nombre: string;
    contenido: string;
}

class AiService {
    private apiKey: string | null;

    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || null;
        if (!this.apiKey) {
            console.log('[AiService] No GEMINI_API_KEY configured - will return mock responses');
        }
    }

    /**
     * Generate a template with AI based on purpose and tone
     */
    async generateTemplate(request: TemplateGenerationRequest): Promise<TemplateResponse> {
        if (!this.apiKey) {
            return this.getMockTemplate(request);
        }

        try {
            const prompt = this.buildTemplatePrompt(request);
            const response = await this.callGemini(prompt);
            return this.parseTemplateResponse(response);
        } catch (error: any) {
            console.error('[AiService] Error generating template:', error.message);
            // Fallback to mock response
            return this.getMockTemplate(request);
        }
    }

    /**
     * Generate a variation of an existing template
     */
    async generateVariation(request: VariationRequest): Promise<VariationResponse> {
        if (!this.apiKey) {
            return this.getMockVariation(request);
        }

        try {
            const prompt = this.buildVariationPrompt(request);
            const response = await this.callGemini(prompt);
            return this.parseVariationResponse(response, request);
        } catch (error: any) {
            console.error('[AiService] Error generating variation:', error.message);
            // Fallback to mock response
            return this.getMockVariation(request);
        }
    }

    /**
     * Call Gemini API
     */
    private async callGemini(prompt: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('No API key configured');
        }

        const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt,
                    }],
                }],
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error: ${error}`);
        }

        const data: any = await response.json();
        
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('No response from Gemini');
        }

        return data.candidates[0].content.parts[0].text;
    }

    /**
     * Build prompt for template generation
     */
    private buildTemplatePrompt(request: TemplateGenerationRequest): string {
        return `Genera una plantilla de mensaje para WhatsApp.

ESPECIFICACIONES:
- Propósito: ${request.purpose}
- Tono: ${request.tone}
- Audiencia: ${request.targetAudience || 'general'}
${request.additionalContext ? `- Contexto adicional: ${request.additionalContext}` : ''}

REQUISITOS:
1. El mensaje debe ser para enviarse por WhatsApp
2. Máximo 1000 caracteres
3. Incluye variables entre corchetes {{nombre}}, {{apellido}}, {{fecha}}, etc. donde sea apropiado
4. El tono debe ser ${request.tone}
5. El mensaje debe ser claro, directo y profesional

Responde en formato JSON (SOLO JSON, sin markdown):
{
  "nombre": "Nombre descriptivo de la plantilla",
  "contenido": "El contenido del mensaje con {{variables}}"
}`;
    }

    /**
     * Build prompt for variation generation
     */
    private buildVariationPrompt(request: VariationRequest): string {
        return `Crea una variación del siguiente mensaje de WhatsApp con un tono ${request.newTone}.

MENSAJE ORIGINAL:
${request.baseContent}

REQUISITOS:
1. Mantén el significado y contenido general
2. Cambia el tono a: ${request.newTone}
3. Máximo 1000 caracteres
4. Preserva todas las variables {{como_esta}}
5. Mantén la claridad y profesionalismo

Responde en formato JSON (SOLO JSON, sin markdown):
{
  "nombre": "Nombre descriptivo actualizado",
  "contenido": "El contenido del mensaje variado con {{variables}}"
}`;
    }

    /**
     * Parse template response from Gemini
     */
    private parseTemplateResponse(text: string): TemplateResponse {
        try {
            // Try to extract JSON from the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const data = JSON.parse(jsonMatch[0]);
            
            // Extract variables from content
            const variableMatches = (data.contenido.match(/{{\s*(\w+)\s*}}/g) || []) as string[];
            const variables: string[] = variableMatches.map((match: string) => 
                match.replace(/{{\s*|\s*}}/g, '')
            );

            return {
                nombre: data.nombre || 'Nueva Plantilla',
                contenido: data.contenido || '',
                variables: [...new Set(variables)] as string[],
            };
        } catch (error) {
            console.error('[AiService] Error parsing template response:', error);
            return this.getMockTemplate({ purpose: 'default', tone: 'profesional' });
        }
    }

    /**
     * Parse variation response from Gemini
     */
    private parseVariationResponse(text: string, request: VariationRequest): VariationResponse {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const data = JSON.parse(jsonMatch[0]);
            return {
                nombre: data.nombre || request.baseName,
                contenido: data.contenido || request.baseContent,
            };
        } catch (error) {
            console.error('[AiService] Error parsing variation response:', error);
            return this.getMockVariation(request);
        }
    }

    /**
     * Mock template for when API is not configured
     */
    private getMockTemplate(request: TemplateGenerationRequest): TemplateResponse {
        const templates: Record<string, Record<string, TemplateResponse>> = {
            recordatorio: {
                formal: {
                    nombre: 'Recordatorio Formal',
                    contenido: 'Le recordamos que la {{actividad}} está programada para {{fecha}} a las {{hora}}. Por favor, confirme su asistencia.',
                    variables: ['actividad', 'fecha', 'hora'],
                },
                amigable: {
                    nombre: 'Recordatorio Amigable',
                    contenido: '¡Hola {{nombre}}! 👋 Solo recordarte que {{actividad}} es {{fecha}} a las {{hora}}. ¿Nos ves? 😊',
                    variables: ['nombre', 'actividad', 'fecha', 'hora'],
                },
            },
            bienvenida: {
                formal: {
                    nombre: 'Bienvenida Formal',
                    contenido: 'Estimado {{nombre}}, bienvenido a nuestro programa. Nos complace contar con su participación.',
                    variables: ['nombre'],
                },
                amigable: {
                    nombre: 'Bienvenida Amigable',
                    contenido: '¡Hola {{nombre}}! 🎉 Bienvenido a nuestro equipo. ¡Nos alegra mucho tenerte con nosotros!',
                    variables: ['nombre'],
                },
            },
            confirmacion: {
                formal: {
                    nombre: 'Confirmación Formal',
                    contenido: 'Confirmamos que su registro para {{evento}} ha sido completado. Su código de confirmación es {{codigo}}.',
                    variables: ['evento', 'codigo'],
                },
                amigable: {
                    nombre: 'Confirmación Amigable',
                    contenido: '✅ ¡Listo! Tu registro en {{evento}} está confirmado. Tu código: {{codigo}}',
                    variables: ['evento', 'codigo'],
                },
            },
        };

        const purpose = request.purpose || 'recordatorio';
        const tone = request.tone || 'profesional';

        return templates[purpose]?.[tone] || {
            nombre: `${purpose.charAt(0).toUpperCase() + purpose.slice(1)} (${tone})`,
            contenido: `Plantilla personalizada para {{nombre}} - {{fecha}}`,
            variables: ['nombre', 'fecha'],
        };
    }

    /**
     * Mock variation for when API is not configured
     */
    private getMockVariation(request: VariationRequest): VariationResponse {
        const toneVariations: Record<string, string> = {
            formal: '(Versión Formal) ',
            amigable: '(Versión Amigable) ',
            conciso: '(Versión Concisa) ',
            profesional: '(Versión Profesional) ',
        };

        return {
            nombre: `${request.baseName} ${toneVariations[request.newTone] || request.newTone}`,
            contenido: request.baseContent, // In mock, return same content
        };
    }
}

export const aiService = new AiService();
