# ⚡ TRIGGERS - Inicio Rápido

## 🎯 En 30 Segundos

El **Sistema de Triggers** permite que el bot de WhatsApp responda automáticamente cuando detecta palabras clave en los mensajes.

**Acceso**: Click en ⋯ (esquina superior) → **"Triggers ⚡"**

---

## 📍 Ubica Dónde Está

```
Dashboard
  └─ Lista de chats (arriba a la derecha)
     └─ Botón ⋯ (Configuración)
        └─ Triggers ⚡ (AQUÍ ESTÁ)
```

---

## 🚀 Primera Vez

### 1. Crear un Trigger
```
1. Click en "Nuevo Trigger"
2. Ingresa palabra (ej: "hola")
3. Selecciona tipo: "contains" (recomendado)
4. Click "Crear Trigger" ✓
```

### 2. Probar que Funciona
```
1. Ve a "Probador de Triggers"
2. Escribe: "Hola mundo"
3. Verás: ✓ hola (contains)
```

### 3. ¿Listo!
El bot ahora responde cuando alguien escriba "hola"

---

## 📚 Tipos de Búsqueda

| Tipo | Ejemplo | Uso |
|------|---------|-----|
| **exact** | "hola" solo = "hola" | Coincidencia exacta |
| **contains** | "hola"en "¡Hola mundo!" | Palabras en mensajes |
| **startsWith** | "hola" al inicio | Empezar con palabra |
| **regex** | "hola\d+" →"hola123" | Patrones avanzados |

---

## 💡 Casos Comunes

### Saludos
```
Keyword: "hola"
Tipo: contains
Habilitado: ✓

Respuesta: Automática cuando alguien saluda
```

### Consultas
```
Keyword: "ayuda"
Tipo: contains  
Habilitado: ✓

Respuesta: Escalada a admin o KB
```

### Emergencias
```
Keyword: "urgente"
Tipo: regex
Prioridad: 100
Habilitado: ✓

Respuesta: Prioritaria
```

---

## ⚙️ Controles Rápidos

| Botón | Qué Hace |
|-------|----------|
| **⚡ (Power)** | Activar/desactivar trigger |
| **✎ (Editar)** | Cambiar trigger |
| **🗑 (Eliminar)** | Borrar definitivamente |
| **Activar todos** | Habilitar todos de una vez |
| **Exportar** | Descargar lista como JSON |

---

## 📊 Información Útil

### Estadísticas
- **Total**: Todos los triggers creados
- **Activos**: Los que están funcionando ahora
- **Inactivos**: Guardados pero deshabilitados

### Por Trigger
- **Coincidencias**: Cuántas veces se activó
- **Última vez**: Cuándo fue la última activación

---

## ❓ Preguntas Frecuentes

**P: ¿Mi trigger no funciona?**
- ✓ Verifica que esté VERDE (activo)
- ✓ Usa el probador para testear
- ✓ Revisa el tipo de coincidencia

**P: ¿Cómo pausar todo?**
- Toggle del Listener (arriba en Triggers)
- O desactiva todos individualmente

**P: ¿Puedo poner múltiples palabras?**
- Sí, con **regex**: `"hola|buenos|hi"`

**P: ¿Cuál es la prioridad?**
- Mayor número = Se evalúa primero
- Para emergencias: 100

**P: ¿La búsqueda es sensible a mayúsculas?**
- Por defecto NO ("Hola" = "hola")
- Marca **"Distinguir mayúsculas"** si quieres que SÍ

---

## 📞 Documentación Completa

Para más detalle:
- **Usuarios**: Ver `docs/TRIGGERS_GUIDE.md`
- **Desarrolladores**: Ver `docs/TRIGGERS_TECHNICAL.md`
- **Resumen técnico**: Ver `TRIGGERS_IMPLEMENTATION_SUMMARY.md`

---

## ✨ Tips Pro

1. **Usa categorías** para organizar triggers relacionados
2. **Exporta regularmente** para backup
3. **Prioriza triggers importantes** (numeros altos)
4. **Prueba antes de habilitar** con el probador
5. **Revisa estadísticas** para optimizar

---

**¡Listo para empezar!** 🚀

Última actualización: Febrero 2026
