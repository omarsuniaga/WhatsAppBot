import { Request, Response } from 'express';
import { BotOrchestrator } from '../../agents/BotOrchestrator';
import { AIService } from '../services/aiService';
import Logger from '../services/loggerService';
import { getErrorMessage } from '../utils/errorUtils';

/**
 * Get AI configuration status
 */
export const getAIConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const config = orchestrator.getConfig();

        // Runtime memory keys + environment fallback
        const groqActiveKey = config.aiConfig.groqApiKey || process.env.GROQ_API_KEY || '';
        const geminiActiveKey = config.aiConfig.geminiApiKey || process.env.GEMINI_API_KEY || '';

        const hasGroqKey = !!groqActiveKey;
        const hasGeminiKey = !!geminiActiveKey;
        const preferredProvider = config.aiConfig.preferredProvider || 'groq';

        let activeKey = '';
        let source = 'none';
        if (preferredProvider === 'groq' && hasGroqKey) {
            activeKey = groqActiveKey;
            source = config.aiConfig.groqApiKey ? 'runtime' : 'env';
        } else if (preferredProvider === 'gemini' && hasGeminiKey) {
            activeKey = geminiActiveKey;
            source = config.aiConfig.geminiApiKey ? 'runtime' : 'env';
        }

        res.json({
            success: true,
            configured: (preferredProvider === 'groq' && hasGroqKey) || (preferredProvider === 'gemini' && hasGeminiKey),
            maskedKey: activeKey ? `***${activeKey.slice(-4)}` : null,
            source,
            aiConfig: {
                preferredProvider,
                enableFailover: !!config.aiConfig.enableFailover,
                hasGroqKey,
                hasGeminiKey
            },
            settings: {
                useGeminiFallback: config.settings.useGeminiFallback,
                minConfidenceForQA: config.settings.minConfidenceForQA
            }
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * Update AI configuration (API Key)
 */
/**
 * Update AI configuration (API Keys & Providers)
 */
export const updateAIConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const { geminiApiKey, groqApiKey, preferredProvider, enableFailover } = req.body;

        const orchestrator = BotOrchestrator.getInstance();
        const currentConfig = orchestrator.getConfig();

        // Runtime-only key updates. Keys are intentionally not persisted to disk.
        orchestrator.updateAIConfig({
            preferredProvider: preferredProvider !== undefined ? preferredProvider : currentConfig.aiConfig.preferredProvider,
            enableFailover: enableFailover !== undefined ? enableFailover : currentConfig.aiConfig.enableFailover,
            groqApiKey: groqApiKey !== undefined ? groqApiKey : currentConfig.aiConfig.groqApiKey,
            geminiApiKey: geminiApiKey !== undefined ? geminiApiKey : currentConfig.aiConfig.geminiApiKey
        });

        const updatedConfig = orchestrator.getConfig();
        res.json({
            success: true,
            message: 'AI config updated in runtime memory (not persisted)',
            config: {
                preferredProvider: updatedConfig.aiConfig.preferredProvider,
                enableFailover: updatedConfig.aiConfig.enableFailover,
                hasGroqKey: !!(updatedConfig.aiConfig.groqApiKey || process.env.GROQ_API_KEY),
                hasGeminiKey: !!(updatedConfig.aiConfig.geminiApiKey || process.env.GEMINI_API_KEY)
            }
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};



/**
 * Helper: Extract variables from template content
 */
const extractVariables = (content: string): string[] => {
    const regex = /{{\s*(\w+)\s*}}/g;
    const matches = content.match(regex) || [];
    const variables = matches.map(match => match.replace(/{{\s*|\s*}}/g, ''));
    return [...new Set(variables)];
};

/**
 * Generate a template using AI Service
 */
export const generateTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { purpose, tone, additionalContext, targetAudience } = req.body;

        if (!purpose || !tone) {
            res.status(400).json({
                success: false,
                error: 'purpose and tone are required'
            });
            return;
        }

        const purposeDescriptions: Record<string, string> = {
            recordatorio: 'recordatorio de clase, evento o cita próxima',
            bienvenida: 'mensaje de bienvenida cálido para nuevos estudiantes o padres',
            confirmacion: 'confirmación de inscripción, pago realizado o asistencia',
            promocion: 'promoción atractiva de clases, eventos especiales o descuentos',
            personalizado: additionalContext || 'mensaje personalizado según las necesidades'
        };

        const toneDescriptions: Record<string, string> = {
            formal: 'formal y respetuoso, utilizando "usted" y un tono serio',
            amigable: 'amigable y cercano, con emojis moderados y un tono cálido',
            profesional: 'profesional pero accesible, equilibrado y claro',
            casual: 'casual y relajado, como hablando con un amigo'
        };

        // Map purpose to valid backend category
        const categoryMap: Record<string, string> = {
            recordatorio: 'reminder',
            bienvenida: 'welcome',
            confirmacion: 'announcement',
            promocion: 'event',
            personalizado: 'general'
        };

        const prompt = `Eres un redactor experto de mensajes de WhatsApp para una academia de música llamada "El Sistema Punta Cana". Genera un mensaje ORIGINAL y CREATIVO.

PROPÓSITO DEL MENSAJE: ${purposeDescriptions[purpose] || purpose}
TONO REQUERIDO: ${toneDescriptions[tone] || tone}
AUDIENCIA OBJETIVO: ${targetAudience || 'padres de familia y estudiantes'}
${additionalContext ? `CONTEXTO ADICIONAL: ${additionalContext}` : ''}

INSTRUCCIONES CRÍTICAS:
1. El mensaje debe ser ÚNICO y ORIGINAL, no uses frases genéricas
2. Adapta el lenguaje al tono especificado
3. Usa variables con el formato {{variable}} para datos dinámicos
4. Variables disponibles: {{nombre}}, {{fecha}}, {{hora}}, {{instrumento}}, {{profesor}}, {{salon}}
5. Máximo 350 caracteres para que sea legible en WhatsApp
6. Incluye emojis apropiados si el tono lo permite (máximo 3-4 emojis)
7. El mensaje debe sentirse personal y humano

RESPONDE ÚNICAMENTE con un objeto JSON válido (sin markdown, sin explicaciones):
{
    "nombre": "Nombre descriptivo único de la plantilla",
    "contenido": "El mensaje creativo con variables {{variable}}",
    "variables": ["nombre", "fecha", ...]
}`;

        Logger.info('[AI Controller] Generating template with AI Service');

        const aiService = AIService.getInstance();
        const response = await aiService.generateText(prompt, {
            temperature: 0.8, // Slightly higher creative freedom
            systemPrompt: "Eres un asistente experto en redacción de mensajes de marketing y comunicación institucional."
        });

        // Parse JSON from response
        const textResponse = response.text;
        let cleaned = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

        if (!jsonMatch) throw new Error('No valid JSON found in response');

        const parsed = JSON.parse(jsonMatch[0]);

        res.json({
            success: true,
            template: {
                nombre: parsed.nombre,
                contenido: parsed.contenido,
                categoria: categoryMap[purpose] || 'general',
                variables: parsed.variables || extractVariables(parsed.contenido)
            },
            generatedByAI: true,
            provider: response.provider,
            model: response.model
        });
    } catch (error: unknown) {
        Logger.error('[AI Controller] generateTemplate error:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error) || 'Error generando plantilla con IA',
            hint: 'Verifica tu configuración de AI (Gemini/Groq)'
        });
    }
};

/**
 * Generate a variation of an existing template - REAL GEMINI GENERATION ONLY
 */
/**
 * Generate a variation of an existing template using AI Service
 */
export const generateVariation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { baseContent, baseName, newTone } = req.body;

        if (!baseContent || !newTone) {
            res.status(400).json({
                success: false,
                error: 'baseContent and newTone are required'
            });
            return;
        }

        const toneDescriptions: Record<string, string> = {
            formal: 'más formal y respetuoso, usando "usted" y eliminando emojis',
            amigable: 'más amigable y cercano, con emojis apropiados y tono cálido',
            conciso: 'más breve y directo, eliminando palabras innecesarias',
            profesional: 'profesional pero accesible, equilibrado'
        };

        const originalVars = extractVariables(baseContent);

        const prompt = `Eres un redactor experto. Reescribe el siguiente mensaje de WhatsApp manteniendo su propósito pero cambiando el tono.

MENSAJE ORIGINAL:
${baseContent}

NUEVO TONO REQUERIDO: ${toneDescriptions[newTone] || newTone}

INSTRUCCIONES CRÍTICAS:
1. MANTÉN EXACTAMENTE las mismas variables: ${originalVars.map(v => `{{${v}}}`).join(', ')}
2. El mensaje debe tener el mismo propósito y significado
3. Adapta SOLO el estilo y tono del lenguaje
4. Máximo 350 caracteres
5. El mensaje debe ser natural y fluido

RESPONDE ÚNICAMENTE con un objeto JSON válido:
{
    "nombre": "${baseName || 'Plantilla'} - Versión ${newTone}",
    "contenido": "El mensaje reescrito con las MISMAS variables",
    "cambios": "Descripción breve de qué cambió en el tono"
}`;

        Logger.info('[AI Controller] Generating variation with AI Service');

        const aiService = AIService.getInstance();
        const response = await aiService.generateText(prompt, {
            temperature: 0.7,
            systemPrompt: "Eres un editor experto que adapta textos a diferentes tonos manteniendo la información intacta."
        });

        const textResponse = response.text;
        let cleaned = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

        if (!jsonMatch) throw new Error('No valid JSON found in response');

        const parsed = JSON.parse(jsonMatch[0]);

        // Verify variables match
        const newVars = extractVariables(parsed.contenido);
        const missingVars = originalVars.filter(v => !newVars.includes(v));

        if (missingVars.length > 0) {
            Logger.warn('[AI Controller] Missing variables in variation:', missingVars);
        }

        res.json({
            success: true,
            variation: {
                nombre: parsed.nombre,
                contenido: parsed.contenido,
                categoria: 'general',
                variables: originalVars,
                cambios: parsed.cambios || 'Tono ajustado'
            },
            generatedByAI: true,
            provider: response.provider,
            model: response.model
        });
    } catch (error: unknown) {
        Logger.error('[AI Controller] generateVariation error:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error) || 'Error generando variación con IA',
            hint: 'Verifica tu configuración de AI'
        });
    }
};

/**
 * Test AI Connection with provided or saved API Key
 */
/**
 * Test AI Connection with provided config
 */
export const testAIConnection = async (req: Request, res: Response): Promise<void> => {
    try {
        const { apiKey, provider = 'gemini' } = req.body;
        const normalizedProvider = String(provider || 'gemini').toLowerCase();

        if (normalizedProvider !== 'gemini' && normalizedProvider !== 'groq') {
            res.status(400).json({
                success: false,
                error: `Provider no soportado: ${provider}`,
                rawError: 'Unsupported provider'
            });
            return;
        }

        Logger.info(`[AI Controller] Testing connection for ${normalizedProvider}`);

        const aiService = AIService.getInstance();
        const result = await aiService.testConnection(normalizedProvider as 'gemini' | 'groq', apiKey);

        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                model: result.model
            });
        } else {
            // Specific error handling
            const userMessage = result.message.includes('403') || result.message.includes('leaked')
                ? '⛔ API Key inválida o bloqueada.'
                : result.message;

            res.status(400).json({
                success: false,
                error: userMessage,
                rawError: result.message,
                provider: normalizedProvider
            });
        }
    } catch (error: unknown) {
        Logger.error('[AI Controller] Connection test failed:', getErrorMessage(error));
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

