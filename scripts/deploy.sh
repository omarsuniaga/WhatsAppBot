#!/bin/bash
# =============================================================================
# Deploy Script - WhatsApp Bot Platform
# =============================================================================
# Script automatizado para despliegue en producción

set -euo pipefail

# Configuración
ENVIRONMENT=${1:-"production"}
VERSION=$(date +%Y%m%d_%H%M%S)
COMPOSE_FILE="docker-compose.yml"

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

# Verificar prerequisitos
check_prerequisites() {
    log "🔍 Verificando prerequisitos..."
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        error "Docker no está instalado"
    fi
    
    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose no está instalado"
    fi
    
    # Verificar archivos de configuración
    if [ ! -f ".env" ]; then
        error "Archivo .env no encontrado. Crea uno primero."
    fi
    
    if [ ! -f "orquestapuntacana-firebase-adminsdk-fbsvc-1adc55a0b0.json" ]; then
        error "Archivo de Firebase no encontrado"
    fi
    
    # Verificar docker-compose
    if [ "$ENVIRONMENT" = "production" ] && [ ! -f "docker-compose.production.yml" ]; then
        error "Archivo docker-compose.production.yml no encontrado"
    fi
    
    log "✅ Prerequisitos verificados"
}

# Crear estructura de directorios
setup_directories() {
    log "📁 Creando estructura de directorios..."
    
    mkdir -p ./data/{sessions,app,redis}
    mkdir -p ./logs/{app,nginx,frontend}
    mkdir -p ./backups
    mkdir -p ./ssl
    mkdir -p ./config
    mkdir -p ./secrets
    
    # Establecer permisos
    chmod 755 ./data ./logs ./backups
    chmod 700 ./secrets
    
    log "✅ Directorios creados"
}

# Preparar secrets
setup_secrets() {
    log "🔐 Preparando secrets..."
    
    # Crear archivos de secrets desde variables de entorno
    if [ -n "${GEMINI_API_KEY:-}" ]; then
        echo "$GEMINI_API_KEY" > ./secrets/gemini_api_key.txt
        chmod 600 ./secrets/gemini_api_key.txt
    fi
    
    if [ -n "${ADMIN_API_KEY:-}" ]; then
        echo "$ADMIN_API_KEY" > ./secrets/admin_api_key.txt
        chmod 600 ./secrets/admin_api_key.txt
    fi
    
    log "✅ Secrets preparados"
}

# Construir imágenes
build_images() {
    log "🔨 Construyendo imágenes Docker..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        COMPOSE_FILE="docker-compose.production.yml"
        docker compose -f "$COMPOSE_FILE" build --no-cache
    else
        docker compose build --no-cache
    fi
    
    log "✅ Imágenes construidas"
}

# Realizar backup antes del despliegue
backup_before_deploy() {
    log "💾 Realizando backup pre-despliegue..."
    
    if [ -f "./scripts/backup.sh" ]; then
        chmod +x ./scripts/backup.sh
        ./scripts/backup.sh
    else
        warn "Script de backup no encontrado, omitiendo backup"
    fi
    
    log "✅ Backup completado"
}

# Desplegar aplicación
deploy_application() {
    log "🚀 Desplegando aplicación..."
    
    # Detener servicios existentes
    if [ "$ENVIRONMENT" = "production" ]; then
        docker compose -f "$COMPOSE_FILE" down
        sleep 5
        
        # Iniciar servicios
        docker compose -f "$COMPOSE_FILE" up -d
    else
        docker compose down
        sleep 5
        
        docker compose up -d
    fi
    
    log "✅ Aplicación desplegada"
}

# Esperar a que los servicios estén listos
wait_for_services() {
    log "⏳ Esperando a que los servicios estén listos..."
    
    # Esperar al backend
    local backend_ready=false
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ] && [ "$backend_ready" = false ]; do
        if curl -f http://localhost:3001/health &>/dev/null; then
            backend_ready=true
            log "✅ Backend listo"
        else
            sleep 2
            attempts=$((attempts + 1))
        fi
    done
    
    if [ "$backend_ready" = false ]; then
        error "Backend no está respondiendo después de $max_attempts intentos"
    fi
    
    # Verificar otros servicios
    sleep 10
    
    log "📊 Estado de los servicios:"
    if [ "$ENVIRONMENT" = "production" ]; then
        docker compose -f "$COMPOSE_FILE" ps
    else
        docker compose ps
    fi
}

# Verificación post-despliegue
verify_deployment() {
    log "🔍 Verificando despliegue..."
    
    # Verificar health check del backend
    if curl -f http://localhost:3001/health &>/dev/null; then
        log "✅ Health check del backend OK"
    else
        error "❌ Health check del backend falló"
    fi
    
    # Verificar frontend (si está corriendo)
    if curl -f http://localhost/ &>/dev/null; then
        log "✅ Frontend accesible"
    else
        warn "⚠️  Frontend no accesible (puede ser normal si está detrás de proxy)"
    fi
    
    # Mostrar logs recientes
    log "📋 Logs recientes del backend:"
    if [ "$ENVIRONMENT" = "production" ]; then
        docker compose -f "$COMPOSE_FILE" logs --tail=20 app
    else
        docker compose logs --tail=20 app
    fi
}

# Mostrar información de acceso
show_access_info() {
    log "🌐 Información de acceso:"
    echo ""
    echo "Backend API: http://localhost:3001"
    echo "Health Check: http://localhost:3001/health"
    echo "Frontend: http://localhost (si nginx está activo)"
    echo ""
    echo "Comandos útiles:"
    echo "  Ver logs: docker compose logs -f"
    echo "  Reiniciar: docker compose restart"
    echo "  Detener: docker compose down"
    echo ""
    log "🎉 Despliegue completado exitosamente!"
}

# Despliegue rollback
rollback() {
    local backup_version=${1:-"latest"}
    
    warn "⚠️  Iniciando rollback del despliegue..."
    
    # Buscar backup más reciente si no se especifica versión
    if [ "$backup_version" = "latest" ]; then
        backup_version=$(ls -t ./backups/ | head -n 1)
    fi
    
    log "🔄 Restaurando desde backup: $backup_version"
    
    # Detener servicios actuales
    if [ "$ENVIRONMENT" = "production" ]; then
        docker compose -f "$COMPOSE_FILE" down
    else
        docker compose down
    fi
    
    # Restaurar datos críticos
    if [ -f "./scripts/restore.sh" ]; then
        chmod +x ./scripts/restore.sh
        ./scripts/restore.sh sessions "./backups/whatsapp-sessions-$backup_version.tar.gz"
        ./scripts/restore.sh data "./backups/app-data-$backup_version.tar.gz"
    fi
    
    # Reiniciar servicios
    deploy_application
    wait_for_services
    
    log "✅ Rollback completado"
}

# Mostrar ayuda
show_help() {
    echo "WhatsApp Bot Platform - Deploy Script"
    echo "==================================="
    echo ""
    echo "Uso: $0 [comando] [opciones]"
    echo ""
    echo "Comandos:"
    echo "  deploy [env]         Desplegar aplicación (env: development|production)"
    echo "  rollback [version]   Rollback a versión anterior"
    echo "  status               Mostrar estado de servicios"
    echo "  logs [service]       Mostrar logs de servicio"
    echo "  help                 Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 deploy development"
    echo "  $0 deploy production"
    echo "  $0 rollback 20240101_120000"
    echo "  $0 status"
}

# Función principal
main() {
    case ${1:-"deploy"} in
        "deploy")
            ENVIRONMENT=${2:-"development"}
            check_prerequisites
            setup_directories
            setup_secrets
            backup_before_deploy
            build_images
            deploy_application
            wait_for_services
            verify_deployment
            show_access_info
            ;;
        "rollback")
            rollback "$2"
            ;;
        "status")
            log "📊 Estado de servicios:"
            if [ "$ENVIRONMENT" = "production" ]; then
                docker compose -f docker-compose.production.yml ps
            else
                docker compose ps
            fi
            ;;
        "logs")
            local service=${2:-"app"}
            log "📋 Logs del servicio $service:"
            if [ "$ENVIRONMENT" = "production" ]; then
                docker compose -f docker-compose.production.yml logs -f "$service"
            else
                docker compose logs -f "$service"
            fi
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

main "$@"