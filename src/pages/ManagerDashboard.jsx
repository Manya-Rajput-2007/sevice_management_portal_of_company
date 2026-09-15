import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const statusColors = ['#4f46e5', '#14b8a6', '#f59e0b', '#ef4444'];
const priorityColors = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

export default function ManagerDashboard() {
  const { token, API_BASE_URL, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ summary: {}, recentRequests: [], teams: [], engineerWorkload: [] });
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [recipientId, setRecipientId] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = async () => {
    const [dashboardResponse, contactsResponse, messagesResponse] = await Promise.all([
      axios.get(`${API_BASE_URL}/api/dashboard`, { headers }),
      axios.get(`${API_BASE_URL}/api/message-contacts`, { headers }),
      axios.get(`${API_BASE_URL}/api/messages`, { headers }),
    ]);
    setData(dashboardResponse.data);
    setContacts(contactsResponse.data.contacts);
    setMessages(messagesResponse.data.messages);
    setRecipientId((current) => current || contactsResponse.data.contacts[0]?._id || '');
  };

  useEffect(() => {
    if (token) load().catch((error) => setNotice(error.response?.data?.message || 'Unable to load manager workspace.'));
  }, [API_BASE_URL, token]);

  const sendMessage = async (event) => {
    event.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/api/messages`, { recipientId, body: message }, { headers });
      setMessage('');
      setNotice('Message sent successfully.');
      await load();
    } catch (error) {
      setNotice(error.response?.data?.message || 'Unable to send message.');
    }
  };

  const workloadFor = (member) => data.engineerWorkload?.find((item) => item.name === member.name)?.value || 0;
  const card = (icon, label, value, route, hint) => (
    <button type="button" className="stat-card interactive-stat-card" onClick={() => navigate(route)}>
      <span className="stat-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint} →</small>
    </button>
  );

  return (
    <div className="dashboard-page">
      <div className="stats-grid">
        {card('👷', 'Assigned Engineers', data.teams?.filter((member) => member.role === 'engineer').length || 0, '/manager/engineers', 'Manage team')}
        {card('🟡', 'Open Requests', data.summary.openRequests || 0, '/manager/requests', 'Review open work')}
        {card('🔧', 'Active Requests', data.summary.activeRequests || 0, '/manager/requests', 'Track active work')}
        {card('📋', 'Total Requests', data.summary.totalRequests || 0, '/manager/reports', 'View request report')}
      </div>

      <div className="chart-grid two-columns">
        <button type="button" className="panel panel-button" onClick={() => navigate('/manager/reports')}>
          <h3>📊 Request status mix</h3>
          <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data.statusBreakdown || []} dataKey="value" nameKey="name" outerRadius={75} label>{(data.statusBreakdown || []).map((entry, index) => <Cell key={entry.name} fill={statusColors[index % statusColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          <span className="panel-link">Open reports →</span>
        </button>
        <button type="button" className="panel panel-button" onClick={() => navigate('/manager/reports')}>
          <h3>🎯 Priority mix</h3>
          <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data.priorityBreakdown || []} dataKey="value" nameKey="name" outerRadius={75} label>{(data.priorityBreakdown || []).map((entry, index) => <Cell key={entry.name} fill={priorityColors[index % priorityColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          <span className="panel-link">Analyze priorities →</span>
        </button>
      </div>

      <div className="panel">
        <div className="section-heading"><h3>👥 Team Overview</h3><button type="button" className="small-button" onClick={() => navigate('/manager/engineers')}>Manage team</button></div>
        <div className="team-grid">
          {data.teams?.filter((member) => member.role === 'engineer').map((member) => (
            <div className="team-card" key={member._id}>
              <button type="button" className="team-card-main" onClick={() => navigate('/manager/requests')}>
                <span className="avatar">👷</span><span><strong>{member.name}</strong><small>{workloadFor(member)} assigned request(s)</small></span><span className="role-badge">Engineer</span>
              </button>
              <button type="button" className="small-button" onClick={() => { setRecipientId(member._id); document.getElementById('manager-messages')?.scrollIntoView({ behavior: 'smooth' }); }}>💬 Message</button>
            </div>
          ))}
        </div>
        {(!data.teams || data.teams.filter((member) => member.role === 'engineer').length === 0) && <div className="empty-state">No engineers assigned yet. Add one to build your team.</div>}
      </div>

      <div className="panel" id="manager-messages">
        <div className="section-heading"><h3>💬 Team messages</h3><span className="muted">{messages.length} conversation message(s)</span></div>
        {notice && <div className="notice">{notice}</div>}
        <div className="message-list compact-message-list">
          {messages.length === 0 ? <EmptyMessage /> : messages.slice(-6).map((item) => <div className={`message-row ${item.senderId?._id === user?.id ? 'mine' : ''}`} key={item._id}><div className="message-bubble"><strong>{item.senderId?.name} → {item.recipientId?.name}</strong><span>{item.body}</span><small>{new Date(item.createdAt).toLocaleString()}</small></div></div>)}
        </div>
        <form className="message-form message-compose" onSubmit={sendMessage}>
          <select required value={recipientId} onChange={(event) => setRecipientId(event.target.value)}><option value="">Select customer or engineer</option>{contacts.map((contact) => <option key={contact._id} value={contact._id}>{contact.name} ({contact.role})</option>)}</select>
          <input required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write an update or question..." />
          <button className="primary-button" type="submit">📨 Send message</button>
        </form>
      </div>

      <div className="panel">
        <div className="section-heading"><h3>🛠️ Recent Service Requests</h3><button type="button" className="small-button" onClick={() => navigate('/manager/requests')}>View all</button></div>
        <table className="table"><thead><tr><th>Title</th><th>Priority</th><th>Status</th></tr></thead><tbody>{data.recentRequests?.map((request) => <tr key={request._id} className="clickable-row" onClick={() => navigate('/manager/requests')}><td>{request.title}</td><td>{request.priority}</td><td>{request.status}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}

function EmptyMessage() {
  return <div className="empty-state">No messages yet. Select a customer or engineer to start a conversation.</div>;
}
