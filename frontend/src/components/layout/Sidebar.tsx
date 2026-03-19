import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Shield, CheckSquare, AlertTriangle, Users,
  FileText, HardDrive, ClipboardList, Database, Zap, Settings,
  BarChart3, SlidersHorizontal, Server, FolderLock, Briefcase, History,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSystemStore } from '../../store/systemStore';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface GRCSystem { id: string; name: string; impact_level: string; }

const primaryNav = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Frameworks', icon: Shield, to: '/frameworks' },
  { label: 'Controls', icon: CheckSquare, to: '/controls' },
  { label: 'Risks', icon: AlertTriangle, to: '/risks' },
  { label: 'Evidence', icon: Database, to: '/evidence' },
  { label: 'Audits', icon: ClipboardList, to: '/audits' },
];

const secondaryNav = [
  { label: 'Vendors', icon: Users, to: '/vendors' },
  { label: 'Policies', icon: FileText, to: '/policies' },
  { label: 'Assets', icon: HardDrive, to: '/assets' },
  { label: 'Integrations', icon: Zap, to: '/integrations' },
  { label: 'Tech Profile', icon: SlidersHorizontal, to: '/profile' },
  { label: 'Business Profile', icon: Briefcase, to: '/business-profile' },
  { label: 'Audit Trail', icon: History, to: '/audit-trail' },
  { label: 'Reports', icon: BarChart3, to: '/reports' },
];

const IMPACT_COLOR: Record<string, string> = {
  Low: 'bg-emerald-500',
  Moderate: 'bg-amber-500',
  High: 'bg-red-500',
};

export default function Sidebar() {
  const { currentSystemId, setCurrentSystem } = useSystemStore();
  const [systemSelectorOpen, setSystemSelectorOpen] = useState(false);
  const { user } = useAuth();
  const initials = user?.name
    ? user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const { data: systems = [] } = useQuery<GRCSystem[]>({
    queryKey: ['systems'],
    queryFn: () => api.get('/systems'),
  });

  const currentSystem = systems.find(s => s.id === currentSystemId);

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

      {/* System Selector */}
      <div className="px-3 pt-3">
        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1 px-1">Active System</div>
        <div className="relative">
          <button
            onClick={() => setSystemSelectorOpen(!systemSelectorOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:border-slate-600 transition-colors text-left"
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${currentSystem ? (IMPACT_COLOR[currentSystem.impact_level] || 'bg-slate-600') : 'bg-slate-600'}`} />
            <span className="text-xs text-slate-300 flex-1 truncate">
              {currentSystem?.name || 'No system selected'}
            </span>
            {systemSelectorOpen ? <ChevronDown size={12} className="text-slate-500 flex-shrink-0" /> : <ChevronRight size={12} className="text-slate-500 flex-shrink-0" />}
          </button>

          {systemSelectorOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden">
              {systems.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setCurrentSystem(s.id); setSystemSelectorOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800 transition-colors ${s.id === currentSystemId ? 'bg-primary-900/30' : ''}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${IMPACT_COLOR[s.impact_level] || 'bg-slate-600'}`} />
                  <span className="text-xs text-slate-300 truncate">{s.name}</span>
                </button>
              ))}
              <div className="border-t border-slate-800">
                <NavLink
                  to="/systems"
                  onClick={() => setSystemSelectorOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-primary-400 hover:bg-slate-800 transition-colors"
                >
                  <Server size={11} /> Manage Systems
                </NavLink>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {primaryNav.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(isActive ? 'sidebar-link-active' : 'sidebar-link')}
          >
            <Icon size={16} className="flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}

        {/* Systems section */}
        <div className="pt-3 pb-1">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1 px-2">Assessment</div>
        </div>
        <NavLink to="/systems" className={({ isActive }) => cn(isActive ? 'sidebar-link-active' : 'sidebar-link')}>
          <Server size={16} className="flex-shrink-0" />
          <span>Systems</span>
        </NavLink>
        <NavLink to="/categorization" className={({ isActive }) => cn(isActive ? 'sidebar-link-active' : 'sidebar-link')}>
          <FolderLock size={16} className="flex-shrink-0" />
          <span>Categorization</span>
        </NavLink>

        <div className="pt-3 pb-1">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1 px-2">Management</div>
        </div>
        {secondaryNav.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(isActive ? 'sidebar-link-active' : 'sidebar-link')}
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
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-200 truncate">{user?.name ?? '—'}</div>
            <div className="text-xs text-slate-500 truncate capitalize">{user?.role?.replace('_', ' ') ?? ''}</div>
          </div>
          <Settings size={14} className="text-slate-500 flex-shrink-0" />
        </div>
      </div>
    </aside>
  );
}
