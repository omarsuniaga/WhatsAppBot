import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { asistenciasService } from '../../services/firestore';
import './AttendanceCalendar.css';

interface AttendanceCalendarProps {
    onDateSelect?: (date: Date) => void;
    selectedDate?: Date;
    className?: string;
}

export const AttendanceCalendar = ({ onDateSelect, selectedDate, className = '' }: AttendanceCalendarProps) => {
    const [attendanceDates, setAttendanceDates] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [value, setValue] = useState<Date>(selectedDate || new Date());

    useEffect(() => {
        loadAttendanceDates();
    }, []);

    useEffect(() => {
        if (selectedDate) {
            setValue(selectedDate);
        }
    }, [selectedDate]);

    const loadAttendanceDates = async () => {
        try {
            setLoading(true);
            // Load all attendance records
            const records = await asistenciasService.getAll();

            // Extract unique dates
            const dates = new Set(records.map(r => r.fecha));
            setAttendanceDates(dates);
        } catch (error) {
            console.error('Error loading attendance dates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (newValue: Date | Date[] | null) => {
        // react-calendar can return Date, Date[], or null
        // We normalize it to a single Date
        let selectedDate: Date | null = null;
        
        if (newValue) {
            if (Array.isArray(newValue)) {
                selectedDate = newValue[0] || null;
            } else {
                selectedDate = newValue;
            }
        }

        if (selectedDate) {
            setValue(selectedDate);
            onDateSelect?.(selectedDate);
        }
    };

    const tileContent = ({ date, view }: { date: Date; view: string }) => {
        if (view === 'month') {
            const dateStr = date.toISOString().split('T')[0];

            if (attendanceDates.has(dateStr)) {
                return (
                    <div className="attendance-indicator-wrapper">
                        <div className="attendance-indicator" />
                    </div>
                );
            }
        }
        return null;
    };

    const tileClassName = ({ date, view }: { date: Date; view: string }) => {
        if (view === 'month') {
            const dateStr = date.toISOString().split('T')[0];

            if (attendanceDates.has(dateStr)) {
                return 'has-attendance';
            }
        }
        return '';
    };

    return (
        <div className={`attendance-calendar-container ${className}`}>
            {loading && (
                <div className="calendar-loading-overlay">
                    <div className="loading-spinner" />
                </div>
            )}
            <Calendar
                onChange={handleDateChange as any}
                value={value}
                tileContent={tileContent}
                tileClassName={tileClassName}
                locale="es-ES"
                className="attendance-calendar"
            />
            {attendanceDates.size > 0 && (
                <div className="calendar-legend">
                    <div className="legend-item">
                        <div className="legend-dot" />
                        <span>Días con asistencias registradas</span>
                    </div>
                </div>
            )}
        </div>
    );
};
