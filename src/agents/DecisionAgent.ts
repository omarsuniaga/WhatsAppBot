/**
 * Este agente decide SI se debe responder a un mensaje y CÓMO.
 * Maneja el estado de "Bot Activado/Desactivado" por chat.
 */
export class DecisionAgent {
    // Almacena el estado del bot por JID (ID de chat de WhatsApp)
    // true = Bot Activo, false/undefined = Bot Inactivo
    private activeChats: Map<string, boolean> = new Map();

    constructor() {
        // Opcional: Cargar persistencia si quisieras que recuerde el estado al reiniciar
    }

    /**
     * Activa o desactiva el bot para un chat específico.
     */
    setBotStatus(jid: string, isActive: boolean) {
        this.activeChats.set(jid, isActive);
        console.log(`Bot status para ${jid}: ${isActive ? 'ACTIVO' : 'INACTIVO'}`);
    }

    /**
     * Verifica si el bot debe responder a este mensaje.
     */
    shouldReply(jid: string, messageFromMe: boolean): boolean {
        // 1. Nunca responder a nuestros propios mensajes para evitar bucles
        if (messageFromMe) return false;

        // 2. Verificar si el bot está activado para este chat
        const isActive = this.activeChats.get(jid);
        
        // Política por defecto: ¿El bot empieza apagado o encendido?
        // Aquí asumimos que empieza APAGADO hasta que el usuario lo active manualmente.
        return !!isActive;
    }

    isBotActive(jid: string): boolean {
        return !!this.activeChats.get(jid);
    }
}
