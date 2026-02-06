#!/bin/bash
# =============================================================================
# Backup Script - WhatsApp Bot Platform
# =============================================================================
# Script automatizado para backups críticos del sistema

set -euo pipefail

# Configuración
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Crear directorio de backups
mkdir -p "$BACKUP_DIR"

# Backup de WhatsApp Sessions (CRÍTICO)
backup_whatsapp_sessions() {
    log "Iniciando backup de WhatsApp Sessions..."
    
    if [ -d "./web-bot_sessions" ]; then
        tar -czf "$BACKUP_DIR/whatsapp-sessions-$DATE.tar.gz" -C "./web-bot_sessions" .
        log "✅ WhatsApp Sessions backup completado"
    else
        warn "Directorio web-bot_sessions no encontrado"
    fi
}

# Backup de datos de aplicación
backup_app_data() {
    log "Iniciando backup de datos de aplicación..."
    
    if [ -d "./data" ]; then
        tar -czf "$BACKUP_DIR/app-data-$DATE.tar.gz" -C "./data" .
        log "✅ App data backup completado"
    else
        warn "Directorio data no encontrado"
    fi
}

# Backup de configuración
backup_config() {
    log "Iniciando backup de configuración..."
    
    # Crear archivo temporal con configuración
    TEMP_CONFIG=$(mktemp)
    
    {
        echo "# Backup Configuration - $(date)" 
        echo "=================================="
        echo ""
        echo "## Environment Variables"
        if [ -f ".env" ]; then
            echo "# .env (filtrado)"
            grep -v "SECRET\|KEY\|PASSWORD" .env || echo "# No se encontraron variables sensibles"
        fi
        echo ""
        
        echo "## Docker Compose Configuration"
        if [ -f "docker-compose.yml" ]; then
            echo "# docker-compose.yml"
            cat docker-compose.yml
        fi
        echo ""
        
        echo "## Package Versions"
        echo "# Backend"
        if [ -f "package.json" ]; then
            grep -E "\"(name|version)\"" package.json
        fi
        echo "# Frontend"
        if [ -f "web/package.json" ]; then
            grep -E "\"(name|version)\"" web/package.json
        fi
        
    } > "$TEMP_CONFIG"
    
    cp "$TEMP_CONFIG" "$BACKUP_DIR/config-$DATE.txt"
    rm "$TEMP_CONFIG"
    
    log "✅ Configuración backup completada"
}

# Backup de logs (últimos 7 días)
backup_logs() {
    log "Iniciando backup de logs..."
    
    if [ -d "./logs" ]; then
        find ./logs -name "*.log" -mtime -7 -print0 | \
            tar -czf "$BACKUP_DIR/logs-$DATE.tar.gz" --null -T -
        log "✅ Logs backup completado"
    else
        warn "Directorio logs no encontrado"
    fi
}

# Backup de base de datos Redis si está activo
backup_redis() {
    log "Iniciando backup de Redis..."
    
    # Verificar si Redis container está corriendo
    if docker ps --format "table {{.Names}}" | grep -q "redis"; then
        docker exec whatsapp-bot-redis redis-cli BGSAVE
        sleep 5  # Esperar a que termine el backup
        
        # Copiar archivo de dump
        docker cp whatsapp-bot-redis:/data/dump.rdb "$BACKUP_DIR/redis-dump-$DATE.rdb"
        log "✅ Redis backup completado"
    else
        warn "Redis container no está corriendo"
    fi
}

# Limpieza de backups antiguos
cleanup_old_backups() {
    log "Limpiando backups antiguos (más de $RETENTION_DAYS días)..."
    
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.rdb" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.txt" -mtime +$RETENTION_DAYS -delete
    
    log "✅ Limpieza completada"
}

# Verificar integridad de backups
verify_backups() {
    log "Verificando integridad de backups..."
    
    for file in "$BACKUP_DIR"/*"$DATE"*; do
        if [ -f "$file" ]; then
            if tar -tzf "$file" > /dev/null 2>&1; then
                log "✅ $(basename "$file") - OK"
            else
                error "❌ $(basename "$file") - Corrupto"
            fi
        fi
    done
    
    # Verificar archivos Redis
    for file in "$BACKUP_DIR"/redis-dump-*"$DATE"*; do
        if [ -f "$file" ]; then
            log "✅ $(basename "$file") - OK"
        fi
    done
}

# Generar reporte
generate_report() {
    local report_file="$BACKUP_DIR/backup-report-$DATE.txt"
    
    {
        echo "WhatsApp Bot Platform - Backup Report"
        echo "===================================="
        echo "Fecha: $(date)"
        echo "Hostname: $(hostname)"
        echo ""
        
        echo "Backups creados:"
        ls -la "$BACKUP_DIR"/*"$DATE"* 2>/dev/null || echo "Ningún backup encontrado"
        echo ""
        
        echo "Espacio utilizado:"
        du -sh "$BACKUP_DIR"
        echo ""
        
        echo "Contenedores Docker corriendo:"
        docker ps --format "table {{.Names}}\t{{.Status}}"
        
    } > "$report_file"
    
    log "📊 Reporte generado: $report_file"
}

# Función principal
main() {
    log "🚀 Iniciando backup completo del WhatsApp Bot Platform"
    
    # Ejecutar todos los backups
    backup_whatsapp_sessions
    backup_app_data
    backup_config
    backup_logs
    backup_redis
    
    # Limpieza y verificación
    cleanup_old_backups
    verify_backups
    
    # Generar reporte
    generate_report
    
    log "🎉 Backup completado exitosamente"
    log "📍 Backups guardados en: $BACKUP_DIR"
}

# Manejo de señales
trap 'error "Script interrumpido"' INT TERM

# Ejecutar main
main "$@"