import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { LayoutDashboard, Scale, AlertCircle, FileText, Settings, Upload, LogOut, ChevronDown, Shield } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/obligations', icon: Scale, label: 'Obligations' },
  { to: '/gaps-tasks', icon: AlertCircle, label: 'Gaps & Tasks' },
  { to: '/evidence-pack', icon: FileText, label: 'Evidence Pack' },
  { to: '/frameworks', icon: Upload, label: 'Frameworks' },
];

export function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden" data-testid="app-layout">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0B1F3B] text-white flex flex-col flex-shrink-0" data-testid="app-sidebar">
        <div className="h-14 flex items-center px-5 gap-2.5">
          <Shield className="w-6 h-6 text-[#1E4FFF]" />
          <span className="font-heading text-lg font-bold tracking-tight">Eenera</span>
        </div>
        <Separator className="bg-white/10" />
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={({ isActive }) =>
                `sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
                  isActive
                    ? 'bg-[#1E4FFF]/15 text-white font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3">
          <div className="bg-white/5 rounded-md p-3 text-xs text-slate-400">
            <div className="font-medium text-slate-300 mb-1">UK ICO / GDPR</div>
            <div>Version 1.0</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0" data-testid="app-header">
          <div className="text-sm text-slate-500">
            Governance Assessment Engine
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 text-sm font-medium text-slate-700" data-testid="user-menu-trigger">
                <div className="w-7 h-7 bg-[#1E4FFF] rounded-full flex items-center justify-center text-white text-xs font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                {user?.name || 'User'}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5 text-xs text-slate-500">{user?.email}</div>
              <div className="px-2 py-1 text-xs font-medium text-[#1E4FFF] capitalize">{user?.role}</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="logout-btn" className="text-red-600 cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-[#F4F6FA] p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
