/**
 * Script to inspect the ALUMNOS collection structure in Firestore
 * Run with: npx ts-node scripts/inspect-alumnos.ts
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
if (!serviceAccountPath) {
  console.error('❌ FIREBASE_ADMIN_SERVICE_ACCOUNT not set in .env');
  process.exit(1);
}

const absolutePath = path.resolve(process.cwd(), serviceAccountPath);
const serviceAccount = require(absolutePath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function inspectCollection() {
  console.log('🔍 Inspecting ALUMNOS collection...\n');
  
  try {
    const snapshot = await db.collection('ALUMNOS').limit(5).get();
    
    if (snapshot.empty) {
      console.log('❌ No documents found in ALUMNOS collection');
      return;
    }
    
    console.log(`📊 Found ${snapshot.size} sample documents:\n`);
    
    // Collect all unique fields across documents
    const allFields = new Set<string>();
    const fieldTypes: Record<string, string> = {};
    const sampleValues: Record<string, any> = {};
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n📄 Document ${index + 1} (ID: ${doc.id}):`);
      console.log(JSON.stringify(data, null, 2));
      
      // Collect fields
      Object.keys(data).forEach(key => {
        allFields.add(key);
        const value = data[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        fieldTypes[key] = type;
        if (!sampleValues[key]) {
          sampleValues[key] = value;
        }
      });
    });
    
    console.log('\n\n📋 SCHEMA SUMMARY:');
    console.log('==================');
    
    allFields.forEach(field => {
      const type = fieldTypes[field];
      const sample = JSON.stringify(sampleValues[field]);
      console.log(`  ${field}: ${type}`);
      if (type === 'object' && sampleValues[field]) {
        console.log(`    └─ Keys: ${Object.keys(sampleValues[field]).join(', ')}`);
      }
    });
    
    console.log('\n\n🔧 TypeScript Interface Suggestion:');
    console.log('=====================================');
    console.log('export interface AlumnoFirestore {');
    allFields.forEach(field => {
      const type = fieldTypes[field];
      let tsType = type;
      if (type === 'object' && sampleValues[field]) {
        const subKeys = Object.keys(sampleValues[field]);
        tsType = `{ ${subKeys.map(k => `${k}?: any`).join('; ')} }`;
      } else if (type === 'array') {
        tsType = 'any[]';
      } else if (type === 'string') {
        tsType = 'string';
      } else if (type === 'number') {
        tsType = 'number';
      } else if (type === 'boolean') {
        tsType = 'boolean';
      }
      console.log(`  ${field}?: ${tsType};`);
    });
    console.log('}');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

inspectCollection();
