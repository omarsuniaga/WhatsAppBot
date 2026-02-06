#!/bin/bash

# ==========================================
# Bot WhatsApp - VPS Setup Script (Ubuntu)
# ==========================================

# 1. Update System
echo "🔄 Actualizando sistema..."
sudo apt-get update
sudo apt-get upgrade -y

# 2. Install Docker
echo "🐳 Instalando Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker instalado."
else
    echo "✅ Docker ya estaba instalado."
fi

# 3. Install Docker Compose
echo "📦 Instalando Docker Compose..."
sudo apt-get install -y docker-compose

# 4. Create Project Directory
echo "fyp Creando directorio del proyecto..."
mkdir -p ~/bot-wa
cd ~/bot-wa

# 5. Helper function to create .env if not exists
if [ ! -f .env ]; then
    echo "📝 Creando archivo .env base..."
    cat > .env << EOL
NODE_ENV=production
PORT=3001
# PEGA AQUÍ TUS CLAVES REALES
GEMINI_API_KEY=
FIREBASE_PROJECT_ID=orquestapuntacana
EOL
    echo "⚠️  IMPORTANTE: Edita el archivo .env con 'nano .env' para poner tus claves."
fi

echo "=========================================="
echo "✅ ¡Servidor preparado!"
echo "=========================================="
echo "Siguientes pasos:"
echo "1. Sube tus archivos al directorio ~/bot-wa (o usa git clone)"
echo "2. Sube tu archivo JSON de Firebase"
echo "3. Ejecuta: docker-compose up -d --build"
echo "=========================================="
