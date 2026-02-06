# ⚠️ Archivo Incorrecto Detectado

## Problema

El archivo `google-services.json` que tienes es para **Android/Client SDK**, NO para el backend.

Para Firebase Admin SDK necesitas un archivo diferente llamado **Service Account Key**.

---

## ✅ Cómo Descargar el Archivo Correcto

### Paso 1: Abre Firebase Console
👉 https://console.firebase.google.com/project/orquestapuntacana/settings/serviceaccounts/adminsdk

### Paso 2: Selecciona la Pestaña Correcta
Asegúrate de estar en la pestaña **"Service accounts"** (no en "General")

### Paso 3: Genera la Clave
1. Verás un botón que dice **"Generate new private key"** (Generar nueva clave privada)
2. Haz click en ese botón
3. Te aparecerá una advertencia, haz click en **"Generate key"**

### Paso 4: Descarga el Archivo
Se descargará un archivo JSON con un nombre como:
```
orquestapuntacana-firebase-adminsdk-xxxxx-xxxxxxxxxx.json
```

**Este archivo tendrá un formato diferente al que tienes ahora:**
- Contendrá campos como: `private_key`, `client_email`, `type: "service_account"`
- Es mucho más grande que el `google-services.json`

### Paso 5: Guarda el Archivo
Guarda el archivo en la **raíz del proyecto**. Puedes renombrarlo a algo simple como:
```
orquestapuntacana-service-account.json
```

### Paso 6: Actualiza el `.env`
Ya actualicé tu `.env`, pero asegúrate de que el nombre coincida:
```env
FIREBASE_ADMIN_SERVICE_ACCOUNT=./orquestapuntacana-service-account.json
```

### Paso 7: Ejecuta el Script de Nuevo
```bash
npm run create-test-user
```

---

## 📋 Comparación de Archivos

### ❌ `google-services.json` (Lo que tienes ahora)
```json
{
  "project_info": {
    "project_number": "...",
    "project_id": "orquestapuntacana"
  },
  "client": [...],
  "configuration_version": "1"
}
```
**Uso**: Apps de Android/iOS (Client SDK)

### ✅ Service Account Key (Lo que necesitas)
```json
{
  "type": "service_account",
  "project_id": "orquestapuntacana",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "firebase-adminsdk-xxxxx@orquestapuntacana.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```
**Uso**: Backend server (Admin SDK) ✅

---

## 🔒 Seguridad

**MUY IMPORTANTE**: El Service Account Key tiene permisos de administrador completo. 

- ✅ Ya agregué `*-firebase-adminsdk*.json` al `.gitignore`
- ✅ NUNCA lo subas a Git
- ✅ NUNCA lo compartas públicamente

---

**¿Necesitas ayuda para descargarlo?** Te puedo guiar paso a paso.
