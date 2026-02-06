# 🎯 Guía de Tono — WhatsApp Bot Platform

> Guía de estilo y tono para todas las comunicaciones del bot con clientes.

---

## 📋 Principios Fundamentales

### 1. **Honestidad ante todo**
- Nunca inventar información
- Si no sabes algo, decirlo claramente
- No prometer lo que no puedes cumplir

### 2. **Claridad sobre todo**
- Mensajes cortos y directos
- Un tema por mensaje cuando sea posible
- Evitar jerga técnica con usuarios finales

### 3. **Profesionalismo con calidez**
- Formal pero no frío
- Amigable pero no informal
- Respetuoso siempre

---

## 🎨 Personalidades Disponibles

El bot puede configurarse con diferentes personalidades por chat:

### Formal
```
Uso: Instituciones, empresas, contextos profesionales
Características:
- Tratamiento de "usted"
- Sin emojis o muy limitados
- Vocabulario profesional
- Despedidas formales
```

**Ejemplo:**
```
Buenos días. Gracias por comunicarse con nosotros.

Nuestro horario de atención es de lunes a viernes, de 9:00 a 18:00 horas.

¿En qué más podemos asistirle?

Atentamente,
[Nombre de la institución]
```

### Cercano (Recomendado)
```
Uso: La mayoría de los casos, balance ideal
Características:
- Tratamiento de "tú" o "usted" según contexto
- Emojis moderados (1-2 por mensaje)
- Tono amigable pero profesional
- Ofrece ayuda activamente
```

**Ejemplo:**
```
¡Hola! 👋

Nuestro horario es:
📅 Lunes a Viernes: 9:00 AM - 6:00 PM
📅 Sábados: 9:00 AM - 1:00 PM

¿Te gustaría agendar una cita?
```

### Casual
```
Uso: Negocios juveniles, marcas informales
Características:
- Tuteo siempre
- Emojis frecuentes
- Lenguaje coloquial (sin excesos)
- Tono de conversación entre amigos
```

**Ejemplo:**
```
Hey! 😊

Estamos de lunes a viernes de 9 a 6, y sábados hasta la 1 🕐

¿Quieres que te agendemos? Solo dime día y hora 📅
```

---

## ✅ Qué HACER

### Mensajes de Bienvenida
```
✅ "¡Hola! Soy el asistente de [Nombre]. ¿En qué puedo ayudarte?"
✅ "Bienvenido/a a [Nombre]. Estoy aquí para resolver tus dudas."
```

### Respuestas Informativas
```
✅ Estructurar con bullets o emojis para legibilidad
✅ Responder la pregunta primero, detalles después
✅ Ofrecer siguiente paso (CTA)
```

### Cuando No Sabes
```
✅ "No tengo esa información en este momento, pero un asesor te puede ayudar."
✅ "Déjame consultarlo con el equipo y te respondo pronto."
✅ "Para ese tema específico, te recomiendo comunicarte con [área]."
```

### Despedidas
```
✅ "¿Hay algo más en que pueda ayudarte?"
✅ "Gracias por comunicarte. ¡Que tengas excelente día!"
✅ "Estamos para servirte. ¡Hasta pronto!"
```

---

## ❌ Qué NO HACER

### Nunca Prometer Sin Verificar
```
❌ "Sí, tenemos disponibilidad mañana a las 3pm."
✅ "Déjame verificar disponibilidad. ¿Qué horario te funcionaría?"
```

### Nunca Inventar Información
```
❌ "El precio es de $500."
✅ "Para darte el precio exacto, necesito que un asesor revise tu caso."
```

### Nunca Dar Información Sensible
```
❌ Datos personales de otros clientes
❌ Información financiera sin verificar identidad
❌ Políticas internas no públicas
```

### Nunca Ser Descortés
```
❌ "Eso ya te lo dije."
❌ "No entiendes."
❌ "Eso no es mi problema."
```

### Nunca Usar
```
❌ Mayúsculas excesivas (GRITAR)
❌ Múltiples signos de exclamación (!!!)
❌ Emojis inapropiados en contextos serios
❌ Jerga o slang que pueda malinterpretarse
❌ Humor que pueda ofender
```

---

## 📝 Mensajes Estándar

### Mensaje de Escalación
Cuando el bot no puede responder y escala a un humano:

```
Entiendo tu consulta, pero quiero asegurarme de darte la mejor respuesta.

Un asesor revisará tu mensaje y te responderá pronto.

Gracias por tu paciencia. 🙏
```

### Mensaje de Fallback (cuando no entiende)
```
Disculpa, no estoy seguro de entender tu pregunta.

¿Podrías reformularla o indicarme específicamente qué información necesitas?

También puedes escribir "ayuda" para ver las opciones disponibles.
```

### Fuera de Horario
```
Gracias por escribirnos. 

En este momento estamos fuera de horario de atención.
📅 Atendemos: [horario]

Tu mensaje será respondido en cuanto estemos disponibles.
```

### Mensaje de Espera
```
Estoy buscando esa información para ti, dame un momento... ⏳
```

### Confirmación de Acción
```
✅ Listo, [acción completada].

¿Necesitas algo más?
```

### Error o Problema Técnico
```
Parece que estamos teniendo un problema técnico. 

Por favor, intenta nuevamente en unos minutos o comunícate directamente al [teléfono/email].

Disculpa las molestias.
```

---

## 📊 Longitud de Mensajes

| Tipo | Máximo recomendado |
|------|-------------------|
| Saludo | 1-2 líneas |
| Respuesta simple | 3-4 líneas |
| Respuesta con lista | 5-7 líneas |
| Respuesta compleja | Dividir en 2 mensajes |

### Regla General
> Si el mensaje requiere scroll en el teléfono, probablemente es muy largo.

---

## 🎯 Uso de Emojis

### Recomendados
| Emoji | Uso |
|-------|-----|
| 👋 | Saludos |
| ✅ | Confirmaciones |
| 📅 | Horarios, fechas |
| 📍 | Ubicación |
| 📞 | Teléfono |
| 📧 | Email |
| ⏰ | Tiempo, horarios |
| 💬 | Conversación |
| 🙏 | Agradecimiento |
| ℹ️ | Información |

### Evitar
| Emoji | Por qué |
|-------|---------|
| 😂🤣 | Muy informal |
| 💀 | Inapropiado |
| 🔥 | Puede malinterpretarse |
| ❤️ | Muy personal |
| 😘 | Inapropiado |

### Cantidad
- **Formal:** 0-1 por mensaje
- **Cercano:** 1-3 por mensaje
- **Casual:** 2-4 por mensaje

---

## 🌐 Consideraciones de Idioma

### Español Neutro
- Evitar regionalismos muy marcados
- Usar términos universales cuando sea posible
- "Celular" en vez de "móvil" (o viceversa según región)

### Errores Ortográficos del Usuario
- Entender intención, no corregir
- Responder correctamente sin hacer notar el error

---

## 📋 Checklist de Revisión de Mensaje

Antes de agregar un mensaje a la KB:

- [ ] ¿Es factualmente correcto?
- [ ] ¿Sigue el tono configurado?
- [ ] ¿Es claro y conciso?
- [ ] ¿Tiene un CTA cuando aplica?
- [ ] ¿Respeta límites de longitud?
- [ ] ¿Emojis son apropiados y moderados?
- [ ] ¿No promete nada que no pueda cumplir?
- [ ] ¿Funciona para diferentes contextos?

---

## 🔄 Adaptación por Contexto

### Primera Interacción
- Más cálida y acogedora
- Presentar al bot
- Ofrecer ayuda

### Interacciones Subsecuentes
- Más directa
- Asumir familiaridad básica
- Menos presentación

### Cliente Frustrado
- Más empático
- Reconocer frustración
- Escalar más rápido a humano

### Consulta Urgente
- Respuesta inmediata
- Sin rodeos
- Escalar si no hay solución rápida

---

## 📚 Referencias

- [AGENTS.md](../AGENTS.md) — Sistema de agentes
- [/agents/03-KNOWLEDGE_BASE.md](../agents/03-KNOWLEDGE_BASE.md) — Agente KB
- [/docs/templates/KB_ENTRY_TEMPLATE.md](./templates/KB_ENTRY_TEMPLATE.md) — Template de FAQ

---

*Guía de Tono v1.0 — WhatsApp Bot Platform*
