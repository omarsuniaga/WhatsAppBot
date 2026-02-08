/**
 * DIAGNOSTIC_ENDPOINT.ts
 * Endpoint temporal para diagnosticar los problemas de carga de chats
 * 
 * Addendum a chatController.ts - Agregar esto a las routes
 */

import { Request, Response } from 'express';
import BotService from '../services/botService';

// TEMPORALMENTE: Agregar esta ruta para diagnosticar
// En src/server/routes/chatRoutes.ts:
// router.get('/diagnostics/chat-load', diagnoseChatLoad);

export const diagnoseChatLoad = async (req: Request, res: Response): Promise<void> => {
    try {
        const botService = BotService.getInstance();
        const store = botService.getStore();

        if (!store) {
            res.json({
                error: 'Store not available'
            });
            return;
        }

        const diagnosis = {
            timestamp: new Date().toISOString(),
            
            // 1. Diagnose store.chats
            chatsStore: {
                exists: !!store.chats,
                type: store.chats ? typeof store.chats : 'undefined',
                isMap: store.chats instanceof Map,
                isArray: Array.isArray(store.chats),
                isObject: store.chats && typeof store.chats === 'object',
                hasAllMethod: store.chats && typeof store.chats.all === 'function',
                hasToJsonMethod: store.chats && typeof store.chats.toJSON === 'function',
                keys: store.chats ? Object.keys(store.chats).slice(0, 10) : [],
                size: store.chats?.size || Object.keys(store.chats || {}).length,
            },
            
            // 2. Try to convert chats store to array (same logic as getChats)
            chatConversion: (() => {
                try {
                    const chatsMap = store.chats;
                    let allChats: any[] = [];
                    let conversionMethod = 'unknown';
                    
                    if (!chatsMap) {
                        conversionMethod = 'null/undefined';
                    } else if (typeof chatsMap.all === 'function') {
                        allChats = chatsMap.all();
                        conversionMethod = '.all() method';
                    } else if (chatsMap instanceof Map) {
                        allChats = Array.from(chatsMap.values());
                        conversionMethod = 'Map.values()';
                    } else if (typeof chatsMap.toJSON === 'function') {
                        allChats = Object.values(chatsMap.toJSON());
                        conversionMethod = '.toJSON()';
                    } else if (typeof chatsMap === 'object') {
                        allChats = Object.values(chatsMap);
                        conversionMethod = 'Object.values()';
                    }
                    
                    return {
                        success: true,
                        conversionMethod,
                        chatsArrayLength: allChats.length,
                        topChats: allChats.slice(0, 3).map((c: any) => ({
                            id: c?.id,
                            name: c?.name,
                            subject: c?.subject,
                            timestamp: c?.conversationTimestamp
                        }))
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: (error as any).message
                    };
                }
            })(),
            
            // 3. Diagnose store.messages
            messagesStore: {
                exists: !!store.messages,
                type: store.messages ? typeof store.messages : 'undefined',
                keysLength: store.messages ? Object.keys(store.messages).length : 0,
                sampleKeys: store.messages ? Object.keys(store.messages).slice(0, 5) : [],
            },
            
            // 4. Diagnose store.contacts
            contactsStore: {
                exists: !!store.contacts,
                type: store.contacts ? typeof store.contacts : 'undefined',
                keysLength: store.contacts ? Object.keys(store.contacts).length : 0,
                sampleKeys: store.contacts ? Object.keys(store.contacts).slice(0, 5) : [],
            },
            
            // 5. Test full getChats flow
            fullFlow: (() => {
                try {
                    const chats: any[] = [];
                    const seenJids = new Set<string>();
                    
                    // Method 1: Get from chats store
                    const chatsMap = store.chats;
                    if (chatsMap) {
                        let allChats: any[] = [];
                        if (typeof chatsMap.all === 'function') allChats = chatsMap.all();
                        else if (chatsMap instanceof Map) allChats = Array.from(chatsMap.values());
                        else if (typeof chatsMap.toJSON === 'function') allChats = Object.values(chatsMap.toJSON());
                        else if (typeof chatsMap === 'object') allChats = Object.values(chatsMap);
                        
                        for (const chat of allChats) {
                            if (!chat || !chat.id || seenJids.has(chat.id)) continue;
                            seenJids.add(chat.id);
                            chats.push({ source: 'chatsStore', id: chat.id, name: chat.name });
                        }
                    }
                    
                    // Method 2: Get from messages store
                    const messagesStore = store.messages;
                    if (messagesStore) {
                        const existingPhones = new Set(chats.map(c => c.id.split('@')[0]));
                        const messageJids = Object.keys(messagesStore);
                        
                        for (const jid of messageJids) {
                            if (jid === 'status@broadcast') continue;
                            const phoneNumber = jid.split('@')[0];
                            if (existingPhones.has(phoneNumber)) continue;
                            existingPhones.add(phoneNumber);
                            chats.push({ source: 'messagesStore', id: jid });
                        }
                    }
                    
                    return {
                        success: true,
                        method1Count: chats.filter((c: any) => c.source === 'chatsStore').length,
                        method2Count: chats.filter((c: any) => c.source === 'messagesStore').length,
                        totalChats: chats.length,
                        sampleChats: chats.slice(0, 5),
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: (error as any).message,
                        stack: (error as any).stack?.substring(0, 500)
                    };
                }
            })(),
        };

        res.json(diagnosis);
    } catch (error: any) {
        res.json({
            error: error.message,
            stack: error.stack?.substring(0, 500)
        });
    }
};

// =============================================================================
// INSTRUCCIONES DE USO
// =============================================================================

/**
 * PASO 1: Agregar la ruta en src/server/routes/chatRoutes.ts
 * 
 * import { diagnoseChatLoad } from '../controllers/chatController';
 * router.get('/diagnostics/chat-load', diagnoseChatLoad);
 * 
 * PASO 2: En el navegador, acceder a:
 * http://localhost:3000/api/chats/diagnostics/chat-load
 * 
 * PASO 3: Revisar respuesta JSON y buscar:
 * - chatsStore.size: ¿Cuántos chats hay?
 * - chatConversion.chatsArrayLength: ¿Se convirtió a array correctamente?
 * - fullFlow.totalChats: ¿Cuántos chats totales se recolectaron?
 * 
 * INTERPRETACIÓN:
 * - Si chatsStore.size = 0 → El store.chats está vacío (problema BAILEYS)
 * - Si chatConversion.chatsArrayLength = 0 pero chatsStore.size > 0 → Conversión fallida
 * - Si fullFlow.totalChats = 0 → Ni chatsStore ni messagesStore tienen datos
 * - Si fullFlow.totalChats = 1 → Solo hay 1 chat en el store
 * - Si fullFlow.totalChats > 1 pero /chats retorna 1 → Hay filtering posterior
 */
