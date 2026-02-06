# Frontend Routes Map

> React Router configuration for the WhatsApp Bot Admin Dashboard

## Route Structure

```
/
├── /dashboard                    # Main dashboard
├── /attendance                   # Attendance module
│   └── /attendance/rules         # Attendance rules
├── /students                     # Students list
│   ├── /students/new             # New student form
│   └── /students/:id             # Student detail
│       └── /students/:id/edit    # Edit student
├── /classes                      # Class groups list
│   ├── /classes/new              # New class form
│   └── /classes/:id              # Class detail
│       └── /classes/:id/edit     # Edit class
├── /schedule                     # Schedule views
├── /events                       # Events calendar
│   ├── /events/new               # New event form
│   └── /events/:id               # Event detail
│       └── /events/:id/edit      # Edit event
├── /drafts                       # Draft messages
├── /tickets                      # Pending responses
│   └── /tickets/:id              # Ticket detail
├── /automations                  # Automations hub
│   └── /automations/absences     # Absence automations
├── /templates                    # Message templates
├── /contacts                     # Contact management
├── /teachers                     # Teacher management
├── /settings                     # App settings
└── /whatsapp                     # WhatsApp views
    ├── /whatsapp/chats           # All chats
    ├── /whatsapp/groups          # Groups
    └── /whatsapp/broadcast       # Broadcast
```

## Route Configuration

```tsx
// App.tsx routes configuration

import { Routes, Route, Navigate } from 'react-router-dom';
import {
  // Dashboard
  DashboardPage,
  
  // Attendance
  AttendancePage,
  AttendanceRulesPage,
  
  // Students
  StudentsPage,
  StudentFormPage,
  StudentDetailPage,
  
  // Classes
  ClassesPage,
  ClassFormPage,
  ClassDetailPage,
  
  // Schedule
  SchedulePage,
  
  // Events
  EventsPage,
  EventFormPage,
  EventDetailPage,
  
  // Drafts
  DraftsPage,
  
  // Tickets
  TicketsPage,
  TicketDetailPage,
  
  // Automations
  AutomationsAbsencesPage,
  
  // Config
  TemplatesPage,
  ContactsPage,
  TeachersPage,
  SettingsPage,
  
  // WhatsApp
  WhatsAppChatsPage,
  WhatsAppGroupsPage,
  WhatsAppBroadcastPage,
} from './pages';

function App() {
  return (
    <Routes>
      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      {/* Dashboard */}
      <Route path="/dashboard" element={<DashboardPage />} />
      
      {/* Attendance */}
      <Route path="/attendance" element={<AttendancePage />} />
      <Route path="/attendance/rules" element={<AttendanceRulesPage />} />
      
      {/* Students */}
      <Route path="/students" element={<StudentsPage />} />
      <Route path="/students/new" element={<StudentFormPage />} />
      <Route path="/students/:id" element={<StudentDetailPage />} />
      <Route path="/students/:id/edit" element={<StudentFormPage />} />
      
      {/* Classes */}
      <Route path="/classes" element={<ClassesPage />} />
      <Route path="/classes/new" element={<ClassFormPage />} />
      <Route path="/classes/:id" element={<ClassDetailPage />} />
      <Route path="/classes/:id/edit" element={<ClassFormPage />} />
      
      {/* Schedule */}
      <Route path="/schedule" element={<SchedulePage />} />
      
      {/* Events */}
      <Route path="/events" element={<EventsPage />} />
      <Route path="/events/new" element={<EventFormPage />} />
      <Route path="/events/:id" element={<EventDetailPage />} />
      <Route path="/events/:id/edit" element={<EventFormPage />} />
      
      {/* Drafts */}
      <Route path="/drafts" element={<DraftsPage />} />
      
      {/* Tickets */}
      <Route path="/tickets" element={<TicketsPage />} />
      <Route path="/tickets/:id" element={<TicketDetailPage />} />
      
      {/* Automations */}
      <Route path="/automations/absences" element={<AutomationsAbsencesPage />} />
      
      {/* Configuration */}
      <Route path="/templates" element={<TemplatesPage />} />
      <Route path="/contacts" element={<ContactsPage />} />
      <Route path="/teachers" element={<TeachersPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      
      {/* WhatsApp */}
      <Route path="/whatsapp/chats" element={<WhatsAppChatsPage />} />
      <Route path="/whatsapp/groups" element={<WhatsAppGroupsPage />} />
      <Route path="/whatsapp/broadcast" element={<WhatsAppBroadcastPage />} />
    </Routes>
  );
}
```

## Page Components to Create

### Priority 1: Core CRUD

| Page | File | Description |
|------|------|-------------|
| `StudentsPage` | `StudentsPage.tsx` | Student list with search/filter |
| `StudentFormPage` | `StudentFormPage.tsx` | Create/edit student form |
| `StudentDetailPage` | `StudentDetailPage.tsx` | Student detail view |
| `ClassesPage` | `ClassesPage.tsx` | Class groups list |
| `ClassFormPage` | `ClassFormPage.tsx` | Create/edit class form |
| `ClassDetailPage` | `ClassDetailPage.tsx` | Class detail with roster |
| `DraftsPage` | `DraftsPage.tsx` | Draft messages list |

### Priority 2: Attendance

| Page | File | Description |
|------|------|-------------|
| `AttendancePage` | `AttendancePage.tsx` | Daily attendance with tabs |
| `AttendanceRulesPage` | `AttendanceRulesPage.tsx` | Manage attendance rules |

### Priority 3: Events & Schedule

| Page | File | Description |
|------|------|-------------|
| `EventsPage` | `EventsPage.tsx` | Events calendar view |
| `EventFormPage` | `EventFormPage.tsx` | Create/edit event form |
| `EventDetailPage` | `EventDetailPage.tsx` | Event detail with reminders |
| `SchedulePage` | `SchedulePage.tsx` | Weekly schedule view |

### Priority 4: Tickets

| Page | File | Description |
|------|------|-------------|
| `TicketsPage` | `TicketsPage.tsx` | Pending responses list |
| `TicketDetailPage` | `TicketDetailPage.tsx` | Ticket with AI suggestion |

## Navigation Structure

### Sidebar Items

```tsx
const sidebarItems = [
  // Main
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  
  // Academic
  { label: 'Asistencias', path: '/attendance', icon: ClipboardCheck },
  { label: 'Alumnos', path: '/students', icon: GraduationCap },
  { label: 'Clases', path: '/classes', icon: BookOpen },
  { label: 'Horarios', path: '/schedule', icon: Calendar },
  
  // Communication
  { label: 'Eventos', path: '/events', icon: CalendarDays },
  { label: 'Borradores', path: '/drafts', icon: FileEdit },
  { label: 'Tickets', path: '/tickets', icon: MessageSquareWarning },
  
  // WhatsApp
  { label: 'Chats', path: '/whatsapp/chats', icon: MessageCircle },
  { label: 'Grupos', path: '/whatsapp/groups', icon: Users },
  { label: 'Difusión', path: '/whatsapp/broadcast', icon: Radio },
  
  // Config
  { label: 'Plantillas', path: '/templates', icon: FileText },
  { label: 'Contactos', path: '/contacts', icon: UserCheck },
  { label: 'Profesores', path: '/teachers', icon: Building2 },
  { label: 'Configuración', path: '/settings', icon: Settings },
];
```

### Dashboard Quick Actions

```tsx
const dashboardActions = [
  {
    label: 'Asistencias',
    description: 'Control diario',
    path: '/attendance',
    icon: ClipboardCheck,
    color: 'bg-blue-500',
  },
  {
    label: 'Alumnos',
    description: 'Registrar nuevos',
    path: '/students/new',
    icon: GraduationCap,
    color: 'bg-green-500',
  },
  {
    label: 'Clases',
    description: 'Gestionar clases',
    path: '/classes',
    icon: BookOpen,
    color: 'bg-purple-500',
  },
  {
    label: 'Horarios',
    description: 'Ver y editar',
    path: '/schedule',
    icon: Calendar,
    color: 'bg-orange-500',
  },
];
```

## State Management

### Global Store (Zustand)

```tsx
interface AppStore {
  // Current user/session
  user: User | null;
  isAuthenticated: boolean;
  
  // WhatsApp connection
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  qrCode: string | null;
  
  // Cached data
  students: Student[];
  classGroups: ClassGroup[];
  teachers: Teacher[];
  contacts: Contact[];
  
  // UI state
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  
  // Actions
  setStudents: (students: Student[]) => void;
  setClassGroups: (groups: ClassGroup[]) => void;
  // ...
}
```

### Local Page State

Each page manages its own:
- Loading states
- Error states
- Form data
- Pagination
- Filters

## API Integration Pattern

```tsx
// hooks/useStudents.ts
export const useStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAdminKey = () => 
    localStorage.getItem('ADMIN_API_KEY') || 'dev-admin-key-123';

  const loadStudents = async (filters?: StudentFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters as any);
      const response = await fetch(`${API_BASE}/students?${params}`, {
        headers: { 'x-admin-api-key': getAdminKey() }
      });
      const data = await response.json();
      if (data.success) {
        setStudents(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createStudent = async (student: CreateStudentRequest) => {
    const response = await fetch(`${API_BASE}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-api-key': getAdminKey()
      },
      body: JSON.stringify(student)
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error);
    }
    await loadStudents();
  };

  // Similar for update, delete...

  return { students, loading, error, loadStudents, createStudent };
};
```

## Shared Components

| Component | Description |
|-----------|-------------|
| `PageHeader` | Title, breadcrumb, actions |
| `DataTable` | Sortable, filterable table |
| `SearchInput` | Debounced search field |
| `FilterBar` | Filter dropdowns row |
| `FormModal` | Modal with form content |
| `ConfirmDialog` | Confirmation modal |
| `StatusBadge` | Colored status indicator |
| `LoadingSpinner` | Loading state |
| `EmptyState` | No data message |
| `ErrorAlert` | Error display |

## Implementation Order

### Week 1-2
1. ✅ DashboardPage (enhanced with new actions)
2. ✅ TemplatesPage
3. ✅ ContactsPage
4. ✅ TeachersPage
5. ⬜ StudentsPage + Form
6. ⬜ ClassesPage + Form
7. ⬜ DraftsPage

### Week 3-4
8. ⬜ AttendancePage
9. ⬜ AttendanceRulesPage
10. ⬜ EventsPage + Form
11. ⬜ SchedulePage

### Week 5+
12. ⬜ TicketsPage
13. ⬜ TicketDetailPage
14. ⬜ Dashboard Summary Integration
