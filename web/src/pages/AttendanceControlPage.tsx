import { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { messageApi } from '../api/client';

// Local Imports
import { useAttendanceData } from './AttendanceControl/hooks/useAttendanceData';
import { useAttendanceTemplates } from './AttendanceControl/hooks/useAttendanceTemplates';
import { MetricsGrid } from './AttendanceControl/components/MetricsGrid';
import { CriticalStudentsList } from './AttendanceControl/components/CriticalStudentsList';
import { TemplateEditor } from './AttendanceControl/components/TemplateEditor';
import { DiagnosticPanels } from './AttendanceControl/components/DiagnosticPanels';
import { PendingReports } from './AttendanceControl/components/PendingReports';
import { ObservationFeed } from './AttendanceControl/components/ObservationFeed';
import { AttendanceHeader } from './AttendanceControl/components/AttendanceHeader';
import { HelpModal } from './AttendanceControl/components/HelpModal';
import { type CriticalStudent, type PendingClass, type EnrichedAttendance } from './AttendanceControl/types';
import { todayISO } from './AttendanceControl/utils';
import { AttendanceTemplate } from '../components/attendance/AttendanceTemplate';

export const AttendanceControlPage = () => {
    const contactDiagnosticsRef = useRef<HTMLDivElement | null>(null);
    const [printingSession, setPrintingSession] = useState<{
        date: string;
        className: string;
        teacherName: string;
        roomName: string;
        scheduleTime: string;
        attendances: EnrichedAttendance[];
    } | null>(null);

    // Hooks
    const {
        loading, startDate, endDate, period, setPeriod, setStartDate, setEndDate,
        showHelp, setShowHelp, dismissHelpPermanently, setDismissHelpPermanently,
        dataContext, stats, criticalStudents, contactDiagnostics, integrityIssues,
        highlightDiagnostics, resolvedNotice, reviewingDiagnosticId,
        loadData, toggleJustified, navigateToFix, connectionStatus
    } = useAttendanceData(() => { });

    const {
        messageTemplates, templateDraft, setTemplateDraft,
        templateEditorAction, setTemplateEditorAction,
        templateSaving, templateResetting, templatesLoading,
        templateHistory, historyLoading,
        saveTemplateConfig, resetTemplateConfig, renderMessageTemplate
    } = useAttendanceTemplates(() => { });

    // Actions
    const handleAlertParent = async (student: CriticalStudent) => {
        if (!student.parentJid) return;
        const message = renderMessageTemplate('parent_absence_alert', {
            student_name: student.name,
            absences: student.absences
        });
        if (message) {
            await messageApi.sendText(student.parentJid, message);
        }
    };

    const handleRemindTeacher = async (pending: PendingClass) => {
        if (!pending.teacherJid) return;
        const message = renderMessageTemplate('teacher_reminder', {
            teacher_name: pending.teacher,
            class_name: pending.name,
            date: startDate
        });
        if (message) {
            await messageApi.sendText(pending.teacherJid, message);
        }
    };

    const exportToCSV = () => {
        const headers = ['Fecha', 'Clase', 'Alumno', 'Docente', 'Estado', 'Observaciones'];
        const rows = dataContext.enrichedAttendances.map(a => [
            a.fecha, a.className, a.studentName, a.teacherName, a.estado, a.observaciones || ''
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `reporte_asistencia_${startDate}_${endDate}.csv`;
        link.click();
    };

    const exportIntegrityCSV = () => {
        const headers = ['Severidad', 'Tipo', 'Clase', 'Docente', 'Motivo'];
        const rows = integrityIssues.map(i => [i.severity, i.type, i.className, i.teacherName || '', i.reason]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `integridad_relacional_${todayISO()}.csv`;
        link.click();
    };

    const handleExportPdf = () => {
        // Find a representative session from dataContext (e.g. the first one with observations or any)
        if (dataContext.enrichedAttendances.length === 0) {
            alert('No hay datos para exportar');
            return;
        }

        // For now, let's take the first session found in the current view
        const first = dataContext.enrichedAttendances[0];
        const sessionAttendances = dataContext.enrichedAttendances.filter(
            a => a.clase_id === first.clase_id && a.fecha === first.fecha
        );

        // Find the class object to get room and schedule
        const clase = dataContext.classById.get(first.clase_id);
        const roomName = clase?.salon_nombre || '';
        const scheduleTime = clase?.hora_inicio ? `${clase.hora_inicio} - ${clase.hora_fin}` : '';

        setPrintingSession({
            date: first.fecha,
            className: first.className,
            teacherName: first.teacherName,
            roomName,
            scheduleTime,
            attendances: sessionAttendances
        });

        // Small delay to ensure render before print
        setTimeout(() => {
            window.print();
            setPrintingSession(null);
        }, 300);
    };

    if (loading && dataContext.enrichedAttendances.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <RefreshCw className="w-10 h-10 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

                <AttendanceHeader
                    period={period}
                    setPeriod={setPeriod}
                    onShowHelp={() => setShowHelp(true)}
                />

                {showHelp && (
                    <HelpModal
                        onClose={() => setShowHelp(false)}
                        dismissHelpPermanently={dismissHelpPermanently}
                        setDismissHelpPermanently={setDismissHelpPermanently}
                    />
                )}

                {period === 'custom' && (
                    <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-50 dark:bg-gray-700 border rounded px-2 py-1 text-sm" />
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gray-50 dark:bg-gray-700 border rounded px-2 py-1 text-sm" />
                        <button onClick={loadData} className="ml-auto p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                )}

                <MetricsGrid stats={stats} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-6">
                        <CriticalStudentsList
                            students={criticalStudents}
                            actionLoading={null}
                            onAlertParent={handleAlertParent}
                            onExportCSV={exportToCSV}
                            onExportPdf={handleExportPdf}
                        />

                        <TemplateEditor
                            templateEditorAction={templateEditorAction}
                            setTemplateEditorAction={setTemplateEditorAction}
                            templateDraft={templateDraft}
                            setTemplateDraft={setTemplateDraft}
                            messageTemplates={messageTemplates as any}
                            templatesLoading={templatesLoading}
                            templateSaving={templateSaving}
                            templateResetting={templateResetting}
                            templateHistory={templateHistory}
                            historyLoading={historyLoading}
                            onSave={() => saveTemplateConfig([])}
                            onReset={resetTemplateConfig}
                        />

                        <div ref={contactDiagnosticsRef}>
                            <DiagnosticPanels
                                contactDiagnostics={contactDiagnostics}
                                integrityIssues={integrityIssues}
                                highlightDiagnostics={highlightDiagnostics}
                                resolvedNotice={resolvedNotice}
                                reviewingDiagnosticId={reviewingDiagnosticId}
                                onNavigateFix={navigateToFix}
                                onExportIntegrityCSV={exportIntegrityCSV}
                                onNavigateClass={() => { }}
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        <PendingReports
                            pendingList={stats.pendingList}
                            actionLoading={null}
                            onRemindTeacher={handleRemindTeacher}
                            connectionStatus={connectionStatus}
                        />
                        <ObservationFeed
                            attendances={dataContext.enrichedAttendances}
                            onToggleJustified={toggleJustified}
                            onExportPdf={handleExportPdf}
                        />
                    </div>
                </div>

                {/* Print Template (Hidden unless printing) */}
                {printingSession && (
                    <div className="hidden print:block">
                        <AttendanceTemplate {...printingSession} />
                    </div>
                )}
            </div>
        </div>
    );
};
