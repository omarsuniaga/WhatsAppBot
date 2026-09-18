/**
 * Driven adapter — sends an approved follow-up through the existing
 * WhatsApp connection (BotService), which already applies rate limiting
 * per CLAUDE.md's "mínimo 2s entre mensajes" rule.
 */
import BotService from '../../../server/services/botService';
import type { MessageSender } from '../domain/ports';

export class BotServiceMessageSender implements MessageSender {
    async send(chatJid: string, message: string): Promise<void> {
        await BotService.getInstance().sendText(chatJid, message);
    }
}
