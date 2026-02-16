/**
 * Entity: Person - Usuario del sistema
 * Soporta múltiples roles: Alumno, Representante, Docente, Monitor, Aliado
 */

export enum PersonRole {
  DIRECTOR = 'director',
  TEACHER = 'teacher',
  STUDENT = 'student',
  PARENT = 'parent',
  STAFF = 'staff'
}

export enum PersonDataSource {
  MANUAL = 'manual',
  IMPORTED = 'imported',
  AUTOMATIC = 'automatic'
}

export interface Contact {
  id: string;
  type: 'email' | 'phone' | 'whatsapp' | 'address';
  value: string;
  isDefault: boolean;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dni?: string;
  roles: PersonRole[];
  isActive: boolean;
  contact?: Contact;
  contacts?: Contact[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
  source: PersonDataSource;
}

export class PersonFactory {
  static create(data: Partial<Person>, createdBy: string): Person {
    return {
      id: `PERS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email,
      phone: data.phone,
      dni: data.dni,
      roles: data.roles || [PersonRole.STUDENT],
      isActive: data.isActive !== false,
      contacts: data.contacts || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      source: data.source || PersonDataSource.MANUAL
    };
  }

  static getFullName(person: Person): string {
    return `${person.firstName} ${person.lastName}`;
  }

  static hasRole(person: Person, role: PersonRole): boolean {
    return person.roles.includes(role);
  }

  static addRole(person: Person, role: PersonRole): void {
    if (!person.roles.includes(role)) {
      person.roles.push(role);
    }
  }
}
