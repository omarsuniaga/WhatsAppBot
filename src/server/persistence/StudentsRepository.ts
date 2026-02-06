/**
 * StudentsRepository - CRUD operations for Student entities
 * 
 * MIGRATION NOTE: Implements IStudentsRepository interface.
 * To migrate to Firestore, create a new class implementing the same interface.
 */

import { v4 as uuidv4 } from 'uuid';
import { FileStore, createStores, StudentsFileData } from './FileStore';
import type { Student, IStudentsRepository } from '../types/entities';

export class StudentsRepository implements IStudentsRepository {
    private store: FileStore<StudentsFileData>;
    private static instance: StudentsRepository | null = null;

    private constructor() {
        this.store = createStores.students();
    }

    static getInstance(): StudentsRepository {
        if (!StudentsRepository.instance) {
            StudentsRepository.instance = new StudentsRepository();
        }
        return StudentsRepository.instance;
    }

    async initialize(): Promise<void> {
        await this.store.ensureFileExists();
    }

    async findById(id: string): Promise<Student | null> {
        const data = await this.store.read();
        return data.students.find(s => s.id === id) || null;
    }

    async findAll(): Promise<Student[]> {
        const data = await this.store.read();
        return data.students;
    }

    async findByContactId(contactId: string): Promise<Student[]> {
        const data = await this.store.read();
        return data.students.filter(s => s.contactIds.includes(contactId));
    }

    async findByEnsemble(ensemble: string): Promise<Student[]> {
        const data = await this.store.read();
        return data.students.filter(s => s.ensembles.includes(ensemble));
    }

    async findActive(): Promise<Student[]> {
        const data = await this.store.read();
        return data.students.filter(s => s.status === 'active');
    }

    async findByStatus(status: Student['status']): Promise<Student[]> {
        const data = await this.store.read();
        return data.students.filter(s => s.status === status);
    }

    async findByInstrument(instrument: string): Promise<Student[]> {
        const data = await this.store.read();
        return data.students.filter(s => 
            s.instruments.some(i => i.name.toLowerCase() === instrument.toLowerCase())
        );
    }

    async create(input: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Promise<Student> {
        const now = new Date().toISOString();
        const student: Student = {
            ...input,
            id: uuidv4(),
            createdAt: now,
            updatedAt: now
        };

        await this.store.update(data => ({
            ...data,
            lastUpdated: now,
            students: [...data.students, student]
        }));

        return student;
    }

    async update(id: string, updates: Partial<Student>): Promise<Student | null> {
        const now = new Date().toISOString();
        let updated: Student | null = null;

        await this.store.update(data => {
            const index = data.students.findIndex(s => s.id === id);
            if (index === -1) return data;

            updated = {
                ...data.students[index],
                ...updates,
                id,
                createdAt: data.students[index].createdAt,
                updatedAt: now
            };

            const newStudents = [...data.students];
            newStudents[index] = updated;

            return {
                ...data,
                lastUpdated: now,
                students: newStudents
            };
        });

        return updated;
    }

    async delete(id: string): Promise<boolean> {
        let deleted = false;

        await this.store.update(data => {
            const index = data.students.findIndex(s => s.id === id);
            if (index === -1) return data;

            deleted = true;
            return {
                ...data,
                lastUpdated: new Date().toISOString(),
                students: data.students.filter(s => s.id !== id)
            };
        });

        return deleted;
    }

    async addContact(studentId: string, contactId: string): Promise<Student | null> {
        const student = await this.findById(studentId);
        if (!student) return null;

        if (student.contactIds.includes(contactId)) {
            return student;
        }

        return this.update(studentId, {
            contactIds: [...student.contactIds, contactId]
        });
    }

    async removeContact(studentId: string, contactId: string): Promise<Student | null> {
        const student = await this.findById(studentId);
        if (!student) return null;

        return this.update(studentId, {
            contactIds: student.contactIds.filter(id => id !== contactId)
        });
    }

    async addToEnsemble(studentId: string, ensemble: string): Promise<Student | null> {
        const student = await this.findById(studentId);
        if (!student) return null;

        if (student.ensembles.includes(ensemble)) {
            return student;
        }

        return this.update(studentId, {
            ensembles: [...student.ensembles, ensemble]
        });
    }

    async removeFromEnsemble(studentId: string, ensemble: string): Promise<Student | null> {
        const student = await this.findById(studentId);
        if (!student) return null;

        return this.update(studentId, {
            ensembles: student.ensembles.filter(e => e !== ensemble)
        });
    }

    async search(query: string): Promise<Student[]> {
        const data = await this.store.read();
        const lowerQuery = query.toLowerCase();

        return data.students.filter(s =>
            s.firstName.toLowerCase().includes(lowerQuery) ||
            s.lastName.toLowerCase().includes(lowerQuery) ||
            s.instruments.some(i => i.name.toLowerCase().includes(lowerQuery)) ||
            s.ensembles.some(e => e.toLowerCase().includes(lowerQuery))
        );
    }

    async count(): Promise<number> {
        const data = await this.store.read();
        return data.students.length;
    }

    async getEnsembles(): Promise<string[]> {
        const data = await this.store.read();
        const ensembles = new Set<string>();
        data.students.forEach(s => s.ensembles.forEach(e => ensembles.add(e)));
        return Array.from(ensembles).sort();
    }

    async getInstruments(): Promise<string[]> {
        const data = await this.store.read();
        const instruments = new Set<string>();
        data.students.forEach(s => s.instruments.forEach(i => instruments.add(i.name)));
        return Array.from(instruments).sort();
    }
}

export default StudentsRepository;
