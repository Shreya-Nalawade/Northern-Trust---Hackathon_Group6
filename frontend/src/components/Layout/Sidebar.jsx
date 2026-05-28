import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  UserCheck,
  Activity,
  Workflow,
  Sun,
  Moon,
} from 'lucide-react';
import socket from '../../api/socket';
import { useTheme } from '../../hooks/useTheme';

export function Sidebar() {
  const [connected, setConnected] = useState(socket.connected);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/approvals', icon: UserCheck, label: 'Approvals' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          <Workflow size={16} />
        </div>
        <div className="sidebar__brand-text">
          <span className="sidebar__brand-name">Orchestrator</span>
          <span className="sidebar__brand-sub">Workflow Engine</span>
        </div>
      </div>

      <nav className="sidebar__nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
            end={to === '/'}
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <button className="sidebar__theme-toggle" onClick={toggle}>
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <div className={`sidebar__status ${connected ? 'sidebar__status--connected' : 'sidebar__status--disconnected'}`}>
          <Activity size={14} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
          <span className="sidebar__status-dot" />
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
