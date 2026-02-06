# 🗺️ ROADMAP — Plataforma Institucional de Comunicación por WhatsApp

Este documento define la evolución planificada del sistema, desde su **estado operativo actual** hasta convertirse en una **plataforma institucional completa**, manteniendo siempre el principio de **control humano, trazabilidad y responsabilidad**.

El roadmap está organizado por **fases incrementales**, donde cada fase es funcional por sí misma y no rompe lo ya construido.

---

## 🔵 FASE 0 — Estado Actual (Completada)

> **Objetivo:** Tener un sistema funcional y estable para gestionar WhatsApp con apoyo inteligente.

### ✔️ Alcance actual
- Conexión WhatsApp estable (Baileys)
- Dashboard web operativo
- Envío y recepción de mensajes
- Bot asistido con:
  - FAQs
  - umbral de confianza
  - escalación humana
- Sistema de alertas (tickets)
- Aprendizaje supervisado parcial
- Configuración del bot por chat
- WebSockets en tiempo real

📌 **Estado:** COMPLETADA  
📌 **Base para todas las fases siguientes**

---

## 🟢 FASE 1 — Consolidación Institucional Básica

> **Objetivo:** Alinear el sistema con un entorno educativo real sin introducir automatizaciones complejas.

### 🎯 Entregables
- Modelo de datos educativo mínimo:
  - Alumno
  - Representante
  - Agrupación (Orquesta, Coro, Iniciación)
  - Relación Alumno ↔ Representante
  - Relación Alumno ↔ Agrupación
- Asociación opcional de chats WhatsApp a entidades educativas
- Restricciones básicas:
  - datos sensibles solo por chat privado
  - categorías de FAQ permitidas en grupos
- Documentación de reglas institucionales

### 🧩 Agentes involucrados
- Data Modeling Agent
- Rules / Policy Agent

📌 **Resultado esperado:**  
El sistema “entiende” el contexto educativo, aunque aún no automatiza.

---

## 🟡 FASE 2 — Plantillas y Comunicados Institucionales

> **Objetivo:** Convertir el sistema en una herramienta oficial de comunicación grupal.

### 🎯 Entregables
- Editor de plantillas institucionales:
  - formato enriquecido (markdown / rich text)
  - variables dinámicas
- Envío de comunicados a:
  - grupos de WhatsApp
  - subconjuntos de grupos
- Historial de comunicados enviados
- Activación de **modo escucha contextual** tras cada comunicado
- Métricas básicas por comunicado:
  - entregados
  - respuestas generadas
  - escalaciones

### 🧩 Agentes involucrados
- UX Agent
- Messaging Agent
- Context Agent

📌 **Resultado esperado:**  
El sistema se convierte en un canal oficial de avisos y horarios.

---

## 🟠 FASE 3 — Seguridad, Accesos y Auditoría

> **Objetivo:** Preparar el sistema para uso institucional formal y crecimiento.

### 🎯 Entregables
- Autenticación de usuarios del dashboard
- Sistema de roles:
  - administrador
  - operador
  - solo lectura
- Auditoría completa:
  - quién envía mensajes
  - quién responde alertas
  - quién aprueba aprendizaje
- Persistencia en base de datos real:
  - SQLite (mínimo)
  - Postgres / Firestore (opcional)
- Backups automáticos de conocimiento

### 🧩 Agentes involucrados
- Security Agent
- Backend Infrastructure Agent

📌 **Resultado esperado:**  
Sistema listo para uso continuo sin riesgo operativo.

---

## 🔴 FASE 4 — Automatizaciones Educativas Controladas

> **Objetivo:** Introducir automatización responsable basada en datos reales.

### 🎯 Entregables
- Registro básico de asistencias
- Detección de patrones:
  - ausencias repetidas
  - inactividad prolongada
- Generación de sugerencias automáticas
- Panel de aprobación manual:
  - ver alumnos afectados
  - revisar mensaje sugerido
  - activar / cancelar envío
- Envíos **solo individuales**, nunca en grupos

### 🧩 Agentes involucrados
- Automation Logic Agent
- Data Analysis Agent
- UX Validation Agent

📌 **Resultado esperado:**  
Automatización sin perder control humano ni sensibilidad institucional.

---

## 🟣 FASE 5 — Optimización y Escalabilidad

> **Objetivo:** Convertir la plataforma en un sistema reutilizable y escalable.

### 🎯 Entregables
- Multi-institución (multi-tenant)
- Métricas avanzadas y KPIs
- Optimización de rendimiento
- Configuración por institución
- Exportación / importación de conocimiento
- Documentación para despliegue y mantenimiento

### 🧩 Agentes involucrados
- Architecture Agent
- Performance Agent
- Documentation Agent

📌 **Resultado esperado:**  
Plataforma lista para ser replicada en otras academias o fundaciones.

---

## 🧠 Principios Rectores del Roadmap

Estas reglas **no cambian** entre fases:

1. El bot nunca es autoridad final.
2. La automatización siempre es supervisada.
3. La IA asiste, no decide.
4. La estabilidad tiene prioridad sobre nuevas features.
5. Cada fase debe ser usable por sí sola.

---

## 📌 Nota Final

Este roadmap no es rígido.  
Es una **guía de evolución consciente**, diseñada para crecer sin comprometer:

- la ética institucional
- la claridad comunicacional
- la confianza de representantes y alumnos

---

> *Primero control. Luego eficiencia. Finalmente automatización.*
