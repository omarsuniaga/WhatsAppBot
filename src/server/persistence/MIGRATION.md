# Firestore Migration Guide

This document describes how to migrate from the file-based persistence layer to Firestore.

## Architecture Overview

The current persistence layer follows the Repository Pattern with these components:

```
FileStore<T>          → Generic JSON file storage (atomic writes, caching)
    ↓
*Repository           → CRUD operations for each entity
    ↓
*Service              → Business logic (IdentityService, TemplateService)
    ↓
Controller/Routes     → Express API endpoints
```

## Migration Steps

### 1. Install Firestore Dependencies

```bash
npm install firebase-admin
```

### 2. Initialize Firebase Admin SDK

Create `src/server/firebase/index.ts`:

```typescript
import * as admin from 'firebase-admin';

const serviceAccount = require('../../../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://your-project.firebaseio.com'
});

export const db = admin.firestore();
export default admin;
```

### 3. Create Firestore Repository Implementations

For each repository, create a Firestore version that implements the same interface.

Example for `ContactsRepository`:

```typescript
// src/server/persistence/firestore/ContactsRepository.ts

import { db } from '../../firebase';
import type { Contact, IContactsRepository } from '../../types/entities';

export class FirestoreContactsRepository implements IContactsRepository {
    private collection = db.collection('contacts');

    async findById(id: string): Promise<Contact | null> {
        const doc = await this.collection.doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as Contact;
    }

    async findAll(): Promise<Contact[]> {
        const snapshot = await this.collection.get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Contact[];
    }

    async findByPhone(phone: string): Promise<Contact | null> {
        const snapshot = await this.collection
            .where('phones', 'array-contains', phone)
            .limit(1)
            .get();
        
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Contact;
    }

    async findByJid(jid: string): Promise<Contact | null> {
        const snapshot = await this.collection
            .where('whatsappJid', '==', jid)
            .limit(1)
            .get();
        
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Contact;
    }

    async findByStudentId(studentId: string): Promise<Contact[]> {
        const snapshot = await this.collection
            .where('studentIds', 'array-contains', studentId)
            .get();
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Contact[];
    }

    async create(input: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
        const now = new Date().toISOString();
        const data = {
            ...input,
            createdAt: now,
            updatedAt: now
        };
        
        const docRef = await this.collection.add(data);
        return { id: docRef.id, ...data } as Contact;
    }

    async update(id: string, updates: Partial<Contact>): Promise<Contact | null> {
        const docRef = this.collection.doc(id);
        const doc = await docRef.get();
        
        if (!doc.exists) return null;
        
        const updatedData = {
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        await docRef.update(updatedData);
        
        const updated = await docRef.get();
        return { id: updated.id, ...updated.data() } as Contact;
    }

    async delete(id: string): Promise<boolean> {
        const docRef = this.collection.doc(id);
        const doc = await docRef.get();
        
        if (!doc.exists) return false;
        
        await docRef.delete();
        return true;
    }
}
```

### 4. Update Repository Factory

Modify `src/server/persistence/index.ts` to use environment-based switching:

```typescript
const USE_FIRESTORE = process.env.USE_FIRESTORE === 'true';

export function getContactsRepository(): IContactsRepository {
    if (USE_FIRESTORE) {
        return FirestoreContactsRepository.getInstance();
    }
    return ContactsRepository.getInstance();
}

// Similar for other repositories
```

### 5. Firestore Collection Structure

```
/contacts/{contactId}
    - firstName: string
    - lastName: string
    - phones: string[]
    - email?: string
    - type: 'parent' | 'guardian' | 'external' | 'staff' | 'other'
    - status: 'active' | 'inactive' | 'blocked'
    - studentIds: string[]
    - whatsappJid?: string
    - whatsappVerified: boolean
    - notificationPreferences: { ... }
    - createdAt: Timestamp
    - updatedAt: Timestamp

/students/{studentId}
    - firstName: string
    - lastName: string
    - dateOfBirth?: string
    - enrollmentDate: string
    - status: 'active' | 'inactive' | 'graduated' | 'suspended'
    - instruments: [{ name, level, startDate, isPrimary }]
    - ensembles: string[]
    - contactIds: string[]
    - currentClasses: string[]
    - createdAt: Timestamp
    - updatedAt: Timestamp

/templates/{templateId}
    - name: string
    - slug: string
    - body: string
    - category: string
    - variables: [{ name, required, description? }]
    - isActive: boolean
    - usageCount: number
    - lastUsedAt?: Timestamp
    - createdAt: Timestamp
    - updatedAt: Timestamp

/attendance/{date}
    - date: string (YYYY-MM-DD)
    - classId?: string
    - ensembleId?: string
    - records: [{ studentId, status, arrivalTime?, notes?, recordedBy, recordedAt }]
    - createdAt: Timestamp
    - updatedAt: Timestamp

/phoneIndex/{normalizedPhone}
    - phone: string
    - contactId: string
    - linkedAt: Timestamp
    - source: 'manual' | 'whatsapp' | 'import'
```

### 6. Data Migration Script

Create a script to migrate existing JSON data to Firestore:

```typescript
// scripts/migrate-to-firestore.ts

import * as fs from 'fs';
import * as path from 'path';
import { db } from '../src/server/firebase';

async function migrateCollection(filename: string, collectionName: string) {
    const filePath = path.join(__dirname, '../data', filename);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    const batch = db.batch();
    let count = 0;
    
    for (const item of data.items || data.contacts || data.students || data.templates || []) {
        const docRef = db.collection(collectionName).doc(item.id);
        batch.set(docRef, item);
        count++;
        
        // Firestore batch limit is 500
        if (count % 450 === 0) {
            await batch.commit();
        }
    }
    
    await batch.commit();
    console.log(`Migrated ${count} documents to ${collectionName}`);
}

async function main() {
    await migrateCollection('contacts-v2.json', 'contacts');
    await migrateCollection('students.json', 'students');
    await migrateCollection('templates.json', 'templates');
    await migrateCollection('attendance.json', 'attendance');
    
    console.log('Migration complete!');
}

main().catch(console.error);
```

### 7. Index Requirements

Create the following composite indexes in Firestore:

```
Collection: contacts
- phones (Array) + status (Ascending)
- type (Ascending) + status (Ascending)

Collection: students
- status (Ascending) + ensembles (Array)
- contactIds (Array) + status (Ascending)

Collection: attendance
- date (Ascending) + classId (Ascending)
```

### 8. Environment Variables

Add to `.env`:

```bash
USE_FIRESTORE=true
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
```

## Testing the Migration

1. Run the app with `USE_FIRESTORE=false` (file-based)
2. Create test data via the API
3. Run the migration script
4. Switch to `USE_FIRESTORE=true`
5. Verify all data is accessible

## Rollback Plan

To rollback to file-based storage:
1. Set `USE_FIRESTORE=false` in `.env`
2. Restart the server
3. The app will use local JSON files again

## Performance Considerations

- File-based: Better for development, small datasets, offline use
- Firestore: Better for production, large datasets, multi-instance deployments

## Known Differences

1. **Timestamps**: Firestore uses native Timestamps; file-based uses ISO strings
2. **Queries**: Firestore requires indexes for complex queries
3. **Transactions**: Firestore has native transaction support
4. **Real-time**: Firestore supports real-time listeners (not used in current implementation)
