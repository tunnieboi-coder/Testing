import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
