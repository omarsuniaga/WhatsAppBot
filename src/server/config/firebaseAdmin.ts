/**
 * Firebase Admin SDK Initialization
 * Para acceso backend a Firestore
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

let db: admin.firestore.Firestore;
let isInitialized = false;

/**
 * Initialize Firebase Admin SDK
 */
export const initializeFirebaseAdmin = (): admin.firestore.Firestore => {
  if (isInitialized) {
    return db;
  }

  try {
    // Opción 1: Service Account JSON file
    const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
    
    if (serviceAccountPath) {
      const absolutePath = path.resolve(process.cwd(), serviceAccountPath);
      console.log('Firebase Service Account Path:', absolutePath);
      try {
        const serviceAccount = require(absolutePath);
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        
        console.log('✅ Firebase Admin initialized with Service Account file');
      } catch (err) {
        console.error('❌ Failed to load service account file:', err);
        console.warn('⚠️ Server will start in LIMITED MODE (No Firebase features)');
      }
    } 
    // Opción 2: Environment variables individuales
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        }),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      
      console.log('✅ Firebase Admin initialized with environment variables');
    }
    // Opción 3: Default credentials (Cloud Functions, Cloud Run, etc.)
    else if (process.env.FIREBASE_CONFIG || process.env.GCLOUD_PROJECT) {
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized with default credentials');
    }
    // Fallback: Try with explicit project ID from .env
    else if (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) {
      console.warn('⚠️ Using client SDK project ID. This may not work for Admin SDK operations.');
      console.warn('⚠️ Please configure Firebase Admin SDK credentials properly.');
      console.warn('⚠️ See FIREBASE_ADMIN_SETUP.md for instructions.');
      
      // Try to initialize anyway for development
      admin.initializeApp({
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
      });
    }
    else {
      throw new Error(
        'Firebase Admin SDK credentials not found. ' +
        'Please set FIREBASE_ADMIN_SERVICE_ACCOUNT or individual credentials in .env file. ' +
        'See FIREBASE_ADMIN_SETUP.md for instructions.'
      );
    }

    db = admin.firestore();
    isInitialized = true;
    
    console.log(`🔥 Connected to Firestore: ${admin.app().options.projectId}`);
    
    return db;
  } catch (error: any) {
    console.error('❌ Error initializing Firebase Admin SDK:', error.message);
    throw error;
  }
};

// Export initialized db or a proxy that throws descriptive errors
let dbProxy: any = null;

export const getFirestore = (): admin.firestore.Firestore => {
  if (!isInitialized) {
    try {
      return initializeFirebaseAdmin();
    } catch (error) {
      // Return a proxy that throws on access
      return new Proxy({} as any, {
        get(_, prop) {
          throw new Error(`🔥 Firebase Admin not initialized. Cannot access '${String(prop)}'. Please configure Service Account Key.`);
        }
      });
    }
  }
  return db;
};

export const getAdmin = (): typeof admin => {
  if (!isInitialized) {
    try {
      initializeFirebaseAdmin();
    } catch (error) {
      // Fallback
    }
  }
  return admin;
};

// Lazy export for db
export { dbProxy as db };

// Auto-initialize on import (solo si no estamos en test environment)
if (process.env.NODE_ENV !== 'test') {
  try {
    const initializedDb = initializeFirebaseAdmin();
    dbProxy = initializedDb;
  } catch (error: any) {
    console.error('⚠️  Failed to auto-initialize Firebase Admin:', error.message);
    console.error('⚠️  API endpoints will not work until Firebase Admin is configured.');
    console.error('⚠️  See SERVICE_ACCOUNT_NEEDED.md for instructions.');
    
    // Create a proxy that throws a helpful error instead of just being undefined
    dbProxy = new Proxy({} as any, {
      get(_, prop) {
          return (...args: any[]) => {
              throw new Error(`🔥 Firebase Admin not initialized. Cannot access db.${String(prop)}. Please configure Service Account Key as described in SERVICE_ACCOUNT_NEEDED.md`);
          };
      }
    });
  }
}
