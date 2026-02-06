// Configuración de Firebase para producción
// IMPORTANTE: Reemplaza estos valores con los de tu proyecto real

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "your-api-key-here",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "orquestapuntacana.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "orquestapuntacana",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "orquestapuntacana.appspot.com",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef123456"
};

// Validación de configuración
export const validateFirebaseConfig = () => {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missingKeys = requiredKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);
  
  if (missingKeys.length > 0) {
    console.warn('⚠️ Firebase config keys missing:', missingKeys);
    return false;
  }
  
  if (firebaseConfig.apiKey === 'your-api-key-here') {
    console.warn('⚠️ Using placeholder Firebase API key. Please update with real values.');
    return false;
  }
  
  return true;
};
