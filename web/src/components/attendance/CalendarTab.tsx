import { useState, useEffect } from 'react';
import {
    Calendar as CalendarIcon, Clock, CheckCircle, AlertTriangle,
    X, Save, Plus, RefreshCw, Search
} from 'lucide-react';
import { AttendanceCalendar } from './AttendanceCalendar';
import {
    clasesService,
    getTeacherIds,
    asistenciasService,
    alumnosService,
    maestrosService,
    holidaysService,
    type Clase,
    type Asistencia,
    type Holiday
} from '../../services/firestore';
import { useAuth } from '../../contexts/AuthContext';

type ClassStatus = 'completed' | 'in-progress' | 'pending' | 'scheduled' | 'holiday';

interface DailyClass {
    id: string;
    name: string;
    teacherName: string;
    startTime: string;
    endTime: string;
    status: ClassStatus;
    attendanceCount: number;
    expectedCount: number;
    students: any[];
}

interface StudentAttendance {
    studentId: string;
    studentName: string;
    status: 'presente' | 'ausente' | 'tardanza' | 'justificado' | null;
    note?: string;
    hasRecord: boolean;
}

export const CalendarTab = () => {
    const { currentUser } = useAuth();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dailyClasses, setDailyClasses] = useState<DailyClass[]>([]);
    const [loading, setLoading] = useState(false);
    const [holidays, setHolidays] = useState<Holiday[]>([]);

    // Modal states
    const [showClassModal, setShowClassModal] = useState(false);
    const [selectedClass, setSelectedClass] = useState<DailyClass | null>(null);
    const [studentAttendance, setStudentAttendance] = useState<StudentAttendance[]>([]);
    const [saving, setSaving] = useState(false);

    // Holiday modal states
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [holidayName, setHolidayName] = useState('');
    const [holidayDescription, setHolidayDescription] = useState('');

    // Justification modal states
    const [showJustificationModal, setShowJustificationModal] = useState(false);
    const [justificationStudentId, setJustificationStudentId] = useState<string | null>(null);
    const [justificationReason, setJustificationReason] = useState('');

    // Search filter
    const [studentSearchQuery, setStudentSearchQuery] = useState('');

    useEffect(() => {
        loadDailySchedule();
        loadHolidays();
    }, [selectedDate]);

    const loadHolidays = async () => {
        try {
            const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

            const holidayList = await holidaysService.getByDateRange(
                startOfMonth.toISOString().split('T')[0],
                endOfMonth.toISOString().split('T')[0]
            );
            setHolidays(holidayList);
        } catch (error) {
            console.error('Error loading holidays:', error);
        }
    };

    const loadDailySchedule = async () => {
        setLoading(true);
        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][selectedDate.getDay()];

            // Check if it's a holiday
            const holiday = await holidaysService.getByDate(dateStr);
            if (holiday) {
                setDailyClasses([]);
                return;
            }

            // Get all classes
            const allClasses = await clasesService.getAllClases(true);

            // Filter classes for this day
            const todaysClasses = allClasses.filter((c: Clase) => {
                if (c.schedule?.slots) {
                    return c.schedule.slots.some((s: any) => s.day === dayName);
                }
                if (c.dias) return c.dias.includes(dayName);
                if (c.dia) return c.dia === dayName;
                if (c.fechas) return c.fechas.includes(dateStr);
                return false;
            });

            // Get attendance records for this date
            const attendanceRecords = await asistenciasService.getByDateRange(dateStr, dateStr);

            // Build daily class list with status
            const dailyClassList: DailyClass[] = await Promise.all(
                todaysClasses.map(async (c: Clase) => {
                    const classAttendance = attendanceRecords.filter(
                        (a: Asistencia) => a.clase_id === c.id
                    );

                    // Get students for this class - support all legacy field names
                    let students: any[] = [];
                    const studentIdList = c.studentIds || c.alumno_ids || c.alumnos || [];

                    if (studentIdList.length > 0) {
                        students = await Promise.all(
                            studentIdList.map(async (alumnoId: string) => {
                                try {
                                    return await alumnosService.getById(alumnoId);
                                } catch {
                                    return null;
                                }
                            })
                        );
                        students = students.filter(s => s !== null);
                    }

                    const expectedCount = students.length;
                    const attendanceCount = classAttendance.length;

                    // Determine class time
                    let startTime = '00:00';
                    let endTime = '00:00';
                    if (c.schedule?.slots) {
                        const slot = c.schedule.slots.find((s: any) => s.day === dayName);
                        if (slot) {
                            startTime = slot.startTime;
                            endTime = slot.endTime;
                        }
                    } else if (c.hora_inicio) {
                        startTime = c.hora_inicio;
                        endTime = c.hora_fin || '';
                    }

                    // Determine status
                    const now = new Date();
                    const classDateTime = new Date(`${dateStr}T${startTime}`);
                    let status: ClassStatus = 'scheduled';

                    if (classDateTime > now) {
                        status = 'scheduled';
                    } else if (attendanceCount === 0) {
                        status = 'pending';
                    } else if (attendanceCount < expectedCount) {
                        status = 'in-progress';
                    } else {
                        status = 'completed';
                    }

                    // Get teacher names - support multiple teachers
                    const teacherIds = getTeacherIds(c);
                    let teacherName = 'Sin asignar';

                    if (teacherIds.length > 0) {
                        const teacherNames = await Promise.all(
                            teacherIds.map(async (teacherId: string) => {
                                try {
                                    const teacher = await maestrosService.getById(teacherId);
                                    return teacher?.name || 'Desconocido';
                                } catch {
                                    return 'Desconocido';
                                }
                            })
                        );
                        teacherName = teacherNames.filter((n: string) => n !== 'Desconocido').join(', ') || 'Sin asignar';
                    }

                    return {
                        id: c.id!,
                        name: c.nombre || c.name || 'Sin nombre',
                        teacherName,
                        startTime,
                        endTime,
                        status,
                        attendanceCount,
                        expectedCount,
                        students
                    };
                })
            );

            // Sort by start time
            dailyClassList.sort((a, b) => a.startTime.localeCompare(b.startTime));
            setDailyClasses(dailyClassList);
        } catch (error) {
            console.error('Error loading daily schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClassClick = async (classItem: DailyClass) => {
        setSelectedClass(classItem);
        setShowClassModal(true);
        setStudentSearchQuery(''); // Reset search when opening modal

        // Load attendance for this class
        const dateStr = selectedDate.toISOString().split('T')[0];
        const attendanceRecords = await asistenciasService.getByDateRange(dateStr, dateStr);
        const classAttendance = attendanceRecords.filter(
            (a: Asistencia) => a.clase_id === classItem.id
        );

        // Build student attendance list
        const studentList: StudentAttendance[] = classItem.students.map(student => {
            const record = classAttendance.find(
                (a: Asistencia) => a.alumno_id === student.id
            );

            // Filter out 'pendiente' status as it's not valid for student attendance
            const validStatus = record?.estado && record.estado !== 'pendiente' ? record.estado : null;

            return {
                studentId: student.id!,
                studentName: `${student.nombre || student.firstName || ''} ${student.apellido || student.lastName || ''}`.trim(),
                status: validStatus,
                note: record?.observaciones,
                hasRecord: !!record
            };
        });

        setStudentAttendance(studentList);
    };

    const updateStudentStatus = (studentId: string, status: 'presente' | 'ausente' | 'tardanza' | 'justificado') => {
        if (status === 'justificado') {
            // Open justification modal
            setJustificationStudentId(studentId);
            setJustificationReason('');
            setShowJustificationModal(true);
        } else {
            // Update status directly for other statuses
            setStudentAttendance(prev =>
                prev.map(s =>
                    s.studentId === studentId ? { ...s, status } : s
                )
            );
        }
    };

    const confirmJustification = () => {
        if (!justificationStudentId || !justificationReason.trim()) {
            alert('Por favor ingresa el motivo de la justificación');
            return;
        }

        // Update status and note with justification
        setStudentAttendance(prev =>
            prev.map(s =>
                s.studentId === justificationStudentId
                    ? { ...s, status: 'justificado', note: justificationReason }
                    : s
            )
        );

        // Close modal and reset
        setShowJustificationModal(false);
        setJustificationStudentId(null);
        setJustificationReason('');
    };

    const updateStudentNote = (studentId: string, note: string) => {
        setStudentAttendance(prev =>
            prev.map(s =>
                s.studentId === studentId ? { ...s, note } : s
            )
        );
    };

    const saveClassAttendance = async () => {
        if (!selectedClass) return;

        setSaving(true);
        try {
            const dateStr = selectedDate.toISOString().split('T')[0];

            for (const student of studentAttendance) {
                if (!student.status) continue;

                const attendanceData: any = {
                    alumno_id: student.studentId,
                    alumno_nombre: student.studentName,
                    clase_id: selectedClass.id,
                    clase_nombre: selectedClass.name,
                    fecha: dateStr,
                    estado: student.status,
                    observaciones: student.note || '',
                    activo: true
                };

                if (student.hasRecord) {
                    // Find existing record and update
                    const existingRecords = await asistenciasService.getByDateRange(dateStr, dateStr);
                    const record = existingRecords.find(
                        (a: Asistencia) => a.clase_id === selectedClass.id && a.alumno_id === student.studentId
                    );
                    if (record) {
                        await asistenciasService.update(record.id!, attendanceData);
                    }
                } else {
                    // Create new record
                    await asistenciasService.create(attendanceData);
                }
            }

            alert('✅ Asistencia guardada correctamente');
            setShowClassModal(false);
            loadDailySchedule();
        } catch (error) {
            console.error('Error saving attendance:', error);
            alert('❌ Error al guardar asistencia');
        } finally {
            setSaving(false);
        }
    };

    const registerHoliday = async () => {
        if (!holidayName.trim()) {
            alert('Por favor ingresa un nombre para el feriado');
            return;
        }

        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            await holidaysService.create({
                fecha: dateStr,
                nombre: holidayName,
                descripcion: holidayDescription,
                creado_por: currentUser?.email || 'admin',
                creado_en: new Date(),
                activo: true
            });

            alert('✅ Feriado registrado correctamente');
            setShowHolidayModal(false);
            setHolidayName('');
            setHolidayDescription('');
            loadDailySchedule();
            loadHolidays();
        } catch (error) {
            console.error('Error registering holiday:', error);
            alert('❌ Error al registrar feriado');
        }
    };

    const getStatusIcon = (status: ClassStatus) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'in-progress':
                return <Clock className="w-5 h-5 text-yellow-500" />;
            case 'pending':
                return <AlertTriangle className="w-5 h-5 text-red-500" />;
            case 'scheduled':
                return <CalendarIcon className="w-5 h-5 text-blue-500" />;
            default:
                return null;
        }
    };

    const getStatusLabel = (status: ClassStatus) => {
        switch (status) {
            case 'completed':
                return 'Completada';
            case 'in-progress':
                return 'En Progreso';
            case 'pending':
                return 'Pendiente';
            case 'scheduled':
                return 'Programada';
            default:
                return '';
        }
    };

    const getStatusColor = (status: ClassStatus) => {
        switch (status) {
            case 'completed':
                return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
            case 'in-progress':
                return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
            case 'pending':
                return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
            case 'scheduled':
                return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
            default:
                return '';
        }
    };

    const dateStr = selectedDate.toISOString().split('T')[0];
    const isHoliday = holidays.some(h => h.fecha === dateStr);
    const todayHoliday = holidays.find(h => h.fecha === dateStr);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar Section */}
                <div className="lg:col-span-1">
                    <AttendanceCalendar
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                    />
                </div>

                {/* Daily Schedule Section */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm">
                        <div className="p-4 border-b dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                        <CalendarIcon className="w-5 h-5 text-indigo-500" />
                                        Agenda: {selectedDate.toLocaleDateString('es-ES', {
                                            weekday: 'long',
                                            day: 'numeric',
                                            month: 'long'
                                        })}
                                    </h3>
                                    {isHoliday && (
                                        <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-1">
                                            🎉 {todayHoliday?.nombre}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowHolidayModal(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium"
                                >
                                    <Plus className="w-4 h-4" />
                                    Registrar Feriado
                                </button>
                            </div>
                        </div>

                        <div className="p-4">
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                                </div>
                            ) : isHoliday ? (
                                <div className="text-center py-12">
                                    <CalendarIcon className="w-16 h-16 text-indigo-300 mx-auto mb-4" />
                                    <h4 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                                        Día Feriado
                                    </h4>
                                    <p className="text-gray-500 dark:text-gray-400">
                                        No hay clases programadas para este día
                                    </p>
                                </div>
                            ) : dailyClasses.length === 0 ? (
                                <div className="text-center py-12">
                                    <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h4 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                                        Sin clases programadas
                                    </h4>
                                    <p className="text-gray-500 dark:text-gray-400">
                                        No hay clases para este día
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {dailyClasses.map(classItem => (
                                        <button
                                            key={classItem.id}
                                            onClick={() => handleClassClick(classItem)}
                                            className={`w-full p-4 rounded-lg border-2 ${getStatusColor(classItem.status)} hover:shadow-md transition-all text-left`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {getStatusIcon(classItem.status)}
                                                    <div>
                                                        <h4 className="font-semibold text-gray-800 dark:text-gray-100">
                                                            {classItem.name}
                                                        </h4>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            {classItem.teacherName} • {classItem.startTime} - {classItem.endTime}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs font-bold text-gray-400 uppercase">
                                                        {getStatusLabel(classItem.status)}
                                                    </span>
                                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                                        {classItem.attendanceCount}/{classItem.expectedCount} registrados
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Class Detail Modal - Redesigned */}
            {showClassModal && selectedClass && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
                        {/* Header */}
                        <div className="relative p-8 border-b dark:border-gray-700 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
                            <div className="absolute inset-0 bg-black/10"></div>
                            <div className="relative flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                                            <CalendarIcon className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-white drop-shadow-lg">
                                                {selectedClass.name}
                                            </h3>
                                            <p className="text-white/90 text-sm font-medium mt-1 flex items-center gap-2">
                                                <Clock className="w-4 h-4" />
                                                {selectedClass.teacherName} • {selectedClass.startTime} - {selectedClass.endTime}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-4">
                                        <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
                                            <span className="text-white font-bold text-sm">
                                                {studentAttendance.length} Alumnos
                                            </span>
                                        </div>
                                        <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
                                            <span className="text-white font-bold text-sm">
                                                {selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowClassModal(false)}
                                    className="relative p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl transition-all hover:scale-110 active:scale-95"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Student List */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-800/50">
                            <div className="max-w-3xl mx-auto space-y-4">
                                {/* Search Input */}
                                <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/50 pb-4">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar alumno por nombre..."
                                            value={studentSearchQuery}
                                            onChange={(e) => setStudentSearchQuery(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm"
                                        />
                                        {studentSearchQuery && (
                                            <button
                                                onClick={() => setStudentSearchQuery('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                            >
                                                <X className="w-4 h-4 text-gray-400" />
                                            </button>
                                        )}
                                    </div>
                                    {studentSearchQuery && (
                                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                            Mostrando {studentAttendance.filter(s =>
                                                s.studentName.toLowerCase().includes(studentSearchQuery.toLowerCase())
                                            ).length} de {studentAttendance.length} alumnos
                                        </p>
                                    )}
                                </div>

                                {/* Student Cards */}
                                {studentAttendance
                                    .filter(student =>
                                        student.studentName.toLowerCase().includes(studentSearchQuery.toLowerCase())
                                    )
                                    .map((student, index) => (
                                        <div
                                            key={student.studentId}
                                            className="group bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-200 overflow-hidden shadow-sm hover:shadow-lg"
                                        >
                                            <div className="p-5">
                                                {/* Student Header */}
                                                <div className="flex items-center gap-4 mb-4">
                                                    <div className="relative">
                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                                            {student.studentName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center border-2 border-gray-200 dark:border-gray-700">
                                                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                                                                {index + 1}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                                                            {student.studentName}
                                                        </h4>
                                                        {student.hasRecord && (
                                                            <span className="inline-flex items-center gap-1 mt-1 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full font-semibold">
                                                                <CheckCircle className="w-3 h-3" />
                                                                Ya registrado
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Status Buttons */}
                                                <div className="grid grid-cols-4 gap-2 mb-3">
                                                    {(['presente', 'ausente', 'tardanza', 'justificado'] as const).map(status => {
                                                        const isSelected = student.status === status;
                                                        const statusConfig = {
                                                            presente: {
                                                                label: 'Presente',
                                                                icon: CheckCircle,
                                                                activeClass: 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/50',
                                                                inactiveClass: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400'
                                                            },
                                                            ausente: {
                                                                label: 'Ausente',
                                                                icon: X,
                                                                activeClass: 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/50',
                                                                inactiveClass: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400'
                                                            },
                                                            tardanza: {
                                                                label: 'Tardanza',
                                                                icon: Clock,
                                                                activeClass: 'bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-lg shadow-yellow-500/50',
                                                                inactiveClass: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:text-yellow-600 dark:hover:text-yellow-400'
                                                            },
                                                            justificado: {
                                                                label: 'Justificado',
                                                                icon: AlertTriangle,
                                                                activeClass: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/50',
                                                                inactiveClass: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400'
                                                            }
                                                        };

                                                        const config = statusConfig[status];
                                                        const Icon = config.icon;

                                                        return (
                                                            <button
                                                                key={status}
                                                                onClick={() => updateStudentStatus(student.studentId, status)}
                                                                className={`flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl font-bold text-xs transition-all duration-200 ${isSelected ? config.activeClass : config.inactiveClass
                                                                    } ${isSelected ? 'scale-105 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800' : 'hover:scale-105'}`}
                                                            >
                                                                <Icon className="w-4 h-4" />
                                                                <span>{config.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {/* Notes Input */}
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Agregar observación..."
                                                        value={student.note || ''}
                                                        onChange={(e) => updateStudentNote(student.studentId, e.target.value)}
                                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t dark:border-gray-700 bg-white dark:bg-gray-900 flex gap-4">
                            <button
                                onClick={() => setShowClassModal(false)}
                                className="flex-1 px-6 py-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all hover:scale-105 active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveClassAttendance}
                                disabled={saving}
                                className="flex-1 px-6 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 active:scale-95"
                            >
                                {saving ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        <span>Guardando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        <span>Guardar Cambios</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Holiday Registration Modal */}
            {showHolidayModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="p-6 border-b dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                                    Registrar Feriado
                                </h3>
                                <button
                                    onClick={() => setShowHolidayModal(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Fecha
                                </label>
                                <input
                                    type="text"
                                    value={selectedDate.toLocaleDateString('es-ES', {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric'
                                    })}
                                    disabled
                                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Nombre del Feriado *
                                </label>
                                <input
                                    type="text"
                                    value={holidayName}
                                    onChange={(e) => setHolidayName(e.target.value)}
                                    placeholder="Ej: Día de la Independencia"
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Descripción (opcional)
                                </label>
                                <textarea
                                    value={holidayDescription}
                                    onChange={(e) => setHolidayDescription(e.target.value)}
                                    placeholder="Detalles adicionales..."
                                    rows={3}
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
                            <button
                                onClick={() => setShowHolidayModal(false)}
                                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={registerHoliday}
                                className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                Registrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Justification Modal */}
            {showJustificationModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 dark:border-gray-700">
                        {/* Header */}
                        <div className="relative p-6 border-b dark:border-gray-700 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500">
                            <div className="absolute inset-0 bg-black/10"></div>
                            <div className="relative flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                                        <AlertTriangle className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white drop-shadow-lg">
                                            Justificar Ausencia
                                        </h3>
                                        <p className="text-white/90 text-sm font-medium mt-0.5">
                                            Ingresa el motivo de la justificación
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowJustificationModal(false);
                                        setJustificationStudentId(null);
                                        setJustificationReason('');
                                    }}
                                    className="relative p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl transition-all hover:scale-110 active:scale-95"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                                    Motivo de la Justificación *
                                </label>
                                <textarea
                                    value={justificationReason}
                                    onChange={(e) => setJustificationReason(e.target.value)}
                                    placeholder="Ej: Cita médica, enfermedad, emergencia familiar..."
                                    rows={4}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                    autoFocus
                                />
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    Esta información se guardará en las observaciones del alumno
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex gap-4">
                            <button
                                onClick={() => {
                                    setShowJustificationModal(false);
                                    setJustificationStudentId(null);
                                    setJustificationReason('');
                                }}
                                className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all hover:scale-105 active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmJustification}
                                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 active:scale-95"
                            >
                                <CheckCircle className="w-5 h-5" />
                                <span>Confirmar Justificación</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
