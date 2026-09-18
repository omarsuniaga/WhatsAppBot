/**
 * Driven adapter — default MessageGenerator: a plain, deterministic
 * template, no external API call. Swap for a Gemini-backed adapter later
 * without touching application/domain code (see domain/ports.ts).
 */
import type { MessageGenerator } from '../domain/ports';

export class TemplateMessageGenerator implements MessageGenerator {
    async generate(input: {
        contactName: string;
        relationType: string;
        summary: string;
        reason: 'flow_abandoned' | 'inactive_lead';
        flowLabel?: string;
    }): Promise<string> {
        const { contactName, reason, flowLabel } = input;

        if (reason === 'flow_abandoned' && flowLabel) {
            return `Hola ${contactName}, quería retomar contigo lo de "${flowLabel}" — ¿seguimos con eso o prefieres que te contacte más adelante?`;
        }

        return `Hola ${contactName}, ¿cómo vas? Quería saber si sigues interesado/a en conversar, aquí estoy si necesitas algo.`;
    }
}
