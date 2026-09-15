import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const linksByRole = {
  owner: ['Dashboard', 'Managers', 'Engineers', 'Customers', 'Machines', 'Service Requests', 'Messages', 'Reports', 'Analytics', 'Settings'],
  manager: ['Dashboard', 'Engineers', 'Customers', 'Requests', 'Machines', 'Reports'],
  engineer: ['Dashboard', 'Assigned Requests', 'Machines', 'Activity'],
  customer: ['Dashboard', 'Machines', 'Service Requests', 'Messages'],
};

const routeMap = {
  owner: '/owner',
  manager: '/manager',
  engineer: '/engineer',
  customer: '/customer',
};

export function DashboardLayout() {
  const { user, logout, API_BASE_URL, token } = useAuth();
  const navigate = useNavigate();
  const [systemRunning, setSystemRunning] = useState(true);

  useEffect(() => {
    if (!user) return;
    const refresh = () => axios.get(`${API_BASE_URL}/api/system-status`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => setSystemRunning(response.data.running))
      .catch(() => setSystemRunning(true));
    refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => window.clearInterval(interval);
  }, [API_BASE_URL, token, user]);

  if (!user) {
    return null;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-logo">S</div>
          <div>
            <strong>Service Portal</strong>
            <p>{user.role}</p>
          </div>
        </div>

        <nav className="nav">
          {linksByRole[user.role]?.map((label) => {
            const slug = label.toLowerCase().replace(/\s+/g, '-');
            const to = `${routeMap[user.role]}/${slug === 'dashboard' ? '' : slug}`;

            return (
              <NavLink key={label} to={to} end={slug === 'dashboard'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                {label}
              </NavLink>
            );
          })}
        </nav>

        <button
          type="button"
          className="logout-button"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
        >
          Logout
        </button>
      </aside>

      <main className="content-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Welcome back</p>
            <h1>{user.name}</h1>
          </div>
          <div className="topbar-status"><span className={`system-badge ${systemRunning ? 'running' : 'paused'}`}>{systemRunning ? '🟢 Portal running' : '⏸️ Portal paused'}</span><span className="role-badge">{user.role}</span></div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
