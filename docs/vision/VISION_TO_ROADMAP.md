# Vision → Roadmap Bridge
## Sistema de Bot WhatsApp – El Sistema Punta Cana

> ⚠️ Importante  
> Este documento NO es un plan de ejecución inmediata.  
> Su propósito es servir como puente entre la **visión estratégica de largo plazo**
> y el **ROADMAP técnico real** del proyecto.
>
> Aquí se identifican conceptos, entidades y capacidades futuras,
> indicando en qué fase del roadmap podrían materializarse
> y cuál es su estado actual dentro del repositorio.

---

## 🎯 Objetivo del documento

- Alinear visión estratégica con desarrollo técnico realista
- Evitar promesas o implementaciones prematuras
- Permitir que agentes de IA y desarrolladores humanos:
  - entiendan hacia dónde va el sistema
  - sepan qué NO debe implementarse todavía
  - preparen el código para crecer sin refactors masivos

---

## 🧱 Estados posibles

| Estado | Significado |
|------|------------|
| NO EXISTE | No hay estructura ni código |
| SEMILLA | Existe estructura conceptual (interfaces, hooks, carpetas) |
| IMPLEMENTADO | Funcionalidad activa en el sistema |

---

## 🗺️ Mapeo Visión → Roadmap

### 👤 Entidades del dominio educativo

| Concepto | Descripción | Fase | Estado actual |
|--------|-------------|------|---------------|
| Alumno | Estudiante inscrito en la academia | B | SEMILLA |
| Representante | Contacto responsable del alumno | B | SEMILLA |
| Agrupación | Orquesta, Coro, Iniciación, etc. | B | SEMILLA |
| Evento / Clase | Ensayo, clase, concierto | C | NO EXISTE |
| Asistencia | Registro de presencia/ausencia | C | NO EXISTE |

---

### 💬 Comunicación y atención institucional

| Capacidad | Descripción | Fase | Estado |
|---------|-------------|------|--------|
| Respuestas automáticas | KB + IA contextual | A | IMPLEMENTADO |
| Escalación a humano | Alertas manuales | A | IMPLEMENTADO |
| Tono institucional configurable | Formal / cercano | B | NO EXISTE |
| Plantillas de comunicados | Mensajes reutilizables | B | SEMILLA |
| Comunicación proactiva | Avisos automáticos | D | NO EXISTE |

---

### 🧠 Inteligencia Artificial

| Capacidad | Descripción | Fase | Estado |
|---------|-------------|------|--------|
| IA contextual | Gemini sobre KB | A | IMPLEMENTADO |
| Clasificación de intención | Horarios, asistencia, etc. | B | SEMILLA |
| IA con datos históricos | Respuestas personalizadas | C | NO EXISTE |
| Predicción de patrones | Riesgo de abandono, ausencias | D | NO EXISTE |

> Nota: Ninguna funcionalidad predictiva debe implementarse
> sin datos históricos suficientes.

---

### 📊 Métricas y observabilidad

| Métrica | Descripción | Fase | Estado |
|-------|-------------|------|--------|
| Mensajes recibidos | Volumen de interacción | A | SEMILLA |
| Resolución automática | KB / IA | A | SEMILLA |
| Escalaciones | Intervención humana | A | SEMILLA |
| Métricas operativas | Tiempos de respuesta | C | NO EXISTE |
| Dashboards | Visualización | D | NO EXISTE |

---

### 🤖 Automatización (futuro)

| Automatización | Descripción | Fase | Estado |
|--------------|-------------|------|--------|
| Aviso por ausencias | Notificar representantes | D | NO EXISTE |
| Recordatorios de clase | Mensajes programados | D | NO EXISTE |
| Workflows condicionales | Reglas automáticas | E | NO EXISTE |

> ⚠️ Todas las automatizaciones requieren:
> - datos reales
> - validación humana inicial
> - posibilidad de desactivación manual

---

## 🚧 Principios de implementación

1. **Primero estructura, luego comportamiento**
2. **Nada predictivo sin datos**
3. **Toda automatización debe poder apagarse**
4. **La IA asiste, no decide**
5. **El humano siempre puede intervenir**

---

## 📌 Cómo debe usarse este documento

- Como guía para agentes arquitectos y desarrolladores
- Para validar si una feature está “a tiempo” o “fuera de fase”
- Para evitar sobreingeniería temprana
- Para mantener coherencia entre visión y código

---

## ❌ Qué NO es este documento

- No es un backlog
- No es un sprint plan
- No es una promesa comercial
- No refleja el estado actual completo del sistema

---

## ✅ Qué SÍ es

- Un mapa de destino
- Un guardarraíl técnico
- Un documento de alineación estratégica

---

*Documento vivo. Debe revisarse al cerrar cada fase del ROADMAP.*
