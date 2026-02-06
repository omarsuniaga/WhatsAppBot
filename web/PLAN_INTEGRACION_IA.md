# Plan de Integración de Agentes IA y Bot WhatsApp

Este documento detalla la arquitectura y los pasos para transformar el proyecto actual en un sistema inteligente capaz de responder preguntas automáticamente utilizando Gemini y una base de conocimientos (archivos Q&A).

## 1. Arquitectura de "Agentes" (Backend)

Para cumplir con el requerimiento de "agentes en las rutas", propondremos una estructura modular en el backend (Node.js/Baileys). Cada "Agente" tendrá una responsabilidad única.

### Estructura de Carpetas Propuesta (Backend)
```
src/
├── agents/
│   ├── ContextAgent.ts      # Gestiona la base de conocimiento (Q&A)
│   ├── DecisionAgent.ts     # Decide si el bot debe responder (Toggle/Reglas)
│   └── GeminiAgent.ts       # Interactúa con la API de Google Gemini
├── routes/
│   ├── aiRoutes.ts          # Endpoints para configurar el bot (subir archivos, toggle)
│   └── chatRoutes.ts        # Endpoints existentes
├── services/
│   └── BaileysService.ts    # Conexión principal con WhatsApp
```

## 2. Definición de Agentes

### A. ContextAgent (El Cerebro de Datos)
*   **Responsabilidad:** Cargar, leer y procesar el archivo de "Preguntas y Respuestas".
*   **Entrada:** Archivos `.txt`, `.json`, o `.pdf`.
*   **Funcionalidad:**
    *   Al iniciarse, lee el archivo base.
    *   Crea un índice simple o "Chunks" de texto relevantes.
    *   Expone un método `searchContext(query)` que devuelve la información más relevante para la pregunta del usuario.

### B. GeminiAgent (El Generador)
*   **Responsabilidad:** Construir el prompt y hablar con Google.
*   **Configuración:** Requiere `GEMINI_API_KEY`.
*   **Prompt System:**
    > "Eres un asistente amable para [Nombre Negocio]. Usa el siguiente CONTEXTO para responder la pregunta del usuario. Si la respuesta no está en el contexto, di amablemente que no tienes esa información."
*   **Método:** `generateResponse(userMessage, context)`

### C. DecisionAgent (El Portero)
*   **Responsabilidad:** Determinar **cuándo** responder.
*   **Lógica:**
    1.  ¿El "Modo Bot" está activado para este chat específico?
    2.  ¿El mensaje es de un humano (no es un estado, ni del propio bot)?
    3.  (Opcional) ¿Pasó cierto tiempo desde el último mensaje?

## 3. Flujo de Datos (Pipeline)

1.  **BaileysService** recibe un mensaje: `message:new`.
2.  Se invoca a **DecisionAgent**.
    *   *Si devuelve FALSE:* Se guarda el mensaje y no se hace nada más.
    *   *Si devuelve TRUE:* Continúa.
3.  **ContextAgent** recibe el texto del mensaje.
    *   Busca en el archivo Q&A.
    *   Retorna: `contexto_encontrado`.
4.  **GeminiAgent** recibe `mensaje_usuario` + `contexto_encontrado`.
    *   Llama a API Gemini.
    *   Genera respuesta natural.
5.  **BaileysService** envía la respuesta.

## 4. Implementación en Frontend (Web)

Para controlar este sistema, necesitamos agregar interfaces en la carpeta `web`:

1.  **Panel de Configuración de IA:**
    *   Subida de archivo (Drag & Drop) para el "Knowledge Base".
    *   Campo para ingresar/actualizar la API KEY (oculto).
    *   Prompt del sistema personalizado (opcional).

2.  **Toggle por Chat:**
    *   En `ChatView.tsx` (Header), agregar un interruptor "🤖 Bot Activo".
    *   Visualizar si el bot está respondiendo o escribiendo.

## 5. Pasos de Implementación

### Fase 1: Backend (Core)
1.  Instalar SDK: `npm install @google/generative-ai`.
2.  Crear `GeminiAgent.ts` con la conexión básica.
3.  Crear `ContextAgent.ts` con lectura de archivos simple (fs).

### Fase 2: Conexión
1.  Interceptar el evento `upsert` de Baileys.
2.  Conectar los agentes en cadena.

### Fase 3: Frontend (Control)
1.  Crear endpoints en el backend: `POST /api/ai/config`, `POST /api/chats/:jid/bot-toggle`.
2.  Crear componentes en React para consumir estos endpoints.

---

### Ejemplo de Prompt para Gemini

```text
Rol: Asistente de Ventas
Contexto Recuperado:
- Horario de atención: 9am a 6pm.
- Precios: Plan Básico $10, Plan Pro $20.
- Ubicación: Calle Falsa 123.

Pregunta del Usuario: "¿Cuánto cuesta el plan pro y dónde están?"

Instrucción: Responde basándote SOLO en el contexto. Sé breve y cordial.
```
