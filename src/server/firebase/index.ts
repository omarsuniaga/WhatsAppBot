
// Re-export from the robust firebase admin config
// This prevents duplicate initialization
export { db, getFirestore, getAdmin } from '../config/firebaseAdmin';
export { default as admin } from 'firebase-admin';
