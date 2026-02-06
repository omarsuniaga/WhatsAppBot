/**
 * Alumno (Student) Interface - Based on Firestore ALUMNOS collection
 * This matches the exact structure in Firebase
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Complete Alumno interface matching Firestore ALUMNOS collection
 */
export interface Alumno {
  // === IDENTIFICATION ===
  id: string;
  
  // === PERSONAL DATA ===
  nombre: string;
  apellido: string;
  edad?: number | string;
  nac?: string; // Fecha de nacimiento (formato variable: "12/12/2010", "2011-04-08", etc.)
  sexo?: 'Masculino' | 'Femenino' | string;
  cedula?: string | null;
  nacionalidad?: string | null;
  religion?: string | null;
  limitaciones_religion?: string | null;
  
  // === CONTACT INFO ===
  tlf?: string; // Teléfono principal del alumno o representante
  email?: string;
  direccion?: string | null;
  emergencia?: string | null; // Teléfono de emergencia
  
  // === AVATAR ===
  avatar?: string; // URL de imagen de perfil
  
  // === PARENT/GUARDIAN DATA ===
  padre?: string; // Nombre del padre
  madre?: string; // Nombre de la madre
  nombre_padres?: string; // Nombre del representante principal
  representantes?: string | null; // "Madre", "Padre", etc.
  tlf_padre?: string;
  tlf_madre?: string;
  cedula_padre?: string | null;
  cedula_madre?: string | null;
  
  // === SCHOOL/WORK INFO ===
  colegio_trabajo?: string | null;
  direccion_colegio_trabajo?: string | null;
  horario_colegio_trabajo?: string | null;
  medios_transporte?: string | null;
  
  // === ACADEMIC DATA ===
  instrumento?: string | { nombre: string; [key: string]: any };
  grupo?: string[]; // Array de grupos/clases asignados
  clase?: string;
  classIds?: string[]; // IDs de clases asignadas
  
  // === ADMINISTRATIVE ===
  activo: boolean;
  datosPendientes?: boolean; // Flag for students with incomplete data
  fecInscripcion?: string; // Fecha de inscripción
  registro?: string; // Fecha de registro original
  observaciones?: string;
  
  // === TERMS & CONDITIONS ===
  terminos_condiciones?: string;
  Termino_Redes_Sociales?: string | boolean;
  Termino_Aporte_Mensual?: boolean;
  aportes_mensuales?: string;
  aportes_600_mensual?: string | null;
  
  // === DOCUMENTS ===
  documentos?: Record<string, any>;
  
  // === GEOLOCATION ===
  google_map?: string | null;
  
  // === METADATA ===
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
  updatedBy?: string;
  
  // Allow additional properties for Firestore flexibility
  [key: string]: any;
}

/**
 * Form data for creating/editing a student
 * Simplified version for the modal form
 */
export interface AlumnoFormData {
  // Personal
  nombre: string;
  apellido: string;
  edad: string;
  nac: string;
  sexo: string;
  cedula: string;
  
  // Contact
  tlf: string;
  email: string;
  direccion: string;
  emergencia: string;
  
  // Parents
  padre: string;
  madre: string;
  nombre_padres: string;
  representantes: string;
  tlf_padre: string;
  tlf_madre: string;
  cedula_padre: string;
  cedula_madre: string;
  
  // School
  colegio_trabajo: string;
  horario_colegio_trabajo: string;
  medios_transporte: string;
  
  // Academic
  instrumento: string;
  grupo: string[];
  
  // Administrative
  activo: boolean;
  datosPendientes: boolean;
  observaciones: string;
  religion: string;
  
  // Avatar
  avatar: string;
}

/**
 * Default empty form data for new student
 */
export const emptyAlumnoForm: AlumnoFormData = {
  nombre: '',
  apellido: '',
  edad: '',
  nac: '',
  sexo: '',
  cedula: '',
  tlf: '',
  email: '',
  direccion: '',
  emergencia: '',
  padre: '',
  madre: '',
  nombre_padres: '',
  representantes: '',
  tlf_padre: '',
  tlf_madre: '',
  cedula_padre: '',
  cedula_madre: '',
  colegio_trabajo: '',
  horario_colegio_trabajo: '',
  medios_transporte: '',
  instrumento: '',
  grupo: [],
  activo: true,
  datosPendientes: true, // New students have pending data by default
  observaciones: '',
  religion: '',
  avatar: '',
};

/**
 * Convert Firestore Alumno to form data
 */
export function alumnoToFormData(alumno: Alumno): AlumnoFormData {
  return {
    nombre: alumno.nombre || '',
    apellido: alumno.apellido || '',
    edad: String(alumno.edad || ''),
    nac: alumno.nac || '',
    sexo: alumno.sexo || '',
    cedula: alumno.cedula || '',
    tlf: alumno.tlf || '',
    email: alumno.email || '',
    direccion: alumno.direccion || '',
    emergencia: alumno.emergencia || '',
    padre: alumno.padre || '',
    madre: alumno.madre || '',
    nombre_padres: alumno.nombre_padres || '',
    representantes: alumno.representantes || '',
    tlf_padre: alumno.tlf_padre || '',
    tlf_madre: alumno.tlf_madre || '',
    cedula_padre: alumno.cedula_padre || '',
    cedula_madre: alumno.cedula_madre || '',
    colegio_trabajo: alumno.colegio_trabajo || '',
    horario_colegio_trabajo: alumno.horario_colegio_trabajo || '',
    medios_transporte: alumno.medios_transporte || '',
    instrumento: typeof alumno.instrumento === 'object' && alumno.instrumento?.nombre 
      ? alumno.instrumento.nombre 
      : (typeof alumno.instrumento === 'string' ? alumno.instrumento : ''),
    grupo: alumno.grupo || [],
    activo: alumno.activo ?? true,
    datosPendientes: alumno.datosPendientes ?? false,
    observaciones: alumno.observaciones || '',
    religion: alumno.religion || '',
    avatar: alumno.avatar || '',
  };
}

/**
 * Convert form data to Firestore Alumno format for saving
 */
export function formDataToAlumno(formData: AlumnoFormData, existingId?: string): Partial<Alumno> {
  return {
    ...(existingId && { id: existingId }),
    nombre: formData.nombre,
    apellido: formData.apellido,
    edad: formData.edad ? parseInt(formData.edad) || formData.edad : '',
    nac: formData.nac,
    sexo: formData.sexo,
    cedula: formData.cedula || null,
    tlf: formData.tlf,
    email: formData.email,
    direccion: formData.direccion || null,
    emergencia: formData.emergencia || null,
    padre: formData.padre,
    madre: formData.madre,
    nombre_padres: formData.nombre_padres,
    representantes: formData.representantes || null,
    tlf_padre: formData.tlf_padre,
    tlf_madre: formData.tlf_madre,
    cedula_padre: formData.cedula_padre || null,
    cedula_madre: formData.cedula_madre || null,
    colegio_trabajo: formData.colegio_trabajo || null,
    horario_colegio_trabajo: formData.horario_colegio_trabajo || null,
    medios_transporte: formData.medios_transporte || null,
    instrumento: formData.instrumento,
    grupo: formData.grupo,
    activo: formData.activo,
    datosPendientes: formData.datosPendientes,
    observaciones: formData.observaciones,
    religion: formData.religion || null,
    avatar: formData.avatar,
  };
}
