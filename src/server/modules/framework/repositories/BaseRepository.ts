/**
 * BaseRepository - Clase abstracta para CRUD genérico en memoria
 * Actúa como base para todos los repositorios del framework
 */

export abstract class BaseRepository<T extends { id: string }> {
  protected storage: Map<string, T> = new Map();

  /**
   * Obtiene un elemento por ID
   */
  async findById(id: string): Promise<T | null> {
    return this.storage.get(id) || null;
  }

  /**
   * Obtiene todos los elementos
   */
  async findAll(): Promise<T[]> {
    return Array.from(this.storage.values());
  }

  /**
   * Guarda un elemento (crear o actualizar)
   */
  async save(entity: T): Promise<T> {
    this.storage.set(entity.id, entity);
    return entity;
  }

  /**
   * Guarda múltiples elementos
   */
  async saveMany(entities: T[]): Promise<T[]> {
    for (const entity of entities) {
      this.storage.set(entity.id, entity);
    }
    return entities;
  }

  /**
   * Elimina un elemento por ID
   */
  async delete(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }

  /**
   * Elimina múltiples elementos por ID
   */
  async deleteMany(ids: string[]): Promise<number> {
    let count = 0;
    for (const id of ids) {
      if (this.storage.delete(id)) count++;
    }
    return count;
  }

  /**
   * Cuenta el total de elementos
   */
  async count(): Promise<number> {
    return this.storage.size;
  }

  /**
   * Obtiene elementos que cumplen una condición
   */
  async findByCondition(predicate: (entity: T) => boolean): Promise<T[]> {
    return Array.from(this.storage.values()).filter(predicate);
  }

  /**
   * Limpia todo el repositorio (para testing)
   */
  async clear(): Promise<void> {
    this.storage.clear();
  }

  /**
   * Estado actual del repositorio (para debug)
   */
  getStorageState(): T[] {
    return Array.from(this.storage.values());
  }
}
