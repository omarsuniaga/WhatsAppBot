# Módulo Base de Conocimiento (KB) - Especificación Técnica

## 1. Objetivos

### Objetivos
- Permitir a operadores importar documentos `.md` como fuente de verdad institucional
- Contextualizar a Gemini para responder preguntas con información verificable
- Evitar alucinaciones mediante RAG (Retrieval-Augmented Generation)
- Identificar gaps de conocimiento para mejora continua
- Soportar múltiples canales: web, WhatsApp, operador interno

### No-Objetivos
- No reemplazar comunicación humana para casos complejos
- No generar contenido sin evidencia documental
- No almacenar datos personales sensibles en chunks

---

## 2. Arquitectura de Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ADMIN UI (React)                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ Upload   │  │ Doc List │  │ Search   │  │ Gaps Dashboard   │    │
│  │ .md      │  │ + Status │  │ KB       │  │ (sin evidencia)  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API LAYER (Express)                         │
│  POST /kb/import    GET /kb/docs    POST /kb/ask    GET /kb/gaps   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │  MD Parser   │ │  Embedding   │ │   Gemini     │
            │  + Chunker   │ │  Service     │ │   Client     │
            └──────────────┘ └──────────────┘ └──────────────┘
                    │               │               │
                    ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA LAYER (JSON/Firestore)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ kb_docs  │  │kb_chunks │  │kb_queries│  │ kb_embeddings    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Flujo de Datos

### 3.1 Flujo de Ingesta
```
Admin sube .md
      │
      ▼
┌─────────────────┐
│ Parse Frontmatter│
│ (YAML metadata) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Chunking        │
│ (por headings)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Guardar kb_docs │
│ + kb_chunks     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generar         │
│ Embeddings      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Marcar como     │
│ "indexed"       │
└─────────────────┘
```

### 3.2 Flujo de Consulta (AskKB)
```
Pregunta llega (web/wa/operador)
         │
         ▼
┌─────────────────┐
│ Generar embedding│
│ de la pregunta  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Vector Search   │
│ topK chunks     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Filtrar por     │
│ audience/tags   │
└────────┬────────┘
         │
    score < umbral?
    ┌────┴────┐
   yes       no
    │         │
    ▼         ▼
┌───────┐ ┌─────────────────┐
│gap=true│ │ Construir prompt│
└───────┘ │ con contexto    │
    │     └────────┬────────┘
    │              │
    │              ▼
    │     ┌─────────────────┐
    │     │ Llamar Gemini   │
    │     └────────┬────────┘
    │              │
    └──────┬───────┘
           ▼
┌─────────────────┐
│ Guardar log     │
│ en kb_queries   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Retornar        │
│ respuesta       │
└─────────────────┘
```

---

## 4. Modelo de Datos

### 4.1 KBDoc (kb_docs)
```typescript
interface KBDoc {
  id: string;                    // kb_doc_xxx
  filename: string;              // original filename
  title: string;                 // from frontmatter or first heading
  rawMd: string;                 // original markdown
  checksum: string;              // MD5 for change detection
  audience: KBAudience[];        // ["padre", "alumno", "docente", "admin"]
  tags: string[];                // ["asistencias", "normas", "inscripcion"]
  version: string;               // "1.0"
  source: string;                // "Manual de Convivencia"
  status: KBDocStatus;           // "draft" | "active" | "deprecated"
  chunksCount: number;
  indexedAt: string | null;      // ISO date when embeddings generated
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 KBChunk (kb_chunks)
```typescript
interface KBChunk {
  id: string;                    // kb_chunk_xxx
  docId: string;                 // reference to kb_doc
  chunkIndex: number;            // order within doc
  headingPath: string[];         // ["Asistencias", "Justificación"]
  text: string;                  // chunk content
  tokenCount: number;            // approximate tokens
  audience: KBAudience[];        // inherited or overridden
  tags: string[];                // inherited or overridden
  embedding: number[] | null;    // vector (768 dims for Gemini)
  embeddingModel: string;        // "text-embedding-004"
  createdAt: string;
  updatedAt: string;
}
```

### 4.3 KBQuery (kb_queries)
```typescript
interface KBQuery {
  id: string;                    // kb_query_xxx
  question: string;              // original question
  normalizedQuestion: string;    // cleaned version
  channel: KBChannel;            // "web" | "whatsapp" | "internal"
  audience: KBAudience;          // who is asking
  topChunks: KBChunkMatch[];     // chunks used with scores
  answer: string;                // generated answer
  confidence: number;            // 0-1
  gap: boolean;                  // true if insufficient evidence
  usedCitations: string[];       // chunk IDs actually cited
  suggestedActions: string[];    // follow-up suggestions
  processingTimeMs: number;
  createdAt: string;
}

interface KBChunkMatch {
  chunkId: string;
  docId: string;
  score: number;                 // similarity score
  title: string;
  headingPath: string[];
}
```

### 4.4 Enums
```typescript
type KBAudience = "padre" | "alumno" | "docente" | "admin" | "publico";
type KBChannel = "web" | "whatsapp" | "internal";
type KBDocStatus = "draft" | "active" | "deprecated" | "indexing" | "error";
```

---

## 5. Estrategia de Chunking

### Reglas
1. **Cortar por headings** (`#`, `##`, `###`) como límites naturales
2. **Tamaño objetivo**: 400-800 tokens (~1600-3200 caracteres)
3. **Overlap**: 50 tokens entre chunks para contexto
4. **Preservar headingPath**: ruta jerárquica para citación
5. **Frontmatter**: extraer y propagar metadata a chunks

### Algoritmo
```
1. Extraer frontmatter (si existe)
2. Dividir por headings de nivel 1-3
3. Para cada sección:
   a. Si < 400 tokens: mantener completo
   b. Si > 800 tokens: subdividir por párrafos
   c. Agregar overlap del chunk anterior
4. Generar headingPath para cada chunk
5. Propagar audience/tags del doc a chunks
```

---

## 6. Estrategia de Embeddings

### Modelo
- **Modelo**: `text-embedding-004` (Gemini)
- **Dimensiones**: 768
- **Batch size**: 100 chunks por request

### Versionado
```typescript
interface EmbeddingMeta {
  model: string;
  dimensions: number;
  generatedAt: string;
}
```

### Reindexación
- Trigger: checksum del doc cambia
- Proceso: eliminar chunks antiguos, crear nuevos, regenerar embeddings
- Flag: `status: "indexing"` durante proceso

---

## 7. Estrategia de Retrieval

### Parámetros
- **topK**: 5 (default, configurable)
- **Umbral de confianza**: 0.7 (si max score < 0.7, gap=true)
- **Filtros**: audience, tags (optional)

### Algoritmo de Similitud
```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}
```

---

## 8. Plantilla de Prompt para Gemini

### System Prompt
```
Eres el asistente virtual institucional de [NOMBRE_INSTITUCION].
Tu rol es responder preguntas de la comunidad educativa (padres, alumnos, docentes) 
usando ÚNICAMENTE la información proporcionada en la EVIDENCIA.

REGLAS ESTRICTAS:
1. SOLO responde con base en la EVIDENCIA proporcionada
2. Si la información no está en la evidencia: di "No tengo esa información en mi base de conocimiento"
3. Sugiere a qué área contactar si no puedes responder
4. Usa tono institucional, cordial y directo
5. Incluye pasos accionables cuando aplique
6. Menciona horarios, canales oficiales y responsables cuando sea relevante
7. NO inventes información
8. NO uses palabras como "chunk", "embedding", "base de datos"
```

### Developer Prompt
```
Formato de salida OBLIGATORIO (JSON):
{
  "answer": "Respuesta clara y concisa",
  "confidence": 0.0-1.0,
  "used_citations": ["chunk_id_1", "chunk_id_2"],
  "gap": false,
  "followups": ["Pregunta relacionada 1", "Pregunta relacionada 2"]
}

Si gap=true, la respuesta debe incluir:
- Reconocer que no hay información disponible
- Sugerir área de contacto
- Indicar qué documento podría faltar
```

### User Prompt Template
```
PREGUNTA: {question}
AUDIENCIA: {audience}
CANAL: {channel}

EVIDENCIA DISPONIBLE:
{chunks.map(c => `
[${c.id}] Documento: ${c.docTitle}
Sección: ${c.headingPath.join(' > ')}
Contenido:
${c.text}
---
`).join('\n')}

Responde en formato JSON siguiendo las reglas establecidas.
```

---

## 9. Observabilidad

### Logs
- Cada query se guarda en `kb_queries`
- Incluye: pregunta, respuesta, chunks usados, scores, tiempo

### Métricas
- Queries por día/canal/audiencia
- Tasa de gap (preguntas sin evidencia)
- Score promedio de retrieval
- Tiempo de respuesta promedio

### Dashboard de Gaps
- Lista de queries donde `gap=true`
- Agrupadas por tema inferido
- Acción: crear documento faltante

---

## 10. Seguridad

### Roles
- **admin**: CRUD completo, ver logs
- **operador**: consultar KB, ver respuestas
- **readonly**: solo consultar

### Protección
- Sanitizar markdown antes de guardar
- Rate limiting: 100 queries/min por IP
- No exponer embeddings en API pública

---

## 11. Plan de Implementación

### Fase 1: MVP (Esta iteración)
- [x] Especificación técnica
- [ ] Parser de Markdown + Frontmatter
- [ ] Chunker básico
- [ ] Modelos de datos (KBDoc, KBChunk, KBQuery)
- [ ] Repositorios JSON
- [ ] Endpoint POST /kb/import
- [ ] Endpoint GET /kb/docs
- [ ] UI básica de upload

### Fase 2: RAG Completo
- [ ] Servicio de embeddings (Gemini)
- [ ] Vector search (cosine similarity)
- [ ] Endpoint POST /kb/ask
- [ ] Integración con Gemini para respuestas
- [ ] Logging de queries

### Fase 3: Mejora Continua
- [ ] Dashboard de gaps
- [ ] Métricas y analytics
- [ ] Reindexación automática
- [ ] Integración con WhatsApp bot

---

## 12. API Endpoints

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | /kb/import | Importar documento .md | admin |
| GET | /kb/docs | Listar documentos | admin |
| GET | /kb/docs/:id | Obtener documento | admin |
| DELETE | /kb/docs/:id | Eliminar documento | admin |
| POST | /kb/docs/:id/reindex | Reindexar documento | admin |
| GET | /kb/chunks | Listar chunks (con filtros) | admin |
| POST | /kb/ask | Consultar KB (RAG) | operador |
| GET | /kb/queries | Historial de consultas | admin |
| GET | /kb/gaps | Consultas sin evidencia | admin |
| GET | /kb/stats | Estadísticas del módulo | admin |
