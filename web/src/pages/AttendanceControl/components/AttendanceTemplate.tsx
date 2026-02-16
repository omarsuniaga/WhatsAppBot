import React, { useMemo } from 'react';
import './AttendanceTemplate.css';
import { type EnrichedAttendance } from '../types';

interface AttendanceTemplateProps {
    date: string;
    className: string;
    teacherName: string;
    roomName: string;
    scheduleTime: string;
    attendances: EnrichedAttendance[];
}

export const AttendanceTemplate: React.FC<AttendanceTemplateProps> = ({
    date,
    className,
    teacherName,
    roomName,
    scheduleTime,
    attendances
}) => {
    // Format date DD / MM / YYYY
    const formattedDate = useMemo(() => {
        if (!date) return '/ /';
        const [year, month, day] = date.split('-');
        return `${day} / ${month} / ${year}`;
    }, [date]);

    // Split students into two columns (max 5 per column as in PDF, or more if needed)
    const columns = useMemo(() => {
        const sorted = [...attendances].sort((a, b) => a.studentName.localeCompare(b.studentName));
        const midPoint = Math.ceil(sorted.length / 2);
        return [
            sorted.slice(0, midPoint),
            sorted.slice(midPoint)
        ];
    }, [attendances]);

    // Statistics
    const stats = useMemo(() => {
        return {
            tardanza: attendances.filter(a => a.estado === 'tardanza').length,
            noJustificada: attendances.filter(a => a.estado === 'ausente').length,
            justificada: attendances.filter(a => a.estado === 'justificado').length,
            presentes: attendances.filter(a => a.estado === 'presente').length
        };
    }, [attendances]);

    // Observations
    const observation = useMemo(() => {
        return attendances.find(a => a.observaciones)?.observaciones || '';
    }, [attendances]);

    const getStatusCode = (status: string) => {
        switch (status) {
            case 'presente': return 'P';
            case 'ausente': return 'N';
            case 'tardanza': return 'T';
            case 'justificado': return 'J';
            default: return '';
        }
    };

    return (
        <div className="attendance-template-container">
            {/* Header */}
            <header className="template-header">
                <div className="institution-logo-container">
                    <div className="institution-logo-placeholder">
                        <span className="logo-text-main">EL SISTEMA</span>
                        <span className="logo-text-sub">PUNTA CANA</span>
                        <div style={{ fontSize: '0.6rem', marginTop: '2px' }}>Dominican Republic</div>
                    </div>
                </div>

                <div className="template-title-container">
                    <h1 className="template-title">
                        FUNDACIÓN PARA LA EXPANSIÓN<br />
                        CULTURAL Y ARTÍSTICA<br />
                        DE PUNTA CANA<br />
                        FUNEYCA PC
                    </h1>
                </div>

                <div className="header-right-meta">
                    <div className="meta-field">
                        <span className="meta-label">FECHA:</span>
                        <span className="meta-value-line">{formattedDate}</span>
                    </div>
                    <div className="meta-field">
                        <span className="meta-label">ENTRADA:</span>
                        <span className="meta-value-line">{scheduleTime.split('-')[0] || ''}</span>
                    </div>
                </div>
            </header>

            {/* Metadata Grid */}
            <section className="metadata-grid-section">
                <div className="metadata-item">
                    <span>SALÓN:</span>
                    <div className="metadata-value">{roomName || '(Indicar Nombre del Salón Asignado)'}</div>
                </div>
                <div className="metadata-item">
                    <span>SECCIÓN:</span>
                    <div className="metadata-value">{className || '(Indicar Nombre de la Cátedra)'}</div>
                </div>
                <div className="metadata-item">
                    <span>MAESTRO:</span>
                    <div className="metadata-value">{teacherName || '(Indicar Nombre y Apellido del Maestro)'}</div>
                </div>
                <div className="metadata-item">
                    <span>HORA DE CLASE:</span>
                    <div className="metadata-value">{scheduleTime || 'Indicar DÍAS y HORARIO asignado a la Cátedra'}</div>
                </div>
            </section>

            {/* Totals and Legend */}
            <section className="totals-legend-section">
                <div className="totals-group">
                    <div className="total-item">
                        <span>Total de tardanza:</span>
                        <div className="total-line">{stats.tardanza}</div>
                    </div>
                    <div className="total-item">
                        <span>Total no justificado:</span>
                        <div className="total-line">{stats.noJustificada}</div>
                    </div>
                    <div className="total-item">
                        <span>Total justificado:</span>
                        <div className="total-line">{stats.justificada}</div>
                    </div>
                    <div className="total-item">
                        <span>Total presentes:</span>
                        <div className="total-line">{stats.presentes}</div>
                    </div>
                </div>

                <div className="legend-group">
                    <div>T- Tardanza</div>
                    <div>N- No justificada</div>
                    <div>J-justificada</div>
                    <div>P- Presente</div>
                </div>
            </section>

            {/* Student Table */}
            <section className="student-table-section">
                {columns.map((col, colIdx) => (
                    <table key={colIdx} className="attendance-table">
                        <thead>
                            <tr>
                                <th className="col-no">No.</th>
                                <th className="col-name">Nombre completo del Alumno</th>
                                <th className="col-asist">Asist.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Render up to 15 rows to ensure a consistent height if possible, or just the students */}
                            {Array.from({ length: Math.max(col.length, 15) }).map((_, idx) => {
                                const student = col[idx];
                                return (
                                    <tr key={idx}>
                                        <td className="col-no">{colIdx * 15 + idx + 1}</td>
                                        <td className="col-name">{student?.studentName || ''}</td>
                                        <td className="col-asist">{student ? getStatusCode(student.estado) : ''}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ))}
            </section>

            {/* Materia Vista */}
            <div className="section-label">Descripción de materia vista</div>
            <div className="observation-box">
                {observation}
            </div>

            {/* Disciplina */}
            <div className="section-label">Observaciones de disciplina y conducta</div>
            <div className="observation-box-sub">(especificar casos individuales o colectivos)</div>
            <div className="observation-box" style={{ minHeight: '80px' }}>
                {/* Space for manual or dynamic student-specific notes if we had them grouped */}
            </div>

            {/* Footer */}
            <footer className="footer-signatures">
                <div className="signature-line">Firma del Maestro (a)</div>
                <div className="signature-line">Firma del area Administrativa</div>
            </footer>
        </div>
    );
};
