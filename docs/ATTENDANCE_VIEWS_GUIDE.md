# 📋 Vista de Asistencias - Guía de Arquitectura

> **Fecha:** 2026-02-09  
> **Versión:** 1.0  
> **Estado:** Implementado y unificado

---

## 🎯 Propósito del Documento

Este documento define claramente la separación de responsabilidades entre las diferentes vistas de asistencia para evitar confusión y mantener un código mantenible.

---

## 🏗️ Arquitectura Actual

### Rutas Principales

| Ruta | Componente | Propósito Principal | Público Objetivo |
|------|------------|-------------------|------------------|
| `/attendance` | `AttendanceControlPage` | Dashboard de gestión y supervisión | Administradores, Directivos |
| `/attendance/register` | `AttendancePage` | Registro operativo diario | Profesores, Secretarios |
| `/automations/alerts` | `AttendanceAlertsPage` | Configuración de automatizaciones | Administradores |

---

## 📊 Componentes Detallados

### 1. AttendanceControlPage (`/attendance`)

**Rol:** Panel de Control Estratégico

**Funcionalidades:**
- **Métricas en tiempo real**: Tasa de asistencia, inasistencias, tardanzas
- **Alumnos críticos**: Identificación automática con ≥3 faltas
- **Alertas a padres**: Envío directo de notificaciones por WhatsApp
- **Recordatorios a profesores**: Envío automático para reportes pendientes
- **Feed de observaciones**: Visualización y gestión de notas
- **Justificación rápida**: Toggle para marcar justificados
- **Exportación de datos**: CSV para análisis

**Key Features:**
- Filtros por período (hoy, semana, mes, personalizado)
- Dashboard con métricas visuales
- Acciones directas de comunicación
- Historial de observaciones con búsquedas

**Casos de Uso:**
- Un director quiere ver la tasa de asistencia del mes
- Una secretaria necesita identificar alumnos con muchas faltas
- Un administrador quiere enviar alertas a padres de alumnos críticos

---

### 2. AttendancePage (`/attendance/register`)

**Rol:** Herramienta Operativa Diaria

**Funcionalidades:**
- **Registro por clase**: Selección de clase y fecha específica
- **Gestión de estudiantes**: Checkboxes para presente/ausente/tarde/justificado
- **Notas individuales**: Campos de texto para observaciones
- **Acciones masivas**: Marcar todos presentes, copiar de última clase
- **Historial por clase**: Consulta de registros anteriores
- **Vista calendario**: Visualización mensual con indicadores
- **Configuración de recordatorios**: Panel `DailyReminderPanel`

**Pestañas Internas:**
1. **Tablero**: Vista general de hoy
2. **Calendario**: Vista mensual con estados
3. **Registrar**: Formulario principal de registro
4. **Historial**: Consultas y exportaciones
5. **Configuración**: Recordatorios diarios automáticos

**Casos de Uso:**
- Un profesor necesita registrar la asistencia de su clase
- Una secretaria quiere ver el historial de una clase específica
- Un administrador configura recordatorios automáticos

---

### 3. AttendanceAlertsPage (`/automations/alerts`)

**Rol:** Configuración de Automatización

**Funcionalidades:**
- Configuración de reglas de alerta automática
- Gestión de umbrales y notificaciones
- Integración con sistemas de comunicación

---

## 🔧 Problemas Resueltos

### Issue #1: Keys Duplicadas en React
**Problema:** Warning de keys duplicadas `MRFSG0hwpYJhcIA3GTmF_2026-02-03`

**Solución Implementada:**
```tsx
// Antes (potencialmente duplicado)
{attendances.filter(a => a.observaciones).map((a) => (
    <div key={a.id}>...</div>
))}

// Después (siempre único)
{attendances.filter(a => a.observaciones).map((a, index) => (
    <div key={`${a.id}-${a.alumno_id}-${index}`}>...</div>
))}
```

**Keys Estratégicas:**
- **Critical Students**: `critical-${s.id}-${index}`
- **Pending Reports**: `pending-${c.id}-${index}`
- **Observations**: `${a.id}-${a.alumno_id}-${index}`

---

## 🎨 Principios de Diseño

### Separación de Responsabilidades
1. **Estratégico vs Operativo**: Dashboard vs Registro
2. **Gestión vs Configuración**: Control día a día vs Automatización
3. **Análisis vs Acción**: Métricas vs Datos individuales

### Consistencia Visual
- **Dashboard**: Tarjetas de métricas, colores de estado
- **Registros**: Tablas y formularios, checklists
- **Configuración**: Paneles con toggles y selects

---

## 🔄 Flujo de Usuario Típico

### Flujo de Administrador
```
1. Ingresa a /attendance (Dashboard)
2. Revisa métricas generales
3. Identifica alumnos críticos
4. Envía alertas a padres
5. Revisa reportes pendientes
6. Envía recordatorios a profesores
7. Exporta datos si es necesario
```

### Flujo de Profesor/Secretario
```
1. Ingresa a /attendance/register
2. Selecciona su clase y fecha
3. Marca asistencia de estudiantes
4. Agrega observaciones si es necesario
5. Guarda el registro
6. Si necesita, consulta historial
```

---

## 🚀 Mejoras Futuras

### Corto Plazo
- [ ] Indicadores visuales en el menú para alertas
- [ ] Filtros adicionales en el dashboard
- [ ] Exportación en diferentes formatos (PDF, Excel)

### Mediano Plazo
- [ ] Integración con sistemas de calificaciones
- [ ] Notificaciones push para alertas críticas
- [ ] Análisis predictivo de deserción

### Largo Plazo
- [ ] Dashboard de analytics avanzado
- [ ] Integración con sistemas de pago
- [ ] Móvil app para registro offline

---

## 📝 Checklist de Desarrollo

### Para nuevos features en AttendanceControlPage
- [ ] Las keys son únicas usando `${id}-${type}-${index}`
- [ ] Las acciones tienen loading states
- [ ] Los errores tienen mensajes claros
- [ ] Los datos se refrescan automáticamente
- [ ] Las acciones críticas tienen confirmación

### Para nuevos features en AttendancePage
- [ ] Los formularios validan inputs
- [ ] Las acciones masivas tienen confirmación
- [ ] Los historiales tienen paginación
- [ ] Las exportaciones incluyen todos los filtros

---

## 🔍 Referencias Técnicas

### Archivos Principales
- `web/src/pages/AttendanceControlPage.tsx` - Dashboard estratégico
- `web/src/pages/AttendancePage.tsx` - Registro operativo
- `web/src/pages/AttendanceAlertsPage.tsx` - Configuración de automatización
- `web/src/components/attendance/DailyReminderPanel.tsx` - Subcomponente de recordatorios

### Servicios Utilizados
- `asistenciasService` - CRUD de asistencias
- `clasesService` - Gestión de clases
- `contactosService` - Datos de contactos
- `messageApi` - Envío de mensajes WhatsApp
- `dailyReminderApi` - Configuración de recordatorios

---

## 📞 Soporte

Para problemas o dudas sobre estas vistas:
1. Revisar este documento
2. Consultar los componentes individuales
3. Verificar las API references
4. Contactar al equipo de desarrollo

---

*Documento vivo - Actualizar según evolucione el sistema*