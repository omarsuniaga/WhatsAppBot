/**
 * JID Utils - Utilidades mejoradas para manejar WhatsApp JIDs
 * Resuelve problemas de normalización y validación
 */

export function normalizeRawJid(jid: string): string {
    if (!jid || typeof jid !== 'string') return jid;
    
    // Limpiar espacios
    const clean = jid.trim();
    
    // Manejar diferentes dominios de WhatsApp
    if (clean.includes('@')) {
        const [phone, domain] = clean.split('@');
        
        // Normalizar dominios conocidos
        switch (domain) {
            case 'c.us':
            case 's.whatsapp.net':
                return `${phone}@s.whatsapp.net`;
            case 'g.us':
                return clean; // Los grupos mantienen @g.us
            case 'lid':
                return clean; // LinkedIn integration mantiene @lid
            case 'broadcast':
                return clean; // Status broadcast
            default:
                return clean; // Mantener desconocidos
        }
    }
    
    return clean;
}

export function toStableKey(jid: string): string {
    // Generar clave consistente para almacenamiento
    const normalized = normalizeRawJid(jid);
    
    if (normalized.includes('@')) {
        const [phone, domain] = normalized.split('@');
        
        // Para chats individuales, usar teléfono como clave
        if (domain === 's.whatsapp.net') {
            return phone;
        }
        
        // Para grupos y otros, mantener completo
        return normalized;
    }
    
    return normalized;
}

export function isValidJid(jid: string): boolean {
    if (!jid || typeof jid !== 'string') return false;
    
    const clean = jid.trim();
    
    // Patrones válidos de WhatsApp
    const validPatterns = [
        /^\d+@s\.whatsapp\.net$/, // Chats individuales
        /^\d+@g\.us$/, // Grupos
        /^\d+@lid$/, // LinkedIn integration
        /status@broadcast$/, // Status broadcast
        /^\d+@c\.us$/ // Formato antiguo (兼容性)
    ];
    
    return validPatterns.some(pattern => pattern.test(clean));
}

export function isGroupJid(jid: string): boolean {
    if (!jid) return false;
    return jid.endsWith('@g.us');
}

export function extractPhoneNumber(jid: string): string | null {
    if (!jid) return null;
    
    const match = jid.match(/^(\d+)@/);
    return match ? match[1] : null;
}

export function debugJid(context: string, jid: string): void {
    if (process.env.DEBUG === 'true') {
        const phone = extractPhoneNumber(jid);
        const type = isGroupJid(jid) ? 'GROUP' : 'CHAT';
        console.log(`[JID-${context}] ${type}: ${jid} (phone: ${phone})`);
    }
}