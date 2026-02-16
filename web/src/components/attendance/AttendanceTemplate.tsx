import React, { useMemo } from 'react';
import './AttendanceTemplate.css';
import { type EnrichedAttendance } from '../../pages/AttendanceControl/types';
import { INSTITUTION_LOGO_BASE64 } from './institutionLogoBase64';

interface AttendanceTemplateProps {
    date: string;
    className: string;
    teacherName: string;
    roomName: string;
    scheduleTime: string;
    attendances: EnrichedAttendance[];
    observation?: string;
}

const STUDENTS_PER_COLUMN = 20;
const MAX_COLUMNS = 4;
const MAX_STUDENTS_PER_PAGE = 60;

const chunk = <T,>(items: T[], size: number): T[][] => {
    if (size <= 0) return [items];
    const parts: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        parts.push(items.slice(i, i + size));
    }
    return parts;
};

const toStatusCode = (estado: EnrichedAttendance['estado']): string => {
    switch (estado) {
        case 'presente':
            return 'P';
        case 'tardanza':
            return 'T';
        case 'ausente':
            return 'N';
        case 'justificado':
            return 'J';
        default:
            return '';
    }
};

const formatDate = (date: string): string => {
    if (!date) return '/   /';
    const [year, month, day] = date.split('-');
    if (!year || !month || !day) return date;
    return `${day} / ${month} / ${year}`;
};

export const AttendanceTemplate: React.FC<AttendanceTemplateProps> = ({
    date,
    className,
    teacherName,
    roomName,
    scheduleTime,
    attendances,
    observation: propObservation
}) => {
    const sortedStudents = useMemo(
        () => [...attendances].sort((a, b) => (a.studentName || '').localeCompare(b.studentName || '')),
        [attendances]
    );

    const totals = useMemo(() => ({
        tardanza: attendances.filter(a => a.estado === 'tardanza').length,
        ausentes: attendances.filter(a => a.estado === 'ausente').length,
        justificados: attendances.filter(a => a.estado === 'justificado').length,
        presentes: attendances.filter(a => a.estado === 'presente').length
    }), [attendances]);

    const pages = useMemo(() => {
        const studentPages = chunk(sortedStudents, MAX_STUDENTS_PER_PAGE);

        if (studentPages.length === 0) {
            return [{
                columns: 1,
                studentsPerColumn: STUDENTS_PER_COLUMN,
                columnChunks: [[] as EnrichedAttendance[]],
                offset: 0
            }];
        }

        let globalOffset = 0;

        return studentPages.map((pageStudents) => {
            const columns = Math.max(1, Math.min(MAX_COLUMNS, Math.ceil(pageStudents.length / STUDENTS_PER_COLUMN)));
            const studentsPerColumn = Math.ceil(pageStudents.length / columns) || STUDENTS_PER_COLUMN;
            const columnChunks = chunk(pageStudents, studentsPerColumn);
            const page = {
                columns,
                studentsPerColumn,
                columnChunks,
                offset: globalOffset
            };
            globalOffset += pageStudents.length;
            return page;
        });
    }, [sortedStudents]);

    const observation = useMemo(
        () => propObservation || attendances.find(a => a.observaciones)?.observaciones || '',
        [attendances, propObservation]
    );

    return (
        <div className="attendance-template-container">
            {pages.map((page, pageIndex) => (
                <section key={`attendance-page-${pageIndex}`} className="attendance-sheet">
                    <div className="header">
                        <div className="header-logo">
                            <img src={INSTITUTION_LOGO_BASE64} alt="El Sistema Punta Cana" />
                        </div>
                        <div className="header-title">
                            <h1>
                                Fundacion para la Expansion<br />
                                Cultural y Artistica<br />
                                de Punta Cana<br />
                                FUNEYCA PC
                            </h1>
                        </div>
                        <div className="header-date">
                            <div className="fecha-line"><b>FECHA:</b> {formatDate(date)}</div>
                            <div className="entrada-line"><b>ENTRADA:</b></div>
                            <div className="entrada-box" />
                        </div>
                    </div>

                    <table className="blue-bar-table">
                        <tbody>
                            <tr>
                                <td />
                            </tr>
                        </tbody>
                    </table>

                    <div className="info-main-row">
                        <div className="info-fields-col">
                            <p><b>SALON:</b> {roomName || '(Indicar Nombre del Salon Asignado)'}</p>
                            <p><b>MAESTRO:</b> {teacherName || '(Indicar Nombre y Apellido del Maestro)'}</p>
                            <p><b>SECCION:</b> {className || '(Indicar Nombre de la Catedra)'}</p>
                            <p><b>HORA DE CLASE:</b> {scheduleTime || '(Indicar DIAS y HORARIO asignado a la Catedra)'}</p>
                        </div>
                        <div className="info-totals-col">
                            <p><b>Total de tardanza:</b> <span>{totals.tardanza}</span></p>
                            <p><b>Total no justificado:</b> <span>{totals.ausentes}</span></p>
                            <p><b>Total justificado:</b> <span>{totals.justificados}</span></p>
                            <p><b>Total presentes:</b> <span>{totals.presentes}</span></p>
                        </div>
                        <div className="info-legend-col">
                            <p>T- Tardanza</p>
                            <p>N- No justificada</p>
                            <p>J-justificada</p>
                            <p>P- Presente</p>
                        </div>
                    </div>

                    <div className={`attendance-table-wrapper attendance-table-wrapper--cols-${page.columns}`}>
                        {Array.from({ length: page.columns }).map((_, columnIndex) => {
                            const col = page.columnChunks[columnIndex] || [];
                            const rowCount = Math.max(col.length, 5);

                            return (
                                <table className="attendance-table" key={`col-${pageIndex}-${columnIndex}`}>
                                    <thead>
                                        <tr>
                                            <th>No.</th>
                                            <th>Nombre completo del Alumno</th>
                                            <th>Asist.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({ length: rowCount }).map((__, rowIndex) => {
                                            const item = col[rowIndex];
                                            const number = page.offset + (columnIndex * page.studentsPerColumn) + rowIndex + 1;
                                            return (
                                                <tr key={`row-${pageIndex}-${columnIndex}-${rowIndex}`}>
                                                    <td>{number <= sortedStudents.length ? number : ''}</td>
                                                    <td>{item?.studentName || ''}</td>
                                                    <td>{item ? toStatusCode(item.estado) : ''}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            );
                        })}
                    </div>

                    <div className="instructions">
                        Indicar nombres y apellidos de los alumnos inscritos en la seccion correspondiente y ajustar
                        las tablas segun la cantidad de estudiantes para cubrir la seccion completa.
                    </div>

                    <div className="section-header">Descripcion de materia vista</div>
                    <div className="lined-area">
                        <div className="lined-row lined-row--text">{pageIndex === 0 ? observation : ''}</div>
                        <div className="lined-row" />
                        <div className="lined-row" />
                        <div className="lined-row" />
                    </div>

                    <div className="section-header-obs">
                        Observaciones de disciplina y conducta
                        <small>(especificar casos individuales o colectivos)</small>
                    </div>
                    <div className="lined-area">
                        <div className="lined-row" />
                        <div className="lined-row" />
                        <div className="lined-row" />
                    </div>

                    <div className="signatures">
                        <div className="signature-block">
                            <div className="signature-line">Firma del Maestro (a)</div>
                        </div>
                        <div className="signature-block">
                            <div className="signature-line">Firma del area Administrativa</div>
                        </div>
                    </div>

                    {pageIndex < pages.length - 1 && <div className="page-break" />}
                </section>
            ))}
        </div>
    );
};
