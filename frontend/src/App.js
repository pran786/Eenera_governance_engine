import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/AppLayout';
import { Toaster } from '@/components/ui/sonner';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ObligationMappingPage from '@/pages/ObligationMappingPage';
import GapsTasksPage from '@/pages/GapsTasksPage';
import EvidencePackPage from '@/pages/EvidencePackPage';
import FrameworkManagementPage from '@/pages/FrameworkManagementPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/obligations" element={<ProtectedRoute><ObligationMappingPage /></ProtectedRoute>} />
      <Route path="/gaps-tasks" element={<ProtectedRoute><GapsTasksPage /></ProtectedRoute>} />
      <Route path="/evidence-pack" element={<ProtectedRoute><EvidencePackPage /></ProtectedRoute>} />
      <Route path="/frameworks" element={<ProtectedRoute><FrameworkManagementPage /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
