import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Shield, CheckSquare, AlertTriangle, Users,
  FileText, HardDrive, ClipboardList, Database, Zap, Settings,
  BarChart3, BookOpen, SlidersHorizontal,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const nav = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Frameworks', icon: Shield, to: '/frameworks' },
  { label: 'Controls', icon: CheckSquare, to: '/controls' },
  { label: 'Risks', icon: AlertTriangle, to: '/risks' },
  { label: 'Evidence', icon: Database, to: '/evidence' },
  { label: 'Audits', icon: ClipboardList, to: '/audits' },
  { label: 'Vendors', icon: Users, to: '/vendors' },
  { label: 'Policies', icon: FileText, to: '/policies' },
  { label: 'Assets', icon: HardDrive, to: '/assets' },
  { label: 'Integrations', icon: Zap, to: '/integrations' },
  { label: 'Tech Profile', icon: SlidersHorizontal, to: '/profile' },
  { label: 'Reports', icon: BarChart3, to: '/reports' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900/80 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow-sm flex-shrink-0">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-100 leading-tight">TrustOps</div>
            <div className="text-xs text-slate-500 leading-tight">GRC Platform</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {nav.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(isActive ? 'sidebar-link-active' : 'sidebar-link')
            }
          >
            <Icon size={16} className="flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
            AC
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-200 truncate">Alex Chen</div>
            <div className="text-xs text-slate-500 truncate">Admin</div>
          </div>
          <Settings size={14} className="text-slate-500 flex-shrink-0" />
        </div>
      </div>
    </aside>
  );
}
