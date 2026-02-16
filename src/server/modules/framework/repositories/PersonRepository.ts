/**
 * PersonRepository - Repositorio para gestionar Personas
 */

import { BaseRepository } from './BaseRepository';
import { Person, PersonRole } from '../entities/Person';

export class PersonRepository extends BaseRepository<Person> {
  /**
   * Encuentra personas por rol específico
   */
  async findByRole(role: PersonRole): Promise<Person[]> {
    return this.findByCondition((person) => person.roles.includes(role));
  }

  /**
   * Encuentra personas por teléfono
   */
  async findByPhone(phone: string): Promise<Person | null> {
    const people = await this.findByCondition(
      (person) => person.contacts?.some(c => c.value === phone) || false
    );
    return people.length > 0 ? people[0] : null;
  }

  /**
   * Encuentra personas por email
   */
  async findByEmail(email: string): Promise<Person | null> {
    const people = await this.findByCondition(
      (person) => person.contacts?.some(c => c.value === email) || false
    );
    return people.length > 0 ? people[0] : null;
  }

  /**
   * Encuentra maestros activos
   */
  async findActiveTeachers(): Promise<Person[]> {
    return this.findByCondition(
      (person) =>
        person.roles.includes(PersonRole.TEACHER) && person.isActive === true
    );
  }

  /**
   * Encuentra estudiantes activos
   */
  async findActiveStudents(): Promise<Person[]> {
    return this.findByCondition(
      (person) =>
        person.roles.includes(PersonRole.STUDENT) && person.isActive === true
    );
  }

  /**
   * Busca personas por criterios múltiples
   */
  async search(query: {
    firstName?: string;
    lastName?: string;
    role?: PersonRole;
    isActive?: boolean;
  }): Promise<Person[]> {
    return this.findByCondition((person) => {
      if (query.firstName && !person.firstName.toLowerCase().includes(query.firstName.toLowerCase())) return false;
      if (query.lastName && !person.lastName.toLowerCase().includes(query.lastName.toLowerCase())) return false;
      if (query.role && !person.roles.includes(query.role)) return false;
      if (query.isActive !== undefined && person.isActive !== query.isActive) return false;
      return true;
    });
  }

  /**
   * Obtiene estadísticas de personas
   */
  async getStatistics(): Promise<{
    total: number;
    byRole: Record<PersonRole, number>;
    active: number;
    inactive: number;
  }> {
    const all = await this.findAll();
    const byRole: Record<PersonRole, number> = {
      [PersonRole.DIRECTOR]: 0,
      [PersonRole.TEACHER]: 0,
      [PersonRole.STUDENT]: 0,
      [PersonRole.PARENT]: 0,
      [PersonRole.STAFF]: 0,
    };

    for (const person of all) {
      for (const role of person.roles) {
        byRole[role]++;
      }
    }

    return {
      total: all.length,
      byRole,
      active: all.filter((p) => p.isActive).length,
      inactive: all.filter((p) => !p.isActive).length,
    };
  }
}

export const personRepository = new PersonRepository();
