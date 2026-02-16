# 🔑 Guía Rápida: Obtener Service Account Key

## Pasos (2 minutos):

### 1. Abre Firebase Console
👉 https://console.firebase.google.com/project/orquestapuntacana/settings/serviceaccounts/adminsdk

### 2. En la página de Service Accounts:
- Verás tu proyecto: **orquestapuntacana**
- Haz click en la pestaña **"Service accounts"** (si no estás ahí)
- Busca el botón **"Generate new private key"** (Generar nueva clave privada)

### 3. Download el archivo JSON:
- Click en **"Generate key"**
- Se descargará un archivo como: `orquestapuntacana-firebase-adminsdk-xxxxx.json`
- Guarda este archivo en la **raíz de tu proyecto** (mismo nivel que `package.json`)

### 4. Renombra el archivo (opcional):
Puedes renombrarlo a algo más simple:
```
orquestapuntacana-firebase-adminsdk.json
```

### 5. Actualiza tu `.env`:
Agrega esta línea al final de tu archivo `.env`:

```env
# Firebase Admin SDK (Backend)
FIREBASE_ADMIN_SERVICE_ACCOUNT=./orquestapuntacana-firebase-adminsdk.json
```

## ✅ Verificación

Después de configurar, **reinicia el servidor** (Ctrl+C y `npm run dev`).

Deberías ver en los logs:
```
✅ Firebase Admin initialized with Service Account file
🔥 Connected to Firestore: orquestapuntacana
```

## 🔒 Seguridad

El archivo `.gitignore` ya está actualizado para NO commitear este archivo sensible.

---

**¿Listo para descargar el Service Account?**
