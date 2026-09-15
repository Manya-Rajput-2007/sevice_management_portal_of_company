import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#4f46e5', '#14b8a6', '#f59e0b', '#ef4444', '#10b981', '#6366f1'];

export default function OwnerDashboard() {
  const { token, API_BASE_URL, user } = useAuth();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [data, setData] = useState({ summary: {}, recentRequests: [], teams: [], statusBreakdown: [], priorityBreakdown: [], monthlyBreakdown: [] });
  const [accounts, setAccounts] = useState([]);
  const [machines, setMachines] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState('');
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');

  const load = async (contactId = selectedContact) => {
    const requests = [
      axios.get(`${API_BASE_URL}/api/dashboard`, { headers }),
      axios.get(`${API_BASE_URL}/api/users`, { headers }),
      axios.get(`${API_BASE_URL}/api/machines`, { headers }),
      axios.get(`${API_BASE_URL}/api/message-contacts`, { headers }),
    ];
    const [dashboard, users, machineResponse, contactResponse] = await Promise.all(requests);
    setData(dashboard.data);
    setAccounts(users.data.users);
    setMachines(machineResponse.data.machines);
    setContacts(contactResponse.data.contacts);
    const activeContact = contactId || contactResponse.data.contacts.find((contact) => contact.role === 'manager')?._id || '';
    setSelectedContact(activeContact);
    if (activeContact) {
      const conversation = await axios.get(`${API_BASE_URL}/api/messages?contactId=${activeContact}`, { headers });
      setMessages(conversation.data.messages);
    }
  };

  useEffect(() => {
    if (!token) return undefined;
    const refresh = () => load().catch((error) => setNotice(error.response?.data?.message || 'Unable to load owner workspace.'));
    refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => window.clearInterval(interval);
  }, [API_BASE_URL, token]);

  const sendMessage = async (event) => {
    event.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/api/messages`, { recipientId: selectedContact, body: message }, { headers });
      setMessage('');
      setNotice('Message sent.');
      await load(selectedContact);
    } catch (error) {
      setNotice(error.response?.data?.message || 'Unable to send message.');
    }
  };

  const cards = [
    ['👔', 'Managers', data.summary.totalManagers || 0, '/owner/managers'],
    ['👷', 'Engineers', data.summary.totalEngineers || 0, '/owner/engineers'],
    ['👥', 'Customers', data.summary.totalCustomers || 0, '/owner/customers'],
    ['⚙️', 'Machines', data.summary.totalMachines || 0, '/owner/machines'],
    ['📋', 'Requests', data.summary.totalRequests || 0, '/owner/service-requests'],
    ['🟡', 'Open', data.summary.openRequests || 0, '/owner/service-requests'],
  ];
  const managers = accounts.filter((account) => account.role === 'manager');
  const engineers = accounts.filter((account) => account.role === 'engineer');
  const customers = accounts.filter((account) => account.role === 'customer');

  return <div className="dashboard-page">
    <div className="stats-grid">{cards.map(([icon, label, value, route]) => <button type="button" className="stat-card interactive-stat-card" key={label} onClick={() => navigate(route)}><span className="stat-icon">{icon}</span><span>{label}</span><strong>{value}</strong><small>Open workspace →</small></button>)}</div>
    <div className="chart-grid two-columns">
      <button type="button" className="panel panel-button" onClick={() => navigate('/owner/analytics')}><h3>📊 Service Requests by Status</h3><ChartPie data={data.statusBreakdown} /><span className="panel-link">Open analytics →</span></button>
      <button type="button" className="panel panel-button" onClick={() => navigate('/owner/analytics')}><h3>🎯 Requests by Priority</h3><ResponsiveContainer width="100%" height={260}><BarChart data={data.priorityBreakdown}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#4f46e5" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer><span className="panel-link">Open analytics →</span></button>
    </div>
    <div className="chart-grid two-columns"><button type="button" className="panel panel-button" onClick={() => navigate('/owner/reports')}><h3>📈 Monthly Service Requests</h3><ResponsiveContainer width="100%" height={260}><LineChart data={data.monthlyBreakdown}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="requests" stroke="#14b8a6" strokeWidth={3} /></LineChart></ResponsiveContainer></button><div className="panel"><div className="section-heading"><h3>⚡ Recent Activity</h3><button type="button" className="small-button" onClick={() => navigate('/owner/service-requests')}>View all</button></div><ul className="list-panel">{data.recentRequests?.map((request) => <li className="clickable-row" key={request._id} onClick={() => navigate('/owner/service-requests')}><div><strong>{request.title}</strong><small>{request.customerId?.name || 'Customer'}</small></div><span>{request.status}</span></li>)}</ul></div></div>
    <div className="panel"><div className="section-heading"><h3>🧭 Organization Overview</h3><span className="muted">{accounts.length} people · {machines.length} machines</span></div><div className="overview-grid"><OverviewColumn icon="👔" title="Managers" items={managers} route="/owner/managers" /><OverviewColumn icon="👷" title="Engineers" items={engineers} route="/owner/engineers" /><OverviewColumn icon="👥" title="Customers" items={customers} route="/owner/customers" /><OverviewColumn icon="⚙️" title="Machines" items={machines} route="/owner/machines" /></div></div>
    <div className="panel" id="owner-messages"><div className="section-heading"><h3>💬 Private conversations</h3><button type="button" className="small-button" onClick={() => navigate('/owner/messages')}>Open full inbox</button></div>{notice && <div className="notice">{notice}</div>}<div className="conversation-layout"><div className="conversation-list">{contacts.map((contact) => <button type="button" className={`conversation-contact ${selectedContact === contact._id ? 'selected' : ''}`} key={contact._id} onClick={() => load(contact._id)}>{contact.role === 'manager' ? '👔' : contact.role === 'engineer' ? '👷' : '👥'} {contact.name}<small>{contact.role}</small></button>)}</div><div><div className="message-list compact-message-list">{messages.length ? messages.map((item) => <div className={`message-row ${item.senderId?._id === user?.id ? 'mine' : ''}`} key={item._id}><div className="message-bubble"><strong>{item.senderId?.name}</strong><span>{item.body}</span><small>{new Date(item.createdAt).toLocaleString()}</small></div></div>) : <div className="empty-state">Select a person to view this private conversation.</div>}</div><form className="message-form" onSubmit={sendMessage}><input required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a private message..." /><button className="primary-button" type="submit" disabled={!selectedContact}>📨 Send</button></form></div></div></div>
  </div>;
}

function ChartPie({ data }) {
  return <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data || []} dataKey="value" nameKey="name" outerRadius={80} label>{(data || []).map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>;
}

function OverviewColumn({ icon, title, items, route }) {
  const navigate = useNavigate();
  return <button type="button" className="overview-column" onClick={() => navigate(route)}><h4>{icon} {title}</h4>{items.slice(0, 4).map((item) => <span key={item._id}>{item.name || item.model || item.serialNumber}<small>{item.email || item.status || item.location}</small></span>)}{items.length > 4 && <small>+{items.length - 4} more →</small>}</button>;
}
