import { Bell, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/frameworks': 'Compliance Frameworks',
  '/controls': 'Control Library',
  '/risks': 'Risk Register',
  '/evidence': 'Evidence Management',
  '/audits': 'Audit Management',
  '/vendors': 'Vendor Management',
  '/policies': 'Policy Management',
  '/assets': 'Asset Inventory',
  '/integrations': 'Integrations',
  '/profile': 'Technical Profile',
  '/reports': 'Reports & Analytics',
};

export default function TopBar() {
  const location = useLocation();
  const base = '/' + location.pathname.split('/')[1];
  const title = titles[base] || 'TrustOps';

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center px-6 gap-4 flex-shrink-0">
      <h1 className="text-base font-semibold text-slate-100 mr-auto">{title}</h1>

      <div className="relative hidden md:flex items-center">
        <Search size={14} className="absolute left-3 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search..."
          className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500 w-48"
        />
      </div>

      <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
        <Bell size={16} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
      </button>
    </header>
  );
}
