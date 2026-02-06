#!/bin/bash
# =============================================================================
# Restore Script - WhatsApp Bot Platform
# =============================================================================
# Script para restaurar backups del sistema

set -euo pipefail

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "${GREEN}[INFO] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Función para listar backups disponibles
list_backups() {
    local backup_type=${1:-"all"}
    
    echo "Backups disponibles:"
    echo "=================="
    
    case $backup_type in
        "sessions")
            ls -la ./backups/whatsapp-sessions-*.tar.gz 2>/dev/null || warn "No hay backups de sesiones"
            ;;
        "data")
            ls -la ./backups/app-data-*.tar.gz 2>/dev/null || warn "No hay backups de datos"
            ;;
        "config")
            ls -la ./backups/config-*.txt 2>/dev/null || warn "No hay backups de configuración"
            ;;
        "logs")
            ls -la ./backups/logs-*.tar.gz 2>/dev/null || warn "No hay backups de logs"
            ;;
        "redis")
            ls -la ./backups/redis-dump-*.rdb 2>/dev/null || warn "No hay backups de Redis"
            ;;
        *)
            ls -la ./backups/ | grep -E "(\.tar\.gz|\.rdb|\.txt)" || warn "No hay backups disponibles"
            ;;
    esac
}

# Restaurar WhatsApp Sessions
restore_sessions() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        list_backups "sessions"
        read -p "Selecciona el archivo de backup de sesiones: " backup_file
    fi
    
    if [ ! -f "$backup_file" ]; then
        error "Archivo de backup no encontrado: $backup_file"
    fi
    
    warn "⚠️  Esto reemplazará todas las sesiones WhatsApp actuales"
    read -p "¿Continuar? (y/N): " confirm
    
    if [[ $confirm =~ ^[Yy]$ ]]; then
        # Hacer backup actual antes de restaurar
        if [ -d "./web-bot_sessions" ]; then
            mv ./web-bot_sessions ./web-bot_sessions.backup.$(date +%s)
            log "📦 Backup actual guardado como web-bot_sessions.backup.$(date +%s)"
        fi
        
        mkdir -p ./web-bot_sessions
        tar -xzf "$backup_file" -C ./web-bot_sessions
        log "✅ WhatsApp Sessions restauradas exitosamente"
        
        # Reiniciar contenedor si está corriendo
        if docker ps --format "table {{.Names}}" | grep -q "whatsapp-bot"; then
            log "🔄 Reiniciando contenedor WhatsApp Bot..."
            docker restart whatsapp-bot-platform
        fi
    else
        log "Operación cancelada"
    fi
}

# Restaurar datos de aplicación
restore_app_data() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        list_backups "data"
        read -p "Selecciona el archivo de backup de datos: " backup_file
    fi
    
    if [ ! -f "$backup_file" ]; then
        error "Archivo de backup no encontrado: $backup_file"
    fi
    
    warn "⚠️  Esto reemplazará todos los datos actuales (Knowledge Base, contacts, etc.)"
    read -p "¿Continuar? (y/N): " confirm
    
    if [[ $confirm =~ ^[Yy]$ ]]; then
        # Hacer backup actual
        if [ -d "./data" ]; then
            mv ./data ./data.backup.$(date +%s)
            log "📦 Backup actual de datos guardado"
        fi
        
        mkdir -p ./data
        tar -xzf "$backup_file" -C ./data
        log "✅ Datos de aplicación restaurados exitosamente"
    else
        log "Operación cancelada"
    fi
}

# Restaurar Redis
restore_redis() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        list_backups "redis"
        read -p "Selecciona el archivo de backup de Redis: " backup_file
    fi
    
    if [ ! -f "$backup_file" ]; then
        error "Archivo de backup no encontrado: $backup_file"
    fi
    
    if ! docker ps --format "table {{.Names}}" | grep -q "redis"; then
        error "Container Redis no está corriendo. Inicia el sistema primero."
    fi
    
    warn "⚠️  Esto reemplazará todos los datos Redis actuales"
    read -p "¿Continuar? (y/N): " confirm
    
    if [[ $confirm =~ ^[Yy]$ ]]; then
        # Copiar archivo de backup al contenedor
        docker cp "$backup_file" whatsapp-bot-redis:/data/dump.rdb.temp
        docker exec whatsapp-bot-redis sh -c "mv /data/dump.rdb.temp /data/dump.rdb && redis-cli DEBUG RESTART"
        log "✅ Redis restaurado exitosamente"
    else
        log "Operación cancelada"
    fi
}

# Mostrar ayuda
show_help() {
    echo "WhatsApp Bot Platform - Restore Script"
    echo "====================================="
    echo ""
    echo "Uso: $0 [comando] [opciones]"
    echo ""
    echo "Comandos:"
    echo "  list [type]           Listar backups disponibles"
    echo "  sessions [file]       Restaurar WhatsApp Sessions"
    echo "  data [file]           Restaurar datos de aplicación"
    echo "  redis [file]          Restaurar Redis"
    echo "  help                  Mostrar esta ayuda"
    echo ""
    echo "Tipos de backups para 'list':"
    echo "  sessions, data, config, logs, redis, all"
    echo ""
    echo "Ejemplos:"
    echo "  $0 list sessions"
    echo "  $0 sessions ./backups/whatsapp-sessions-20240101_120000.tar.gz"
    echo "  $0 data"
}

# Función principal
main() {
    case ${1:-"help"} in
        "list")
            list_backups "$2"
            ;;
        "sessions")
            restore_sessions "$2"
            ;;
        "data")
            restore_app_data "$2"
            ;;
        "redis")
            restore_redis "$2"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            error "Comando desconocido: $1. Usa 'help' para ver opciones."
            ;;
    esac
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    error "Este script debe ejecutarse desde el directorio raíz del proyecto"
fi

# Crear directorio de backups si no existe
mkdir -p ./backups

main "$@"