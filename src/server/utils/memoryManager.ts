/**
 * MemoryManager - Gestión de memoria y limpieza automática
 */

export interface MemoryStats {
    serviceName: string;
    itemCount: number;
    memoryUsageMB: number;
    oldestItem?: Date;
    cleanupNeeded: boolean;
}

export class MemoryManager {
    private static instance: MemoryManager;
    private cleanupIntervals = new Map<string, NodeJS.Timeout>();
    private statsCallbacks = new Set<(stats: MemoryStats[]) => void>();

    private constructor() {
        // Cleanup general cada 5 minutos
        setInterval(() => this.performGlobalCleanup(), 5 * 60 * 1000);
    }

    static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
        }
        return MemoryManager.instance;
    }

    /**
     * Registra un servicio para limpieza automática
     */
    registerService<T extends { size: number; getOldestItem?(): Date }>(
        serviceName: string,
        service: T,
        cleanupFn: (service: T) => void,
        intervalMs: number = 60 * 1000 // 1 minuto por defecto
    ): void {
        // Limpiar intervalo existente si lo hay
        const existing = this.cleanupIntervals.get(serviceName);
        if (existing) {
            clearInterval(existing);
        }

        // Crear nuevo intervalo de limpieza
        const interval = setInterval(() => {
            try {
                const stats = this.getServiceStats(serviceName, service);
                
                if (stats.cleanupNeeded) {
                    console.log(`[MemoryManager] Cleaning up ${serviceName} (${stats.itemCount} items, ${stats.memoryUsageMB}MB)`);
                    cleanupFn(service);
                    
                    // Emitir estadísticas después de limpieza
                    this.emitStats();
                }
            } catch (error) {
                console.error(`[MemoryManager] Error cleaning up ${serviceName}:`, error);
            }
        }, intervalMs);

        this.cleanupIntervals.set(serviceName, interval);
        console.log(`[MemoryManager] Registered service: ${serviceName} (cleanup every ${intervalMs}ms)`);
    }

    /**
     * Obtiene estadísticas de un servicio
     */
    private getServiceStats<T extends { size: number; getOldestItem?(): Date }>(
        serviceName: string,
        service: T
    ): MemoryStats {
        const itemCount = service.size;
        const memoryUsageMB = this.estimateMemoryUsage(service);
        const oldestItem = service.getOldestItem?.();
        
        // Determinar si se necesita limpieza
        const maxItems = this.getMaxItemsForService(serviceName);
        const maxAgeMs = this.getMaxAgeForService(serviceName);
        const cleanupNeeded = itemCount > maxItems || 
            (oldestItem !== undefined && Date.now() - oldestItem.getTime() > maxAgeMs);

        return {
            serviceName,
            itemCount,
            memoryUsageMB,
            oldestItem,
            cleanupNeeded
        };
    }

    /**
     * Estima uso de memoria de diferentes tipos de servicio
     */
    private estimateMemoryUsage(service: any): number {
        if (service instanceof Map) {
            // Estimar uso por item en Map
            const avgItemSizeBytes = 200; // Estimación conservadora
            return (service.size * avgItemSizeBytes) / (1024 * 1024);
        }
        
        if (Array.isArray(service)) {
            const avgItemSizeBytes = 150;
            return (service.length * avgItemSizeBytes) / (1024 * 1024);
        }
        
        return 0;
    }

    /**
     * Obtiene límite máximo de items por servicio
     */
    private getMaxItemsForService(serviceName: string): number {
        const limits: Record<string, number> = {
            'sentMessages': 1000, // BotService
            'conversationHistory': 500, // BotOrchestrator por chat
            'pendingAlerts': 10000, // PendingAlertService
            'lastMessageTime': 1000, // BotService
            'processingMessages': 100 // BotService
        };
        
        return limits[serviceName] || 1000;
    }

    /**
     * Obtiene edad máxima por servicio
     */
    private getMaxAgeForService(serviceName: string): number {
        const maxAges: Record<string, number> = {
            'sentMessages': 2 * 60 * 60 * 1000, // 2 horas
            'conversationHistory': 7 * 24 * 60 * 60 * 1000, // 7 días
            'pendingAlerts': 7 * 24 * 60 * 60 * 1000, // 7 días
            'lastMessageTime': 30 * 60 * 1000, // 30 minutos
            'processingMessages': 5 * 60 * 1000 // 5 minutos
        };
        
        return maxAges[serviceName] || 60 * 60 * 1000; // 1 hora por defecto
    }

    /**
     * Funciones de limpieza específicas para cada servicio
     */
    static createCleanupFunctions() {
        return {
            // Para Map<string, any> - limpiar por edad
            cleanupByAge<T extends Map<any, { timestamp?: number; created?: Date; createdAt?: string }>>(
                map: T,
                maxAgeMs: number
            ): number {
                let cleaned = 0;
                const cutoff = Date.now() - maxAgeMs;
                
                for (const [key, value] of map.entries()) {
                    const timestamp = value.timestamp || 
                        value.created?.getTime() || 
                        (value.createdAt ? new Date(value.createdAt).getTime() : 0);
                    
                    if (timestamp && timestamp < cutoff) {
                        map.delete(key);
                        cleaned++;
                    }
                }
                
                return cleaned;
            },

            // Para Map<string, Array> - limpiar arrays largos y viejos
            cleanupMapOfArrays<T extends Map<string, any[]>>(
                map: T,
                maxArrayLength: number,
                maxAgeMs: number = 0
            ): number {
                let cleaned = 0;
                const cutoff = maxAgeMs > 0 ? Date.now() - maxAgeMs : 0;
                
                for (const [key, array] of map.entries()) {
                    let cleanedInArray = 0;
                    
                    // Limpiar items viejos del array
                    if (maxAgeMs > 0) {
                        const filteredArray = array.filter(item => {
                            const timestamp = item.timestamp || item.getTime?.() || 0;
                            return !timestamp || timestamp > cutoff;
                        });
                        cleanedInArray = array.length - filteredArray.length;
                        if (cleanedInArray > 0) {
                            array.splice(0, array.length, ...filteredArray);
                        }
                    }
                    
                    // Limitar tamaño del array
                    if (array.length > maxArrayLength) {
                        const removed = array.splice(0, array.length - maxArrayLength);
                        cleanedInArray += removed.length;
                    }
                    
                    cleaned += cleanedInArray;
                }
                
                return cleaned;
            },

            // Para Arrays - limpiar por edad y tamaño
            cleanupArray<T extends Array<{ timestamp?: number; created?: Date; createdAt?: string }>>(
                array: T,
                maxSize: number,
                maxAgeMs: number
            ): number {
                if (array.length <= maxSize && maxAgeMs <= 0) return 0;
                
                let filtered = [...array];
                
                // Limpiar por edad
                if (maxAgeMs > 0) {
                    const cutoff = Date.now() - maxAgeMs;
                    filtered = filtered.filter(item => {
                        const timestamp = item.timestamp || 
                            item.created?.getTime() || 
                            (item.createdAt ? new Date(item.createdAt).getTime() : 0);
                        return !timestamp || timestamp > cutoff;
                    });
                }
                
                // Limitar tamaño
                if (filtered.length > maxSize) {
                    filtered = filtered.slice(-maxSize);
                }
                
                const cleaned = array.length - filtered.length;
                array.splice(0, array.length, ...filtered);
                
                return cleaned;
            },

            // Para Map<string, SentMessageTracker> - limpiar por timestamp
            cleanupSentMessages<T extends Map<string, { lastSentAt?: number; timestamp?: number }>>(
                map: T,
                maxAgeMs: number
            ): number {
                let cleaned = 0;
                const cutoff = Date.now() - maxAgeMs;
                
                for (const [key, tracker] of map.entries()) {
                    const timestamp = tracker.lastSentAt || tracker.timestamp || 0;
                    
                    if (timestamp && timestamp < cutoff) {
                        map.delete(key);
                        cleaned++;
                    }
                }
                
                return cleaned;
            },

            // Para Map<string, number> - limpiar por edad del timestamp (valor)
            cleanupTimestampMap<T extends Map<string, number>>(
                map: T,
                maxAgeMs: number
            ): number {
                let cleaned = 0;
                const cutoff = Date.now() - maxAgeMs;
                
                for (const [key, timestamp] of map.entries()) {
                    if (timestamp && timestamp < cutoff) {
                        map.delete(key);
                        cleaned++;
                    }
                }
                
                return cleaned;
            },

            // Para Set<string> - limpiar por timestamp (necesita mapa externo de timestamps)
            cleanupSet<T extends Set<string>>(
                set: T,
                timestamps: Map<string, number>,
                maxAgeMs: number
            ): number {
                let cleaned = 0;
                const cutoff = Date.now() - maxAgeMs;
                
                for (const item of set) {
                    const timestamp = timestamps.get(item) || 0;
                    
                    if (timestamp && timestamp < cutoff) {
                        set.delete(item);
                        timestamps.delete(item);
                        cleaned++;
                    }
                }
                
                return cleaned;
            }
        };
    }

    /**
     * Limpieza global de todos los servicios
     */
    private async performGlobalCleanup(): Promise<void> {
        console.log('[MemoryManager] Performing global cleanup...');
        
        try {
            // Forzar garbage collection si está disponible
            if (global.gc) {
                global.gc();
            }
            
            this.emitStats();
        } catch (error) {
            console.error('[MemoryManager] Error in global cleanup:', error);
        }
    }

    /**
     * Emite estadísticas a los callbacks registrados
     */
    private emitStats(): void {
        if (this.statsCallbacks.size === 0) return;
        
        // Aquí se recolectarían las estadísticas reales
        // Por ahora, emitimos un array vacío
        this.statsCallbacks.forEach(callback => {
            try {
                callback([]);
            } catch (error) {
                console.error('[MemoryManager] Error in stats callback:', error);
            }
        });
    }

    /**
     * Registra callback para estadísticas
     */
    onStatsUpdate(callback: (stats: MemoryStats[]) => void): void {
        this.statsCallbacks.add(callback);
    }

    /**
     * Remueve callback de estadísticas
     */
    offStatsUpdate(callback: (stats: MemoryStats[]) => void): void {
        this.statsCallbacks.delete(callback);
    }

    /**
     * Shutdown graceful del MemoryManager
     */
    shutdown(): void {
        console.log('[MemoryManager] Shutting down...');
        
        // Limpiar todos los intervalos
        for (const [serviceName, interval] of this.cleanupIntervals.entries()) {
            clearInterval(interval);
            console.log(`[MemoryManager] Stopped cleanup for ${serviceName}`);
        }
        
        this.cleanupIntervals.clear();
        this.statsCallbacks.clear();
    }
}

export default MemoryManager;