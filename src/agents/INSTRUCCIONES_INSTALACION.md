# Instrucciones de Migración de Agentes IA

Sigue estos pasos una vez tengas acceso a la carpeta raíz del servidor (`server`, `backend` o la raíz del proyecto Node.js).

## 1. Mover Archivos
Mueve la carpeta `backend_agents_temp` dentro de la carpeta `src` de tu backend y renómbrala a `agents`.

Ejemplo de estructura final deseada en el backend:
```
/mi-backend
  /src
    /api
    /services
    /agents          <-- Aquí van los archivos generados
      GeminiAgent.ts
      ContextAgent.ts
      DecisionAgent.ts
      types.ts
```

## 2. Instalar Dependencias
En la terminal de tu backend, ejecuta:

```bash
npm install @google/generative-ai dotenv
```

## 3. Crear Archivo de Conocimiento
Crea un archivo llamado `knowledge_base.txt` en la raíz de tu backend (o donde prefieras) con la información de tu negocio.
Ejemplo:
```text
Somos la empresa TechSolutions.
Horario: Lunes a Viernes 9am - 6pm.
Teléfono: 555-0123.
Vendemos laptops y servicios de reparación.
```

## 4. Integrar en tu Servicio de WhatsApp (Baileys)
Donde manejas el evento `messages.upsert` (probablemente en `src/services/BaileysService.ts` o `socket.ts`), añade la lógica:

```typescript
// Importar agentes
import { GeminiAgent } from '../agents/GeminiAgent';
import { ContextAgent } from '../agents/ContextAgent';
import { DecisionAgent } from '../agents/DecisionAgent';

// Inicializar (idealmente fuera del handler de mensajes, al inicio de la app)
const contextAgent = new ContextAgent('./knowledge_base.txt');
await contextAgent.init();

const geminiAgent = new GeminiAgent({
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    contextFilePath: './knowledge_base.txt'
});

const decisionAgent = new DecisionAgent();

// --- DENTRO DEL EVENTO DE MENSAJE NUEVO ---

// 1. Verificar si debemos responder
if (decisionAgent.shouldReply(chatJid, message.key.fromMe)) {
    
    // 2. Obtener contexto
    const context = await contextAgent.searchContext(messageText);
    
    // 3. Generar respuesta
    const response = await geminiAgent.generateResponse(messageText, context);
    
    // 4. Enviar respuesta (usando tu función de envío existente)
    await sendMessage(chatJid, { text: response.text });
}
```
