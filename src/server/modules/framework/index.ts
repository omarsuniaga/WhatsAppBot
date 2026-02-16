/**
 * Framework Module - Central export point
 * Módulo de Framework Educativo con entidades, repositorios, servicios y rutas
 */

export * from './entities';
export * from './repositories';
export * from './services';

// Import routes for easy access
export { default as frameworkRoutes } from './routes/framework.routes';
