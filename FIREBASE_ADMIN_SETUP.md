# 🔥 Firebase Admin SDK - Guía de Configuración Rápida

## 📋 Situación Actual

Tu archivo `.env` tiene las credenciales de **Firebase Client SDK** (para web/React), pero el sistema administrativo necesita **Firebase Admin SDK** para el backend.

---

## 🚀 Configuración en 3 Pasos

### Paso 1: Obtener Service Account Key

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **orquestapuntacana**
3. Ve a **Project Settings** (⚙️) → **Service Accounts**
4. Click en **"Generate New Private Key"**
5. Descarga el archivo JSON (ej: `orquestapuntacana-firebase-adminsdk.json`)
6. **IMPORTANTE**: Guarda este archivo en la raíz del proyecto

### Paso 2: Configurar Variables de Entorno

Agrega estas líneas a tu archivo `.env`:

```env
# Firebase Admin SDK (Backend)
FIREBASE_ADMIN_SERVICE_ACCOUNT=./orquestapuntacana-firebase-adminsdk.json
# O usa variables individuales:
# FIREBASE_PROJECT_ID=orquestapuntacana
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@orquestapuntacana.iam.gserviceaccount.com
```

### Paso 3: Instalar Dependencia

```bash
npm install firebase-admin
```

---

## 🔧 Configuración Automática

He creado un archivo de inicialización que detectará automáticamente tus credenciales. 

**Opción A: Usando Service Account JSON File** (Recomendado)
- Coloca el archivo JSON en la raíz
- Agrega `FIREBASE_ADMIN_SERVICE_ACCOUNT=./tu-archivo.json` al `.env`

**Opción B: Usando Variables de Entorno Individuales**
- Extrae `project_id`, `private_key`, y `client_email` del JSON
- Agrégalos al `.env` como se muestra arriba

---

## ✅ Verificación

Una vez configurado, el servidor detectará automáticamente las credenciales al iniciar.

En los logs deberías ver:
```
✅ Firebase Admin initialized successfully
🔥 Connected to Firestore: orquestapuntacana
```

---

## 🔒 Seguridad

**NUNCA** commitees el archivo Service Account a Git:

```bash
# Agrega a .gitignore
echo "orquestapuntacana-firebase-adminsdk.json" >> .gitignore
echo "*-firebase-adminsdk*.json" >> .gitignore
```

---

## 🐛 Troubleshooting

**Error: "Could not load the default credentials"**
→ No se encontró el Service Account. Verifica las variables de entorno.

**Error: "Permission denied"**
→ El Service Account no tiene permisos. Ve a Firebase Console → IAM y asegúrate de que tenga rol "Firebase Admin SDK Administrator Service Agent".

---

**¿Necesitas que te ayude a configurar esto ahora?**
