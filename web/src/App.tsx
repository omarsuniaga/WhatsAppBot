import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import { useSocket } from './hooks/useSocket'
import { AdminLayout } from './layouts/AdminLayout'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { WhatsAppProtectedRoute } from './components/WhatsAppProtectedRoute'
import { GlobalSocketListener } from './components/common/GlobalSocketListener'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import {
  DashboardPage,
  KnowledgePage,
  KnowledgeBasePage,
  TicketsPage,
  BroadcastPage,
  SettingsPage,
  WhatsAppChatsPage,
  WhatsAppGroupsPage,
  WhatsAppBroadcastPage,
  AutomationsAbsencesPage,
  TemplatesPage,
  ContactsPage,
  TeachersPage,
  AttendancePage,
  AttendanceControlPage,
  StudentsPage,
  ClassesPage,
  SchedulePage,
  RoomsPage,
  AttendanceAlertsPage,
  FirestoreDiagnosticPage,
  ConflictResolutionPage,
  GuidedFlowsPage,
  AppointmentsPage,
  FollowUpsPage
} from './pages'
import { aiApi } from './api/client'

function App() {
  useSocket()
  const { connectionStatus } = useStore()

  useEffect(() => {
    // Sync API Key from localStorage if exists
    const syncApiKey = async () => {
      const savedKey = localStorage.getItem('GEMINI_API_KEY');
      if (savedKey) {
        try {
          await aiApi.updateConfig(savedKey);
          console.log('AI Config synced from storage');
        } catch (error) {
          console.error('Failed to sync AI config:', error);
        }
      }
    };

    if (connectionStatus === 'connected') {
      syncApiKey();
    }
  }, [connectionStatus]);

  useEffect(() => {
    document.title = connectionStatus === 'connected'
      ? 'WhatsApp Bot - Connected'
      : 'WhatsApp Bot - Disconnected'
  }, [connectionStatus])

  return (
    <AuthProvider>
      <GlobalSocketListener />
      <Routes>
        {/* Public Routes - Authentication */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes - Require Firebase Auth */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Admin Layout - All routes require Firebase Auth */}
        <Route element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }>
          {/* Dashboard - No requiere WhatsApp */}
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* WhatsApp Module Routes - REQUIEREN WhatsApp conectado */}
          <Route path="/whatsapp" element={<Navigate to="/whatsapp/chats" replace />} />
          <Route path="/whatsapp/chats" element={
            <WhatsAppProtectedRoute>
              <WhatsAppChatsPage />
            </WhatsAppProtectedRoute>
          } />
          <Route path="/whatsapp/groups" element={
            <WhatsAppProtectedRoute>
              <WhatsAppGroupsPage />
            </WhatsAppProtectedRoute>
          } />
          <Route path="/whatsapp/broadcast" element={
            <WhatsAppProtectedRoute>
              <WhatsAppBroadcastPage />
            </WhatsAppProtectedRoute>
          } />

          {/* Admin Panels - No requieren WhatsApp */}
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/kb" element={<KnowledgeBasePage />} />
          <Route path="/guided-flows" element={<GuidedFlowsPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/follow-ups" element={<FollowUpsPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/broadcast" element={<BroadcastPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Automations & Institutional - No requieren WhatsApp */}
          <Route path="/automations/absences" element={<AutomationsAbsencesPage />} />
          <Route path="/automations/alerts" element={<AttendanceAlertsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/teachers" element={<TeachersPage />} />

          {/* Institutional Management - No requieren WhatsApp */}
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/attendance/control" element={<AttendanceControlPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/schedule/conflicts" element={<ConflictResolutionPage />} />
          <Route path="/schedules" element={<SchedulePage />} />
          <Route path="/diagnostic" element={<FirestoreDiagnosticPage />} />
        </Route>

        {/* Catch-all redirect to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
