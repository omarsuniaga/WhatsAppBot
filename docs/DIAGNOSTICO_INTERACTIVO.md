# 🔍 DIAGNÓSTICO EN VIVO - Solo 1 Chat Visible

## PASO 1: Verificar Backend (Endpoint de Diagnóstico)

1. Abre en el navegador:
   ```
   http://localhost:3000/api/chats/diagnostics/chat-load
   ```

2. Busca en la respuesta JSON:
   ```json
   "fullFlow": {
     "totalChats": X,     // ← Cuántos chats hay en total?
     "method1Count": Y,   // ← De store.chats
     "method2Count": Z    // ← De store.messages
   }
   ```

3. **Interpreta el resultado:**
   - Si `totalChats: 1` → **PROBLEMA EN BACKEND** (Solo hay 1 chat en Baileys)
   - Si `totalChats: 5+` → **PROBLEMA EN FRONTEND** (Backend retorna múltiples, pero UI solo muestra 1)

---

## PASO 2: Verificar Frontend (Console del Navegador)

1. Abre DevTools: **F12** → Pestaña **Console**

2. Ejecuta en la consola:
   ```javascript
   // Ver logs almacenados desde que cargó la página
   console.log('Busca mensajes que empiezan con [ChatList]');
   ```

3. Deberías ver logs como:
   ```
   [ChatList] API Response: {count: 5, pagination: {...}, sample: [{...}]}
   [ChatList] Deduplication: {before: 5, after: 5, removed: 0}
   [ChatList] Filtering pipeline: {unique: 5, afterSearch: 5, afterQuickFilter: ?, ...}
   ```

4. **Interpreta los logs:**
   - Si `[ChatList] API Response count: 1` → Backend solo retorna 1
   - Si `[ChatList] API Response count: 5+` pero `[ChatList] Filtering pipeline final: 1` → Filtros están removiendo items

---

## PASO 3: Verificar Filtros Activos

En la UI, busca estas opciones en la parte superior de la lista de chats:

```
┌─ Todos  │ No leídos  │ Favoritos  │ Grupos ─┐
└───────────────────────────────────────────┘
     ↑ Si alguno NO es "Todos", puede estar filtrando
```

Si tienes activo:
- ✓ **"No leídos"** → Solo muestra chats con unread > 0
- ✓ **"Grupos"** → Solo muestra grupos
- ✓ Un **filtro de bot** (Active/Inactive)
- ✓ Un **grupo de contacto seleccionado**

**Solución:** Haz click en "Todos" para resetear filtros

---

## 📋 CHECKLIST RÁPIDO

```
[ ] 1. Abrí /api/chats/diagnostics/chat-load
    [ ] totalChats = 1? → Backend problem (DETENTE AQUÍ)
    [ ] totalChats = 5+? → Continúa

[ ] 2. Abrí Console (F12)
    [ ] Veo [ChatList] logs?
    [ ] API Response count = 1 o 5+?

[ ] 3. Revisar filtros activos
    [ ] Hay algún filtro NO en "Todos"?
    [ ] Hay un grupo de contactos seleccionado?

[ ] 4. Resultado:
    [ ] Si API response = 1 → El problema es BAILEYS/WhatsApp, contacta soporte
    [ ] Si API response = 5+ pero final = 1 → Filtros activos, resetea
    [ ] Si filtros OK pero sigue = 1 → Hay un bug en deduplication
```

---

## 🚨 REPORTE DE PROBLEMAS

Proporciona:

1. **Captura de pantalla de** `/api/chats/diagnostics/chat-load` (el JSON)
2. **Captura de consola** con los logs `[ChatList]`
3. **Status de filtros** en la UI (¿cuál está activo?)

Ejemplo de reporte exitoso:
```
- Backend totalChats: 8
- Frontend API count: 8
- Logs show: afterSearch 8 → afterQuickFilter 1
- "No leídos" está activo
- ✅ Solución: Click "Todos" para resetear
```

---

*Documento de diagnóstico interactivo. Ejecuta los pasos y reporta los resultados.*
