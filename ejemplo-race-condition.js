// ❌ FORMA INCORRECTA (race condition)
function processMessage(jid, message) {
    if (isProcessing(jid)) return; // ⚠️ VENTANA DE RACE
    setProcessing(jid, true);
    
    try {
        // Procesar mensaje...
        const response = await bot.process(message);
        await sendResponse(jid, response);
    } finally {
        setProcessing(jid, false);
    }
}

// ✅ FORMA CORRECTA (con MessageProcessor)
class MessageProcessor {
    private processingChats = new Map<string, Promise<any>>();
    
    async processMessage(jid, message) {
        // 1️⃣ PRIMERO VERIFICAR SI YA HAY PROMESA EN CURSO
        if (this.processingChats.has(jid)) {
            // 2️⃣ SI YA HAY PROCESO, COLAR ESPERANDO
            return this.queueMessage(jid, message);
        }
        
        // 3️⃣ CREAR NUEVA PROMESA DE PROCESAMIENTO
        const processingPromise = this.processInternal(jid, message);
        
        // 4️⃣ REGISTRAR LA PROMESA ANTES DE EMPEZAR
        this.processingChats.set(jid, processingPromise);
        
        try {
            // 5️⃣ PROCESAR Y ESPERAR RESULTADO
            const result = await processingPromise;
            return result;
        } finally {
            // 6️⃣ LIMPIAR SIEMPRE AL FINALIZAR
            this.processingChats.delete(jid);
            
            // 7️⃣ PROCESAR SIGUIENTE EN COLA SI EXISTE
            this.processNextQueued(jid);
        }
    }
    
    private async processInternal(jid, message) {
        // Lógica real de procesamiento aquí
        const response = await bot.process(message);
        await sendResponse(jid, response);
        return response;
    }
    
    private async queueMessage(jid, message) {
        // Cola serial por chat
        return new Promise((resolve, reject) => {
            const queue = this.getQueue(jid);
            queue.push({ message, resolve, reject });
            
            // Timeout por seguridad
            setTimeout(() => reject(new Error('Timeout')), 30000);
        });
    }
}