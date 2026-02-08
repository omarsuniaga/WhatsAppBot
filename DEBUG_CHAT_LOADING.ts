/**
 * DEBUG_CHAT_LOADING.ts
 * 
 * Script para diagnosticar el problema de:
 * 1. Carga lenta de contactos (WhatsApp/Baileys)
 * 2. Solo 1 item visible en lista (debería mostrar múltiples)
 * 
 * Ejecución:
 * - Abre la consola del navegador (F12) en el dashboard
 * - Abre la consola del backend (donde corre node)
 * - Ejecuta este script desde la consola del navegador
 */

// ============================================================================
// FASE 1: Diagnóstico en el NAVEGADOR (ejecutar en Console)
// ============================================================================

async function debugFrontend() {
    console.log('\n🔍 === DIAGNOSTICO FRONTEND ===\n');
    
    // 1. Ver cuántos chats está obteniendo la API
    try {
        const response = await fetch('/api/chats');
        const data = await response.json();
        
        console.log('✅ RESPUESTA DE API /chats:');
        console.log(`  - Status: ${response.status}`);
        console.log(`  - Success: ${data.success}`);
        console.log(`  - Total de chats retornados: ${data.data?.length || 0}`);
        
        if (data.data && data.data.length > 0) {
            console.log('\n📋 Primeros 5 chats:');
            data.data.slice(0, 5).forEach((chat, i) => {
                console.log(`  ${i+1}. jid="${chat.jid}" name="${chat.name}" unread=${chat.unreadCount}`);
            });
        }
        
        // 2. Revisar store Zustand
        console.log('\n📦 ESTADO DEL STORE ZUSTAND:');
        if (window.__ZUSTAND_DEVTOOLS__) {
            // Si está el devtools
            console.log('  (Ver en React DevTools tab "Zustand" para detalles completos)');
        }
        
        // 3. Analizar ChatList component si es accesible
        console.log('\n⚛️ COMPONENTE CHATLIST:');
        const chatListItems = document.querySelectorAll('div[data-testid="chat-item"]');
        console.log(`  - Items renderizados en DOM: ${chatListItems.length}`);
        
        // 4. Revisar deduplicación
        console.log('\n🔄 DEDUPLICACION:');
        const chatsMap = new Map(data.data?.map(c => [c.jid, c]) || []);
        console.log(`  - Chats únicos por jid: ${chatsMap.size}`);
        console.log(`  - Chats originales: ${data.data?.length || 0}`);
        if (data.data?.length !== chatsMap.size) {
            console.warn(`  ⚠️ ENCONTRADOS DUPLICADOS: ${(data.data?.length || 0) - chatsMap.size} chats con jid duplicado`);
        }
        
        return data.data || [];
    } catch (error) {
        console.error('❌ Error fetching /chats:', error);
        return [];
    }
}

// ============================================================================
// FASE 2: Diagnóstico del BACKEND (ejecutar en logs del servidor)
// ============================================================================

console.log(`
🔧 INSTRUCCIONES PARA DIAGNOSTICO:

PASO 1: En la consola del navegador, ejecuta:
  debugFrontend()

PASO 2: En los logs del servidor verás algo como:
  [ChatController] === API RESPONSE SAMPLE ===
  [ChatController] Chat 0: jid="..." [stableKey="..." displayName="..." unread=0]
  [ChatController] === END SAMPLE ===

PASO 3: Observa el tamaño de la respuesta:
  - Si API retorna 1 chat → El problema es BACKEND
  - Si API retorna múltiple pero navegador ve 1 → El problema es FRONTEND
  
PASO 4: Abre DevTools → Network → ve la respuesta completa de /chats
  - Copia el JSON response entero
  - Cuéntalo: response.data.length > 0 ? Sí → múltiples : No → es 1

✅ CHECKLIST RÁPIDO:
[ ] ¿Cuántos chats retorna /chats en JSON?
[ ] ¿Cuántos items se ven en el ChatList?
[ ] ¿El deduplication está removiendo chats legítimos?
[ ] ¿Los filtros del QuickFilter están activos sin querer?
[ ] ¿Hay error en console del navegador?

`);

// Export para usado desde browser console
if (typeof window !== 'undefined') {
    (window as any).debugFrontend = debugFrontend;
}

export { debugFrontend };
