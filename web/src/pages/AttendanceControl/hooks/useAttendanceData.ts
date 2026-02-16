import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../../store';
import {
    clasesService,
    asistenciasService,
    contactosService,
    alumnosService,
    maestrosService,
    getTeacherIds,
    type Clase,
    type Asistencia,
    type Contacto,
    type Alumno,
    type Maestro
} from '../../../services/firestore';
import {
    type FilterPeriod,
    type EnrichedAttendance,
    type PendingClass,
    type CriticalStudent,
    type ContactDiagnosticItem,
    type IntegrityIssue
} from '../types';
import {
    todayISO,
    toLocalISODate,
    normalizeText,
    normalizePhone,
    toJid,
    resolveContactoJid,
    extractPhoneCandidates,
    classHasSessionOnDate,
    ATTENDANCE_HELP_DISMISSED_KEY
} from '../utils';

export const useAttendanceData = (showToast: (type: 'success' | 'error' | 'info', text: string) => void) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { connectionStatus } = useStore();

    const [classes, setClasses] = useState<Clase[]>([]);
    const [attendances, setAttendances] = useState<Asistencia[]>([]);
    const [contacts, setContacts] = useState<Contacto[]>([]);
    const [students, setStudents] = useState<Alumno[]>([]);
    const [teachers, setTeachers] = useState<Maestro[]>([]);

    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<FilterPeriod>('today');
    const [startDate, setStartDate] = useState(todayISO());
    const [endDate, setEndDate] = useState(todayISO());

    const [showHelp, setShowHelp] = useState(false);
    const [dismissHelpPermanently, setDismissHelpPermanently] = useState(false);

    // Diagnostics UI state
    const [highlightDiagnostics, setHighlightDiagnostics] = useState(false);
    const [reviewingDiagnosticId, setReviewingDiagnosticId] = useState('');
    const [resolvedNotice] = useState('');

    // Stable ref for showToast to avoid dependency churn
    const showToastRef = useRef(showToast);
    showToastRef.current = showToast;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [cData, aData, coData, sData, tData] = await Promise.all([
                clasesService.getAllClases(true),
                asistenciasService.getByDateRange(startDate, endDate),
                contactosService.getAllContactos(),
                alumnosService.getAllStudents(),
                maestrosService.getAllMaestros(true)
            ]);

            setClasses(cData);
            setAttendances(aData);
            setContacts(coData);
            setStudents(sData);
            setTeachers(tData);
        } catch (err) {
            console.error('Error loading attendance data:', err);
            showToastRef.current('error', 'Error al cargar datos de asistencia');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]); // Only re-create when dates change. showToast is via ref.

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Period selection logic — compute dates synchronously to avoid extra renders
    useEffect(() => {
        const today = new Date();
        switch (period) {
            case 'today':
                setStartDate(toLocalISODate(today));
                setEndDate(toLocalISODate(today));
                break;
            case 'week': {
                const monday = new Date(today);
                const day = monday.getDay();
                const diffToMonday = day === 0 ? -6 : 1 - day;
                monday.setDate(monday.getDate() + diffToMonday);
                setStartDate(toLocalISODate(monday));
                setEndDate(toLocalISODate(today));
                break;
            }
            case 'month': {
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                setStartDate(toLocalISODate(firstDay));
                setEndDate(toLocalISODate(today));
                break;
            }
            case 'custom':
                break;
        }
    }, [period]);

    // Help dismissal logic
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const dismissed = window.localStorage.getItem(ATTENDANCE_HELP_DISMISSED_KEY) === 'true';
        setDismissHelpPermanently(dismissed);
        if (!dismissed) {
            setShowHelp(true);
        }
    }, []);

    // Scroll to diagnostics effect
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const shouldFocusDiagnostics =
            params.get('source') === 'fix-return' &&
            params.get('focus') === 'contact-diagnostics';
        const returnedDiagId = params.get('diagId') || '';

        if (!shouldFocusDiagnostics) return;

        setHighlightDiagnostics(true);
        if (returnedDiagId) {
            setReviewingDiagnosticId(returnedDiagId);
        }

        const removeHighlightTimer = setTimeout(() => setHighlightDiagnostics(false), 2600);
        const removeReviewingTimer = setTimeout(() => setReviewingDiagnosticId(''), 8000);

        return () => {
            clearTimeout(removeHighlightTimer);
            clearTimeout(removeReviewingTimer);
        };
    }, [location.search]);

    const dataContext = useMemo(() => {
        const classById = new Map<string, Clase>();
        const classByNormalizedName = new Map<string, Clase>();
        const studentById = new Map<string, Alumno>();
        const teacherById = new Map<string, Maestro>();
        const teacherByNameMap = new Map<string, Maestro>();
        const contactByPhone = new Map<string, Contacto>();
        const contactByName = new Map<string, Contacto>();

        classes.forEach(c => {
            // Index by Firestore document ID (primary)
            classById.set(c.id, c);

            // Index by alternative IDs that may exist in legacy data
            const altId = (c as any).classId || (c as any).clase_id || (c as any).id_legacy;
            if (altId) {
                classById.set(String(altId), c);
            }

            // Index by normalized name for fallback lookup
            const nameKey1 = normalizeText(c.nombre);
            const nameKey2 = normalizeText(c.name);
            if (nameKey1 && !classByNormalizedName.has(nameKey1)) {
                classByNormalizedName.set(nameKey1, c);
            }
            if (nameKey2 && nameKey2 !== nameKey1 && !classByNormalizedName.has(nameKey2)) {
                classByNormalizedName.set(nameKey2, c);
            }
        });
        students.forEach(s => studentById.set(s.id, s));
        teachers.forEach(t => {
            teacherById.set(t.id, t);
            if (t.uid) teacherById.set(t.uid, t);
            const nameKey = normalizeText(t.name);
            if (nameKey && !teacherByNameMap.has(nameKey)) {
                teacherByNameMap.set(nameKey, t);
            }
        });

        contacts.forEach(contact => {
            const cPhone = normalizePhone(contact.telefono || contact.whatsapp || '');
            if (cPhone && !contactByPhone.has(cPhone)) {
                contactByPhone.set(cPhone, contact);
            }
            const nameKey = normalizeText(contact.nombre);
            if (nameKey && !contactByName.has(nameKey)) {
                contactByName.set(nameKey, contact);
            }
        });

        const getParentJid = (attendance: Asistencia, student: Alumno | undefined): string | undefined => {
            const attendanceJid = toJid((attendance as any).alumno_jid);
            if (attendanceJid) return attendanceJid;

            const linkedByStudentId = contacts.find(c => String((c as any).alumno_id || '') === attendance.alumno_id);
            const linkedJid = resolveContactoJid(linkedByStudentId);
            if (linkedJid) return linkedJid;

            if (student) {
                const phoneCandidates = [student.tlf_padre, student.tlf_madre, student.tlf, student.emergencia]
                    .map(normalizePhone).filter(Boolean);
                for (const phone of phoneCandidates) {
                    const byPhone = contactByPhone.get(phone);
                    const jid = resolveContactoJid(byPhone) || toJid(phone);
                    if (jid) return jid;
                }
                const parentNames = [student.padre, student.madre, student.nombre_padres]
                    .map(normalizeText).filter(Boolean);
                for (const parentName of parentNames) {
                    const byName = contactByName.get(parentName);
                    const jid = resolveContactoJid(byName);
                    if (jid) return jid;
                }
            }
            return undefined;
        };

        const getTeacherData = (attendance: Asistencia, clase: Clase | undefined) => {
            const classTeacherIds = clase ? getTeacherIds(clase) : [];
            const explicitTeacherName = clase?.profesor_nombre || clase?.profesor_nombres?.[0] || '';
            const teacherId = attendance.profesor_id || classTeacherIds[0];
            const teacher = teacherById.get(teacherId!) || teacherByNameMap.get(normalizeText(explicitTeacherName));

            const resolvedTeacherId = teacherId || teacher?.id || teacher?.uid;
            const teacherName = teacher?.name || explicitTeacherName || 'Sin asignar';

            const teacherPhones = extractPhoneCandidates(teacher);
            const teacherByPhone = teacherPhones.map(phone => contactByPhone.get(phone)).find(Boolean);
            const teacherByName = contactByName.get(normalizeText(teacherName));
            const teacherByIdContact = resolvedTeacherId ? contacts.find(c =>
                c.id === resolvedTeacherId || String((c as any).uid || '') === resolvedTeacherId
            ) : undefined;

            const teacherJid = resolveContactoJid(teacherByIdContact) ||
                resolveContactoJid(teacherByPhone) ||
                resolveContactoJid(teacherByName) ||
                teacherPhones.map(toJid).find(Boolean);

            return { teacherId: resolvedTeacherId, teacherName, teacherJid };
        };

        // Track unresolved classes for diagnostics (log once)
        const unresolvedClasses = new Set<string>();

        const enrichedAttendances: EnrichedAttendance[] = attendances.map(attendance => {
            const cId = attendance.clase_id || (attendance as any).classId;
            const sId = attendance.alumno_id || (attendance as any).studentId;

            // Strategy 1: Direct ID lookup
            let clase = cId ? classById.get(cId) : undefined;

            // Strategy 2: Lookup by clase_nombre using pre-built name index (O(1) instead of O(n))
            if (!clase) {
                const searchName = normalizeText(attendance.clase_nombre || (attendance as any).className || '');
                if (searchName) {
                    clase = classByNormalizedName.get(searchName);
                }
            }

            // Strategy 3: Partial/contains match for names that may have been truncated or modified
            if (!clase) {
                const searchName = normalizeText(attendance.clase_nombre || (attendance as any).className || '');
                if (searchName && searchName.length >= 3) {
                    clase = classes.find(c => {
                        const n1 = normalizeText(c.nombre);
                        const n2 = normalizeText(c.name);
                        return (n1 && (n1.includes(searchName) || searchName.includes(n1))) ||
                               (n2 && (n2.includes(searchName) || searchName.includes(n2)));
                    });
                }
            }

            // Log diagnostic info for unresolved classes (once per unique clase_id)
            if (!clase && cId && !unresolvedClasses.has(cId)) {
                unresolvedClasses.add(cId);
                console.warn(
                    `[AttendanceData] Class not found — clase_id="${cId}", clase_nombre="${attendance.clase_nombre || ''}", ` +
                    `className="${(attendance as any).className || ''}", fecha="${attendance.fecha}". ` +
                    `Available class IDs: [${classes.slice(0, 5).map(c => c.id).join(', ')}${classes.length > 5 ? '...' : ''}]`
                );
            }

            const student = studentById.get(sId);
            const { teacherId, teacherName, teacherJid } = getTeacherData(attendance, clase);
            const parentJid = getParentJid(attendance, student);

            // Resolve className: prefer attendance's own nombre, then resolved clase, finally fallback
            const resolvedClassName = attendance.clase_nombre || clase?.nombre || clase?.name || 'Clase no encontrada';

            return {
                ...attendance,
                className: resolvedClassName,
                studentName: attendance.alumno_nombre || (student ? `${student.nombre || ''} ${student.apellido || ''}`.trim() : 'Alumno no identificado'),
                teacherName,
                teacherId,
                teacherJid,
                parentJid
            };
        });

        return { classById, classByNormalizedName, studentById, teacherById, teacherByName: teacherByNameMap, contactByPhone, contactByName, enrichedAttendances };
    }, [classes, attendances, contacts, students, teachers]);

    const stats = useMemo(() => {
        const records = dataContext.enrichedAttendances;
        const total = records.length || 1;
        const presentCount = records.filter(a => a.estado === 'presente').length;
        const absentCount = records.filter(a => a.estado === 'ausente').length;
        const lateCount = records.filter(a => a.estado === 'tardanza').length;
        const justifiedCount = records.filter(a => a.estado === 'justificado').length;

        const isToday = startDate === endDate && startDate === todayISO();
        let pendingList: PendingClass[] = [];

        if (isToday) {
            const classesToday = classes.filter(c => classHasSessionOnDate(c, startDate));
            const reportedClassIds = new Set(records.filter(r => r.fecha === startDate).map(r => r.clase_id));

            pendingList = classesToday.filter(c => !reportedClassIds.has(c.id)).map(c => {
                const teacherIds = getTeacherIds(c);
                const teacherId = teacherIds[0] || c.profesor_id;
                const teacher = dataContext.teacherById.get(teacherId!) || dataContext.teacherByName.get(normalizeText(c.profesor_nombre || ''));
                const resolvedTeacherName = teacher?.name || c.profesor_nombre || 'Sin asignar';
                const teacherJid = toJid(teacher?.phone);

                return {
                    id: c.id,
                    name: c.nombre || 'Sin nombre',
                    teacher: resolvedTeacherName,
                    teacherId: teacherId || teacher?.id,
                    teacherJid
                };
            });
        }

        return {
            rate: Math.round(((presentCount + justifiedCount) / total) * 100),
            absences: absentCount,
            late: lateCount,
            justified: justifiedCount,
            pendingReports: pendingList.length,
            pendingList
        };
    }, [dataContext, classes, startDate, endDate]);

    const criticalStudents = useMemo(() => {
        const byStudent = new Map<string, CriticalStudent>();
        dataContext.enrichedAttendances.filter(a => a.estado === 'ausente').forEach(a => {
            const current = byStudent.get(a.alumno_id);
            if (current) {
                current.absences += 1;
                if (!current.parentJid) current.parentJid = a.parentJid;
            } else {
                byStudent.set(a.alumno_id, { id: a.alumno_id, name: a.studentName, absences: 1, parentJid: a.parentJid });
            }
        });
        return Array.from(byStudent.values()).filter(s => s.absences >= 3).sort((a, b) => b.absences - a.absences);
    }, [dataContext.enrichedAttendances]);

    const contactDiagnostics = useMemo(() => {
        const issues: ContactDiagnosticItem[] = [];
        for (const student of criticalStudents) {
            if (!student.parentJid) {
                issues.push({ id: `student-${student.id}`, entityType: 'student', name: student.name, reason: 'No existe JID válido para representante', entityId: student.id });
            }
        }
        for (const pending of stats.pendingList) {
            if (!pending.teacherJid) {
                issues.push({ id: `teacher-${pending.id}`, entityType: 'teacher', name: pending.teacher, reason: `Sin canal WhatsApp para clase "${pending.name}"`, classId: pending.id });
            }
        }
        return issues;
    }, [criticalStudents, stats.pendingList]);

    const integrityIssues = useMemo(() => {
        const issues: IntegrityIssue[] = [];
        classes.forEach(clase => {
            const teacherIds = getTeacherIds(clase);
            if (teacherIds.length === 0 && !clase.profesor_nombre) {
                issues.push({ id: `integrity-${clase.id}`, type: 'class_teacher_missing', severity: 'high', classId: clase.id, className: clase.nombre || 'Sin nombre', reason: 'Clase sin docente' });
            }
        });
        return issues;
    }, [classes]);

    const toggleJustified = async (asistencia: EnrichedAttendance) => {
        try {
            const newStatus = asistencia.estado === 'justificado' ? 'ausente' : 'justificado';
            await asistenciasService.update(asistencia.id, {
                estado: newStatus as Asistencia['estado'],
                justificacion: newStatus === 'justificado' ? 'Justificado vía WhatsApp' : ''
            });
            await loadData();
        } catch (err) {
            console.error('Error toggling justification:', err);
            showToast('error', 'No se pudo actualizar la justificación');
        }
    };

    const navigateToFix = (item: ContactDiagnosticItem) => {
        const params = new URLSearchParams({ search: item.name, source: 'attendance-diagnostics', diagId: item.id });
        if (item.entityType === 'student') navigate(`/students?${params.toString()}`);
        else if (item.classId) navigate(`/classes?${params.toString()}&edit=${item.classId}`);
        else navigate(`/contacts?${params.toString()}`);
    };

    return {
        loading, startDate, endDate, period, setPeriod, setStartDate, setEndDate,
        showHelp, setShowHelp, dismissHelpPermanently, setDismissHelpPermanently,
        dataContext, stats, criticalStudents, contactDiagnostics, integrityIssues,
        highlightDiagnostics, resolvedNotice, reviewingDiagnosticId,
        loadData, toggleJustified, navigateToFix, connectionStatus
    };
};
