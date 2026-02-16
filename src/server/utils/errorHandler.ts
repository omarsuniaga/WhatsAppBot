/**
 * ErrorHandler - Manejo robusto de errores con graceful shutdown
 */

import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';

interface ShutdownTask {
    name: string;
    priority: number; // 1 = highest, 10 = lowest
    timeout: number;
    task: () => Promise<void>;
}

interface ErrorContext {
    component: string;
    operation: string;
    userId?: string;
    requestId?: string;
    metadata?: Record<string, any>;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private shutdownTasks: ShutdownTask[] = [];
    private isShuttingDown = false;
    private httpServer?: HttpServer;
    private socketServer?: SocketServer;
    
    private constructor() {
        this.setupGlobalHandlers();
    }
    
    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }
    
    /**
     * Configura los servidores para graceful shutdown
     */
    setServers(httpServer: HttpServer, socketServer: SocketServer): void {
        this.httpServer = httpServer;
        this.socketServer = socketServer;
        
        console.log('[ErrorHandler] Servers configured for graceful shutdown');
    }
    
    /**
     * Registra una tarea de shutdown con prioridad
     */
    registerShutdownTask(task: ShutdownTask): void {
        this.shutdownTasks.push(task);
        // Ordenar por prioridad (menor número = mayor prioridad)
        this.shutdownTasks.sort((a, b) => a.priority - b.priority);
        
        console.log(`[ErrorHandler] Registered shutdown task: ${task.name} (priority: ${task.priority})`);
    }
    
    /**
     * Configura manejadores globales de errores
     */
    private setupGlobalHandlers(): void {
        // Uncaught exceptions
        process.on('uncaughtException', async (error: Error) => {
            console.error('[ErrorHandler] UNCAUGHT EXCEPTION:', {
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            
            try {
                await this.gracefulShutdown('uncaughtException', 1);
            } catch (shutdownError) {
                console.error('[ErrorHandler] Error during shutdown:', shutdownError);
                process.exit(1);
            }
        });
        
        // Unhandled promise rejections
        process.on('unhandledRejection', async (reason, promise) => {
            console.error('[ErrorHandler] UNHANDLED REJECTION:', {
                reason: String(reason),
                promise: promise.toString(),
                timestamp: new Date().toISOString()
            });
            
            try {
                await this.gracefulShutdown('unhandledRejection', 1);
            } catch (shutdownError) {
                console.error('[ErrorHandler] Error during shutdown:', shutdownError);
                process.exit(1);
            }
        });
        
        // Graceful shutdown signals
        process.on('SIGINT', async () => {
            console.log('[ErrorHandler] SIGINT received');
            await this.gracefulShutdown('SIGINT', 0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('[ErrorHandler] SIGTERM received');
            await this.gracefulShutdown('SIGTERM', 0);
        });
        
        // Memory warnings
        process.on('warning', (warning) => {
            console.warn('[ErrorHandler] PROCESS WARNING:', {
                name: warning.name,
                message: warning.message,
                stack: warning.stack,
                timestamp: new Date().toISOString()
            });
        });
    }
    
    /**
     * Shutdown graceful con ejecución de tareas
     */
    private async gracefulShutdown(signal: string, exitCode: number): Promise<void> {
        if (this.isShuttingDown) {
            console.log('[ErrorHandler] Shutdown already in progress');
            return;
        }
        
        this.isShuttingDown = true;
        console.log(`[ErrorHandler] Starting graceful shutdown (${signal})...`);
        
        // Notificar clientes que se está cerrando
        try {
            if (this.socketServer) {
                this.socketServer.emit('server:shutdown', {
                    message: 'Server is shutting down',
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('[ErrorHandler] Error notifying clients:', error);
        }
        
        // Ejecutar tareas de shutdown en orden de prioridad
        const shutdownPromises = this.shutdownTasks.map(async (task) => {
            try {
                console.log(`[ErrorHandler] Executing: ${task.name}`);
                
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`Task ${task.name} timeout`)), task.timeout);
                });
                
                await Promise.race([task.task(), timeoutPromise]);
                console.log(`[ErrorHandler] Completed: ${task.name}`);
            } catch (error) {
                console.error(`[ErrorHandler] Failed: ${task.name}`, error);
            }
        });
        
        // Esperar todas las tareas (con timeout global)
        try {
            await Promise.race([
                Promise.all(shutdownPromises),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Global shutdown timeout')), 30000)
                )
            ]);
        } catch (error) {
            console.error('[ErrorHandler] Error during task execution:', error);
        }
        
        // Cerrar servidores
        try {
            if (this.socketServer) {
                console.log('[ErrorHandler] Closing Socket.IO server...');
                this.socketServer.close();
            }
            
            if (this.httpServer) {
                console.log('[ErrorHandler] Closing HTTP server...');
                this.httpServer.close(() => {
                    console.log('[ErrorHandler] HTTP server closed');
                });
            }
        } catch (error) {
            console.error('[ErrorHandler] Error closing servers:', error);
        }
        
        console.log(`[ErrorHandler] Graceful shutdown completed (${signal})`);
        process.exit(exitCode);
    }
    
    /**
     * Maneja errores de forma contextualizada
     */
    handleError(error: Error, context: ErrorContext): void {
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        };
        
        // Loggear con contexto
        console.error(`[ErrorHandler] Error in ${context.component}.${context.operation}:`, errorInfo);
        
        // Enviar a servicios externos si están configurados
        this.notifyExternalServices(errorInfo);
        
        // Decidir acción basada en tipo de error
        if (this.shouldShutdown(error)) {
            console.log('[ErrorHandler] Critical error detected, initiating shutdown');
            this.gracefulShutdown('critical_error', 1);
        }
    }
    
    /**
     * Maneja errores asíncronos con contexto
     */
    async handleAsyncError<T>(
        operation: () => Promise<T>,
        context: ErrorContext,
        fallback?: T
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            this.handleError(error as Error, context);
            
            if (fallback !== undefined) {
                console.log(`[ErrorHandler] Using fallback for ${context.component}.${context.operation}`);
                return fallback;
            }
            
            throw error;
        }
    }
    
    /**
     * Envuelve funciones con manejo de errores
     */
    wrapWithErrorHandling<T extends (...args: any[]) => any>(
        fn: T,
        context: Partial<ErrorContext>
    ): T {
        return (async (...args: any[]) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError(error as Error, {
                    component: context.component || 'unknown',
                    operation: context.operation || 'unknown',
                    ...context
                });
                throw error;
            }
        }) as T;
    }
    
    /**
     * Determina si un error requiere shutdown
     */
    private shouldShutdown(error: Error): boolean {
        const shutdownTriggers = [
            'EADDRINUSE', // Puerto en uso
            'EACCES', // Permisos insuficientes
            'EMFILE', // Demasiados archivos abiertos
            'ENOMEM', // Sin memoria
            'ENOSPC', // Sin espacio en disco
            'DATABASE_CONNECTION_FAILED',
            'AUTHENTICATION_FAILED'
        ];
        
        return shutdownTriggers.some(trigger => 
            error.message.includes(trigger) || 
            (error as any).code === trigger
        );
    }
    
    /**
     * Notifica a servicios externos (monitoring, logging, etc.)
     */
    private notifyExternalServices(errorInfo: any): void {
        // Aquí se podría integrar con:
        // - Sentry
        // - DataDog
        // - New Relic
        // - Sistema de logging centralizado
        
        if (process.env.SENTRY_DSN) {
            // Integración con Sentry (ejemplo)
            console.log('[ErrorHandler] Would send to Sentry:', errorInfo);
        }
    }
    
    /**
     * Genera tareas de shutdown comunes
     */
    static createDefaultShutdownTasks(): ShutdownTask[] {
        return [
            {
                name: 'stop_accepting_new_connections',
                priority: 1,
                timeout: 5000,
                task: async () => {
                    // Implementación específica del servidor
                    console.log('Stopping accepting new connections...');
                }
            },
            {
                name: 'save_critical_data',
                priority: 2,
                timeout: 10000,
                task: async () => {
                    // Guardar datos críticos en memoria
                    console.log('Saving critical data...');
                }
            },
            {
                name: 'cleanup_resources',
                priority: 3,
                timeout: 5000,
                task: async () => {
                    // Limpiar recursos (temp files, locks, etc.)
                    console.log('Cleaning up resources...');
                }
            },
            {
                name: 'close_database_connections',
                priority: 4,
                timeout: 5000,
                task: async () => {
                    // Cerrar conexiones a base de datos
                    console.log('Closing database connections...');
                }
            },
            {
                name: 'flush_logs',
                priority: 5,
                timeout: 3000,
                task: async () => {
                    // Forzar flush de logs
                    console.log('Flushing logs...');
                }
            }
        ];
    }
}

export default ErrorHandler;