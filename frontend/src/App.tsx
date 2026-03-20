import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Frameworks from './pages/Frameworks';
import FrameworkDetail from './pages/FrameworkDetail';
import Controls from './pages/Controls';
import ControlDetail from './pages/ControlDetail';
import Risks from './pages/Risks';
import Vendors from './pages/Vendors';
import Policies from './pages/Policies';
import Assets from './pages/Assets';
import Audits from './pages/Audits';
import AuditDetail from './pages/AuditDetail';
import Evidence from './pages/Evidence';
import Integrations from './pages/Integrations';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import Systems from './pages/Systems';
import SystemDetail from './pages/SystemDetail';
import SecurityCategorization from './pages/SecurityCategorization';
import BusinessProfile from './pages/BusinessProfile';
import AuditTrail from './pages/AuditTrail';
import RolesPermissions from './pages/RolesPermissions';
import ATOPackages from './pages/ATOPackages';
import ATOPackageDetail from './pages/ATOPackageDetail';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="frameworks" element={<Frameworks />} />
        <Route path="frameworks/:id" element={<FrameworkDetail />} />
        <Route path="controls" element={<Controls />} />
        <Route path="controls/:id" element={<ControlDetail />} />
        <Route path="risks" element={<Risks />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="policies" element={<Policies />} />
        <Route path="assets" element={<Assets />} />
        <Route path="audits" element={<Audits />} />
        <Route path="audits/:id" element={<AuditDetail />} />
        <Route path="evidence" element={<Evidence />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="profile" element={<Profile />} />
        <Route path="reports" element={<Reports />} />
        <Route path="systems" element={<Systems />} />
        <Route path="systems/:id" element={<SystemDetail />} />
        <Route path="categorization" element={<SecurityCategorization />} />
        <Route path="business-profile" element={<BusinessProfile />} />
        <Route path="audit-trail" element={<AuditTrail />} />
        <Route path="roles" element={<RolesPermissions />} />
        <Route path="ato" element={<ATOPackages />} />
        <Route path="ato/:id" element={<ATOPackageDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
