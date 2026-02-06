# 🤖 Plataforma Institucional de Comunicación por WhatsApp

Sistema de gestión y automatización de comunicaciones por WhatsApp orientado a **instituciones educativas y culturales**, con panel de control web, bot asistido por IA y escalación humana.

Este proyecto se desarrolla tomando como caso real una academia de música (ej. *El Sistema Punta Cana*), donde WhatsApp es el principal canal de comunicación con representantes, alumnos y grupos institucionales.

---

## 🎯 Propósito del Proyecto

Centralizar y ordenar la comunicación institucional vía WhatsApp, reduciendo la carga operativa del personal y mejorando la **claridad, coherencia, trazabilidad y control** de las respuestas.

El sistema **no reemplaza al personal humano**:  
funciona como asistente inteligente que responde solo lo que está validado y **escala correctamente** todo lo que requiere criterio humano.

---

## 🟦 Fase Actual del Sistema (Estado Real)

Actualmente, el sistema se encuentra en una **fase operativa funcional**, con las siguientes capacidades implementadas:

### ✅ Comunicación WhatsApp
- Conexión estable mediante **Baileys (WhatsApp Web Multi-Device)**
- Recepción y envío de mensajes en:
  - chats privados
  - grupos de WhatsApp
- Manejo de estados de mensaje (enviado, entregado, leído)
- Identificación de remitente en grupos

---

### ✅ Dashboard Web Administrativo
- Interfaz web tipo WhatsApp Web
- Lista de chats y grupos
- Vista de conversaciones en tiempo real
- Envío manual de mensajes desde el dashboard
- Comunicación en tiempo real mediante **WebSockets (Socket.IO)**

---

### ✅ Bot Inteligente Básico (Asistido)
- Activación / desactivación del bot por chat
- Configuración por chat:
  - personalidad básica
  - umbral de confianza
  - aprendizaje habilitado
- Orquestador central de decisiones (`BotOrchestrator`)
- Decisión automática de **cuándo responder y cuándo no**

---

### ✅ Base de Conocimiento (FAQ)
- FAQs organizadas por categorías (JSON)
- Búsqueda por palabras clave y variaciones
- Umbral de confianza configurable
- Respuestas automáticas solo cuando hay coincidencia suficiente

---

### ✅ Escalación Humana (Sistema de Alertas)
- Cuando el bot no puede responder:
  - se crea una alerta (ticket)
  - se notifica al dashboard
- El personal puede:
  - ver contexto completo de la conversación
  - responder manualmente
  - enviar la respuesta al WhatsApp
- Sistema de prioridad y control de alertas

---

### ✅ Aprendizaje Supervisado (Parcial)
- Las respuestas humanas pueden:
  - guardarse como conocimiento
  - generar variaciones de preguntas
- El aprendizaje **requiere aprobación**
- El bot solo aprende de respuestas humanas validadas

---

### ⚠️ Limitaciones Actuales
En la fase actual **aún no están implementados**:

- Entidades educativas formales (alumno, representante, agrupación)
- Gestión de asistencias
- Automatizaciones por ausencias o patrones
- Envíos programados
- Plantillas institucionales avanzadas
- Autenticación de usuarios del dashboard
- Persistencia en base de datos robusta (se usa JSON / LocalStorage)

Estas funcionalidades forman parte de la **visión futura del sistema**.

---

## 🚀 Visión Futura del Sistema

El objetivo del proyecto es evolucionar hacia una **plataforma institucional completa**, manteniendo siempre el control humano como principio central.

### 🎓 Modo Institucional (Educational Mode)
- Diferenciación estricta entre:
  - chats privados
  - grupos institucionales (Orquesta, Coro, Iniciación, etc.)
- Protección de datos de alumnos y menores
- Restricción de respuestas sensibles en grupos
- Tono comunicacional configurable (formal, institucional, cercano)

---

### 📢 Comunicados y Plantillas Institucionales
- Editor de plantillas con formato (negritas, listas, estructura clara)
- Envío de comunicados oficiales a grupos específicos
- Historial de envíos
- Modo “escucha contextual” tras cada comunicado

---

### 🔁 Automatizaciones Controladas
- Detección de patrones (ej. ausencias repetidas)
- Generación de sugerencias automáticas
- **Activación manual por el personal**
- Envíos individuales y responsables (no spam)

---

### 📊 Gestión Educativa Básica
- Entidades formales:
  - Alumno
  - Representante
  - Agrupación
- Relación alumno ↔ grupo
- Base para futuras funciones de asistencia y seguimiento

---

### 🔐 Seguridad y Control
- Autenticación de usuarios del dashboard
- Roles (admin, operador, solo lectura)
- Auditoría completa de acciones
- Persistencia en base de datos (SQLite / Postgres / Firestore)

---

### 🧠 IA como Asistente, no Autoridad
- La IA actúa como apoyo para redacción y análisis
- Nunca toma decisiones finales
- Nunca responde sin respaldo de conocimiento o validación humana
- Política estricta anti-alucinación

---

## 🧱 Arquitectura General

Frontend (React 18 + Tailwind)
│
├── Dashboard Administrativo
│ ├── Chats y Grupos
│ ├── Alertas / Tickets
│ ├── Base de Conocimiento
│ └── Configuración por Chat
│
└── WebSocket (tiempo real)
│
Backend (Node.js + Express)
│
├── BotOrchestrator
│ ├── QASearchAgent
│ ├── GeminiAgent (opcional)
│ └── DecisionAgent
│
├── Servicios
│ ├── PendingAlertService
│ ├── BotAssignmentService
│ └── LearningService
│
└── Baileys (WhatsApp)


---

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js, TypeScript, Express
- **Frontend**: React 18, Vite, TailwindCSS
- **Estado global**: Zustand
- **WebSocket**: Socket.IO
- **WhatsApp**: @whiskeysockets/baileys
- **IA (opcional)**: Google Gemini API

---

## 🚧 Estado del Proyecto

- ✔ Sistema funcional en entorno real
- ✔ Dashboard operativo
- ✔ Bot asistido con escalación humana
- 🚧 Evolución activa hacia plataforma institucional completa

Este proyecto está diseñado para **crecer por capas**, sin comprometer la estabilidad ni la responsabilidad institucional.

---

## 📄 Licencia

MIT License

---

> *Este sistema no busca responder más rápido, sino responder mejor.*