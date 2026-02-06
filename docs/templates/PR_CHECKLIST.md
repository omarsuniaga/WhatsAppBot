# 📋 PR Checklist Template

> Usar esta checklist antes de crear un Pull Request.  
> Marcar todos los items aplicables antes de solicitar revisión.

---

## Información del PR

- **Título:** [Descripción breve y descriptiva]
- **Tipo:** [ ] Feature | [ ] Bugfix | [ ] Refactor | [ ] Docs | [ ] Chore
- **Issue relacionado:** #[número] (si aplica)
- **Fase del roadmap:** [A/B/C/D/E] (si aplica)

---

## ✅ Código

### Calidad
- [ ] Código compila sin errores (`npm run build`)
- [ ] Linter pasa sin warnings (`npm run lint`)
- [ ] No hay `console.log` de debug en código de producción
- [ ] No hay código comentado innecesario
- [ ] Imports están ordenados y sin duplicados
- [ ] Nombres de variables/funciones son descriptivos

### TypeScript
- [ ] Todos los tipos están definidos (no `any` sin justificación)
- [ ] Interfaces están documentadas si son públicas
- [ ] No hay type assertions innecesarias (`as`)

### Arquitectura
- [ ] Sigue los patrones existentes del proyecto
- [ ] Services usan patrón Singleton si corresponde
- [ ] Controllers manejan errores con try/catch
- [ ] Componentes React manejan estados (loading/error/empty)

---

## 🛡️ Seguridad

- [ ] No hay credenciales o secrets hardcodeados
- [ ] Inputs del usuario están validados
- [ ] No hay SQL injection / XSS posible
- [ ] Datos sensibles no se exponen en logs
- [ ] Permisos están verificados donde aplique

---

## ⚡ WhatsApp Específico (si aplica)

- [ ] Rate limiting implementado (mín. 2s entre mensajes)
- [ ] Anti-loop implementado (evitar bucles infinitos)
- [ ] Manejo de desconexión contemplado
- [ ] No se envían mensajes a JIDs inválidos
- [ ] Typing indicator usado apropiadamente

---

## 🧪 Testing

- [ ] Tests unitarios agregados/actualizados
- [ ] Tests de integración agregados (si aplica)
- [ ] Todos los tests pasan localmente
- [ ] Edge cases están cubiertos
- [ ] Cobertura de tests no decrece

### Casos probados manualmente
- [ ] Happy path funciona
- [ ] Error handling funciona
- [ ] Edge cases verificados:
  - [ ] Input vacío
  - [ ] Input muy largo
  - [ ] Caracteres especiales
  - [ ] Concurrencia (si aplica)

---

## 📚 Documentación

- [ ] README actualizado (si cambia setup o uso)
- [ ] API documentada (si hay endpoints nuevos)
- [ ] Comentarios en código complejo
- [ ] CHANGELOG actualizado (si es release)
- [ ] ADR creado (si es decisión arquitectónica)

---

## 🔄 Integración

- [ ] Branch está actualizado con main/develop
- [ ] No hay conflictos de merge
- [ ] Migraciones de datos incluidas (si aplica)
- [ ] Variables de entorno documentadas (si hay nuevas)

---

## 📸 Screenshots/Videos (si aplica UI)

| Antes | Después |
|-------|---------|
| [img] | [img]   |

---

## 🚨 Notas para el Revisor

[Cualquier contexto adicional, áreas de atención especial, o decisiones que requieren discusión]

---

## 📝 Checklist del Revisor

- [ ] Código revisado y aprobado
- [ ] Tests verificados
- [ ] Documentación verificada
- [ ] Sin concerns de seguridad
- [ ] Listo para merge

---

*Template v1.0 — Proyecto WhatsApp Bot Platform*
