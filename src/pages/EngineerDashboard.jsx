import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#4f46e5', '#14b8a6', '#f59e0b', '#ef4444'];

export default function EngineerDashboard() {
  const { token, API_BASE_URL, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ summary: {}, recentRequests: [], teams: [] });
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE_URL}/api/dashboard`, { headers })
      .then((response) => setData(response.data))
      .catch((error) => console.error(error));
  }, [API_BASE_URL, headers, token]);

  const card = (icon, label, value, route, hint) => (
    <button type="button" className="stat-card interactive-stat-card" onClick={() => navigate(route)}>
      <span className="stat-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint} →</small>
    </button>
  );

  const teammates = (data.teams || []).filter((member) => member._id !== user?.id);

  return (
    <div className="dashboard-page">
      <div className="stats-grid">
        {card('🧰', 'Assigned Tasks', data.summary.totalRequests || 0, '/engineer/assigned-requests', 'Open work queue')}
        {card('🟡', 'Open', data.summary.openRequests || 0, '/engineer/assigned-requests', 'Start next task')}
        {card('🔧', 'In Progress', data.summary.activeRequests || 0, '/engineer/assigned-requests', 'Continue servicing')}
        {card('👥', 'Customers', data.summary.totalCustomers || 0, '/engineer/machines', 'View equipment')}
      </div>

      <button type="button" className="panel panel-button" onClick={() => navigate('/engineer/assigned-requests')}>
        <div className="section-heading"><h3>📈 My workload at a glance</h3><span className="panel-link">Open work queue →</span></div>
        <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={data.statusBreakdown || []} dataKey="value" nameKey="name" outerRadius={82} label>{(data.statusBreakdown || []).map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
      </button>

      <div className="panel">
        <div className="section-heading"><h3>🤝 Team Overview</h3><button type="button" className="small-button" onClick={() => navigate('/engineer/messages')}>💬 Contact team</button></div>
        <div className="team-grid">
          {(data.teams || []).map((member) => (
            <button type="button" className="team-card team-card-main" key={member._id} onClick={() => navigate('/engineer/messages')}>
              <span className="avatar">{member.role === 'manager' ? '🧑‍💼' : '👷'}</span>
              <span><strong>{member.name}</strong><small>{member.role === 'manager' ? 'Your manager' : 'Team engineer'}</small></span>
              <span className="panel-link">Message →</span>
            </button>
          ))}
          {teammates.length === 0 && <div className="empty-state">Your manager and teammates will appear here.</div>}
        </div>
      </div>

      <div className="panel">
        <div className="section-heading"><h3>🛠️ My Work Queue</h3><button type="button" className="small-button" onClick={() => navigate('/engineer/assigned-requests')}>View all</button></div>
        <table className="table"><thead><tr><th>Request</th><th>Priority</th><th>Status</th></tr></thead><tbody>{data.recentRequests?.map((request) => <tr key={request._id} className="clickable-row" onClick={() => navigate('/engineer/assigned-requests')}><td>{request.title}</td><td>{request.priority}</td><td>{request.status}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
