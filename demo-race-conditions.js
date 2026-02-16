/**
 * Demo de Race Condition sin MessageProcessor
 */

// SIMULACIÓN DEL PROBLEMA ACTUAL
class BotProblematico {
    constructor() {
        this.processingMessages = new Set();
    }
    
    // ❌ MÉTODO ACTUAL CON RACE CONDITION
    async processMessage(chatJid, message) {
        console.log(`📥 Procesando "${message}" para ${chatJid}`);
        
        // VENTANA DE RACE CONDITION (milisegundos)
        const raceWindow = Math.random() * 100; 
        await new Promise(resolve => setTimeout(resolve, raceWindow));
        
        // CHECKEO PROBLEMÁTICO
        if (this.processingMessages.has(chatJid)) {
            console.log(`⏭️ Mensaje "${message}" IGNORADO - ya procesando`);
            return;
        }
        
        // MARCAR COMO PROCESANDO
        this.processingMessages.add(chatJid);
        console.log(`✅ "${message}" MARCADO como procesando`);
        
        // SIMULAR PROCESAMIENTO
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // RESPONDER
        console.log(`📤 Respondiendo a "${message}"`);
        
        // LIMPIAR
        this.processingMessages.delete(chatJid);
        console.log(`🧹 "${message}" LIMPIADO`);
    }
}

// DEMO DEL PROBLEMA
async function demoRaceCondition() {
    console.log('🚨 DEMO: Race Condition SIN Message Processor\n');
    
    const bot = new BotProblematico();
    
    // ENVIAR 2 MENSAJES SIMULTÁNEOS
    const promises = [
        bot.processMessage('chat1@s.whatsapp.net', 'Mensaje 1'),
        bot.processMessage('chat1@s.whatsapp.net', 'Mensaje 2')
    ];
    
    await Promise.all(promises);
    
    console.log('\n💥 RESULTADO: Posibles duplicados, loops, o inconsistencias\n');
}

/**
 * Demo con MessageProcessor (solución)
 */

// ✅ SOLUCIÓN CON MESSAGE PROCESSOR
class MessageProcessor {
    constructor() {
        this.processingChats = new Map();
        this.queues = new Map();
    }
    
    async processMessage(chatJid, message) {
        // REVISAR SI YA HAY PROCESO EN CURSO
        if (this.processingChats.has(chatJid)) {
            console.log(`⏳ "${message}" ENCOLADO - esperando turno`);
            return this.enqueueMessage(chatJid, message);
        }
        
        // CREAR PROMESA DE PROCESAMIENTO
        const processingPromise = this.processInternal(chatJid, message);
        
        // REGISTRAR ANTES DE EMPEZAR
        this.processingChats.set(chatJid, processingPromise);
        
        try {
            return await processingPromise;
        } finally {
            // LIMPIAR SIEMPRE
            this.processingChats.delete(chatJid);
            this.processNextQueued(chatJid);
        }
    }
    
    async processInternal(chatJid, message) {
        console.log(`🔄 Procesando "${message}" para ${chatJid}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`✅ "${message}" PROCESADO completamente`);
        return { success: true, message: `Respuesta a "${message}"` };
    }
    
    enqueueMessage(chatJid, message) {
        return new Promise((resolve) => {
            const queue = this.queues.get(chatJid) || [];
            queue.push({ message, resolve });
            this.queues.set(chatJid, queue);
        });
    }
    
    processNextQueued(chatJid) {
        const queue = this.queues.get(chatJid);
        if (!queue || queue.length === 0) return;
        
        const next = queue.shift();
        if (!next) return;
        
        console.log(`➡️ Procesando siguiente mensaje encolado`);
        this.processMessage(chatJid, next.message).then(next.resolve);
    }
}

// DEMO DE LA SOLUCIÓN
async function demoMessageProcessor() {
    console.log('✅ DEMO: Solución CON Message Processor\n');
    
    const processor = new MessageProcessor();
    
    // ENVIAR 2 MENSAJES SIMULTÁNEOS
    const promises = [
        processor.processMessage('chat1@s.whatsapp.net', 'Mensaje 1'),
        processor.processMessage('chat1@s.whatsapp.net', 'Mensaje 2')
    ];
    
    await Promise.all(promises);
    
    console.log('\n🎯 RESULTADO: Procesamiento ordenado, sin race conditions\n');
}

// EJECUTAR DEMOS
async function main() {
    await demoRaceCondition();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demoMessageProcessor();
}

main();