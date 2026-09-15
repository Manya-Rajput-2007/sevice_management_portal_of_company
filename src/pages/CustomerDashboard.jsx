import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../context/AuthContext';

export default function CustomerDashboard() {
  const { token, API_BASE_URL } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ summary: {}, recentRequests: [] });

  useEffect(() => {
    if (!token) {
      return;
    }

    axios.get(`${API_BASE_URL}/api/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => setData(response.data))
      .catch((error) => console.error(error));
  }, [API_BASE_URL, token]);

  return (
    <div className="dashboard-page">
      <div className="stats-grid dashboard-stat-grid">
        {[
          ['⚙️', 'Machines', data.summary.totalMachines || 0, '/customer/machines', 'Manage equipment'],
          ['🟡', 'Open Requests', data.summary.openRequests || 0, '/customer/service-requests', 'Needs attention'],
          ['🔧', 'In Progress', data.summary.activeRequests || 0, '/customer/service-requests', 'Being serviced'],
          ['✅', 'Total Requests', data.summary.totalRequests || 0, '/customer/service-requests', 'View service history'],
        ].map(([icon, label, value, route, hint]) => (
          <button type="button" className="stat-card interactive-stat-card" key={label} onClick={() => navigate(route)}>
            <span className="stat-icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint} <span aria-hidden="true">→</span></small>
          </button>
        ))}
      </div>

      <div className="panel"><h3>My service request health</h3><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={data.statusBreakdown || []} dataKey="value" nameKey="name" outerRadius={82} label>{(data.statusBreakdown || []).map((entry, index) => <Cell key={entry.name} fill={['#4f46e5', '#14b8a6', '#f59e0b', '#ef4444'][index % 4]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>

      <div className="panel">
        <div className="section-heading">
          <h3>Recent Requests</h3>
          <button type="button" className="small-button" onClick={() => navigate('/customer/service-requests')}>View all</button>
        </div>
        <ul className="list-panel">
          {data.recentRequests?.map((request) => (
            <li key={request._id}>
              <div>
                <strong>{request.title}</strong>
                <small>{request.machineId?.name || 'Machine'}</small>
              </div>
              <span>{request.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
