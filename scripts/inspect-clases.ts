/**
 * Diagnostic script to inspect CLASES collection structure
 * Run with: npx ts-node scripts/inspect-clases.ts
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Initialize Firebase Admin
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else {
    admin.initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

async function inspectClases() {
    console.log('=== CLASES Collection Inspection ===\n');
    
    try {
        const snapshot = await db.collection('CLASES').limit(5).get();
        
        if (snapshot.empty) {
            console.log('No documents found in CLASES collection');
            return;
        }

        console.log(`Found ${snapshot.size} documents (showing first 5):\n`);

        snapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            console.log(`--- Document ${index + 1}: ${doc.id} ---`);
            console.log('All fields:');
            Object.keys(data).sort().forEach(key => {
                const value = data[key];
                const displayValue = typeof value === 'object' 
                    ? JSON.stringify(value).substring(0, 100) 
                    : value;
                console.log(`  ${key}: ${displayValue}`);
            });
            console.log('');
            
            // Highlight teacher-related fields
            console.log('Teacher-related fields:');
            const teacherFields = ['teacherId', 'profesor_id', 'profesor_nombre', 
                                   'profesor_ids', 'profesor_nombres', 'teacher', 'maestro'];
            teacherFields.forEach(field => {
                if (data[field] !== undefined) {
                    console.log(`  ✓ ${field}: ${JSON.stringify(data[field])}`);
                }
            });
            console.log('\n');
        });

        // Also check MAESTROS to see the IDs
        console.log('=== MAESTROS Collection IDs ===\n');
        const maestrosSnapshot = await db.collection('MAESTROS').limit(10).get();
        maestrosSnapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`ID: ${doc.id} -> Name: ${data.name || data.nombre}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

inspectClases();
