# 📚 Knowledge Base Entry Template

> Template para crear entradas de FAQ en la Knowledge Base.

---

## Información de la Entrada

| Campo | Valor |
|-------|-------|
| **ID** | [auto-generado o UUID] |
| **Categoría** | [nombre de categoría] |
| **Prioridad** | [1-5, donde 5 es máxima] |
| **Estado** | [ ] Borrador | [ ] Revisión | [ ] Activo |
| **Fecha creación** | [YYYY-MM-DD] |
| **Última actualización** | [YYYY-MM-DD] |

---

## 📝 Contenido

### Pregunta Principal
> [La pregunta más común/directa sobre este tema]

### Variaciones de Pregunta
Lista de formas alternativas en que los usuarios pueden hacer esta pregunta:

1. [Variación 1]
2. [Variación 2]
3. [Variación 3]
4. [Variación 4]
5. [Variación 5]

> **Nota:** Incluir al menos 5 variaciones para mejor matching.  
> Considerar: preguntas directas, informales, con errores ortográficos comunes.

### Keywords (Palabras Clave)
```
keyword1, keyword2, keyword3, keyword4
```

> Palabras que ayudan al sistema a identificar esta intención.

---

## 💬 Respuesta

### Respuesta Principal
```
[Texto de la respuesta tal como se enviará al usuario]

Puede incluir:
- Emojis con moderación 📋
- Saltos de línea para legibilidad
- Variables como {nombre} si aplica

Siempre cerrar con un CTA cuando sea relevante.
```

### Variables Disponibles
| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `{nombre}` | Nombre del cliente | "Juan" |
| `{hora}` | Hora actual | "14:30" |
| `{dia}` | Día actual | "Lunes" |

### Ejemplo de Respuesta Renderizada
```
Hola Juan! 👋

Nuestro horario de atención es:
📅 Lunes a Viernes: 9:00 AM - 6:00 PM
📅 Sábados: 9:00 AM - 1:00 PM

¿Te gustaría agendar una cita?
```

---

## 🏷️ Metadata

### Categoría
| Campo | Valor |
|-------|-------|
| **Nombre** | [ej: horarios, precios, servicios] |
| **Descripción** | [Qué tipo de preguntas cubre] |
| **Icono** | [emoji representativo] |

### Intención Detectada
```
[Descripción breve de la intención del usuario]
Ejemplo: "El usuario quiere conocer los horarios de atención"
```

### Confianza Mínima
| Umbral | Acción |
|--------|--------|
| >= 0.8 | Respuesta automática |
| 0.5 - 0.8 | Respuesta con disclaimer |
| < 0.5 | Escalar a humano |

---

## 🔗 Relaciones

### FAQs Relacionadas
- [ID o título de FAQ relacionada 1]
- [ID o título de FAQ relacionada 2]

### Siguiente Pregunta Probable
> Después de esta respuesta, el usuario probablemente pregunte:
- [Pregunta de seguimiento 1]
- [Pregunta de seguimiento 2]

---

## ✅ Validación

### Checklist de Calidad
- [ ] Respuesta es factualmente correcta
- [ ] No hay promesas no verificadas
- [ ] Tono es consistente con guía de estilo
- [ ] Al menos 5 variaciones de pregunta
- [ ] Keywords son relevantes
- [ ] CTA incluido si aplica
- [ ] Revisado por responsable de contenido

### Fuente de Información
| Campo | Valor |
|-------|-------|
| **Origen** | [Documento, persona, sistema] |
| **Verificado por** | [Nombre] |
| **Fecha verificación** | [YYYY-MM-DD] |
| **Vigencia** | [Hasta cuándo es válida esta info] |

---

## ⚠️ Notas y Advertencias

### Información Sensible
- [ ] Contiene información de precios (requiere actualización periódica)
- [ ] Contiene horarios (verificar cambios estacionales)
- [ ] Contiene políticas (verificar cambios legales)

### Casos Especiales
```
Si el usuario menciona [caso especial], derivar a [persona/área].
```

### Qué NO responder
- [Tema que no debe abordarse con esta FAQ]
- [Información que requiere verificación humana]

---

## 📊 Métricas de Uso

| Métrica | Valor | Fecha |
|---------|-------|-------|
| Veces usada | [#] | [fecha] |
| Satisfacción | [%] | [fecha] |
| Escalaciones | [#] | [fecha] |

---

## 📋 Formato JSON

Para importar/exportar, usar este formato:

```json
{
  "id": "uuid-here",
  "category": "categoria",
  "questions": [
    "Pregunta principal",
    "Variación 1",
    "Variación 2",
    "Variación 3",
    "Variación 4",
    "Variación 5"
  ],
  "answer": "Texto de respuesta con {variables} si aplica",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "priority": 3,
  "enabled": true,
  "metadata": {
    "intent": "descripción de intención",
    "source": "origen de la información",
    "validUntil": "2025-12-31",
    "relatedFaqs": ["id1", "id2"]
  }
}
```

---

## 📝 Historial de Cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| [YYYY-MM-DD] | Creación inicial | [Nombre] |
| [YYYY-MM-DD] | [Descripción del cambio] | [Nombre] |

---

*Template v1.0 — Sistema de Knowledge Base — WhatsApp Bot Platform*
