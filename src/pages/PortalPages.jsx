import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/AuthContext';
import OwnerDashboard from './OwnerDashboard';
import ManagerDashboard from './ManagerDashboard';
import EngineerDashboard from './EngineerDashboard';
import CustomerDashboard from './CustomerDashboard';

const COLORS = ['#4f46e5', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6'];

function usePortalData() {
  const { token, API_BASE_URL } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const get = (path) => axios.get(`${API_BASE_URL}${path}`, { headers });
  const mutate = (method, path, data) => axios({ method, url: `${API_BASE_URL}${path}`, headers, data });
  return { get, mutate };
}

function PageHeader({ title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">Workspace</p>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}

export function RequestsPage() {
  const { get, mutate } = usePortalData();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [machines, setMachines] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', machineId: '', priority: 'Medium' });
  const [filter, setFilter] = useState('All');
  const [notice, setNotice] = useState('');

  const load = async () => {
    const [requestResponse, machineResponse] = await Promise.all([get('/api/service-requests'), get('/api/machines')]);
    setRequests(requestResponse.data.requests);
    setMachines(machineResponse.data.machines);
    if (user.role === 'manager' || user.role === 'owner') {
      const userResponse = await get('/api/users');
      setEngineers(userResponse.data.users.filter((account) => account.role === 'engineer'));
    }
  };

  useEffect(() => { load().catch((error) => setNotice(error.response?.data?.message || 'Unable to load requests.')); }, []);

  const visibleRequests = requests.filter((request) => filter === 'All' || request.status === filter);

  const createRequest = async (event) => {
    event.preventDefault();
    try {
      await mutate('post', '/api/service-requests', form);
      setForm({ title: '', description: '', machineId: '', priority: 'Medium' });
      setShowForm(false);
      setNotice('Service request created.');
      await load();
    } catch (error) {
      setNotice(error.response?.data?.message || 'Unable to create service request.');
    }
  };

  const updateRequest = async (id, updates) => {
    try {
      await mutate('patch', `/api/service-requests/${id}`, updates);
      setNotice('Request updated.');
      await load();
    } catch (error) {
      setNotice(error.response?.data?.message || 'Unable to update request.');
    }
  };

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Service requests"
        description="Track every maintenance issue from intake to resolution."
        action={user.role === 'customer' ? <button className="primary-button" type="button" onClick={() => setShowForm((value) => !value)}>+ New request</button> : null}
      />
      {notice && <div className="notice">{notice}</div>}
      {showForm && (
        <form className="panel form-grid" onSubmit={createRequest}>
          <label>Title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>Machine<select required value={form.machineId} onChange={(event) => setForm({ ...form, machineId: event.target.value })}><option value="">Select a machine</option>{machines.map((machine) => <option key={machine._id} value={machine._id}>{machine.name}</option>)}</select></label>
          <label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
          <label className="full-width">Description<textarea required rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <button className="primary-button" type="submit">Submit request</button>
        </form>
      )}
      <div className="filter-row">
        {['All', 'Open', 'In Progress', 'Resolved', 'Closed'].map((status) => <button type="button" key={status} className={`filter-button ${filter === status ? 'selected' : ''}`} onClick={() => setFilter(status)}>{status}</button>)}
      </div>
      <div className="panel table-wrap">
        {visibleRequests.length === 0 ? <EmptyState>No requests match this filter.</EmptyState> : (
          <table className="table">
            <thead><tr><th>Request</th><th>Submitted</th><th>Machine</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{visibleRequests.map((request) => (
              <tr key={request._id}>
                <td><strong>{request.title}</strong><small>{request.customerId?.name || 'Customer'}</small></td>
                <td>{new Date(request.createdAt).toLocaleDateString()}</td>
                <td>{request.machineId?.name || '—'}</td>
                <td><span className={`status-pill priority-${request.priority.toLowerCase()}`}>{request.priority}</span></td>
                <td><span className={`status-pill status-${request.status.toLowerCase().replace(/\s+/g, '-')}`}>{request.status}</span></td>
                <td>
                  {user.role === 'engineer' && request.status !== 'Resolved' && <button className="small-button" type="button" onClick={() => updateRequest(request._id, { status: 'Resolved', resolution: 'Completed by engineer' })}>Resolve</button>}
                  {user.role === 'customer' && request.status === 'Resolved' && <button className="small-button" type="button" onClick={() => updateRequest(request._id, { customerApproval: 'Approved', status: 'Closed' })}>Approve</button>}
                  {(user.role === 'manager' || user.role === 'owner') && <div className="inline-actions"><select value={request.status} onChange={(event) => updateRequest(request._id, { status: event.target.value })}><option>Open</option><option>In Progress</option><option>Resolved</option><option>Closed</option></select><select value={request.engineerId?._id || ''} onChange={(event) => updateRequest(request._id, { engineerId: event.target.value || null })}><option value="">Unassigned</option>{engineers.map((engineer) => <option key={engineer._id} value={engineer._id}>{engineer.name}</option>)}</select></div>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function MachinesPage() {
  const { get, mutate } = usePortalData();
  const { user } = useAuth();
  const [machines, setMachines] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', model: '', serialNumber: '', customerId: '', location: '' });
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState('');

  const load = async () => {
    const machineResponse = await get('/api/machines');
    setMachines(machineResponse.data.machines);
    if (user.role === 'manager' || user.role === 'owner') {
      const userResponse = await get('/api/users');
      setCustomers(userResponse.data.users.filter((account) => account.role === 'customer'));
    }
  };

  useEffect(() => { load().catch((error) => setNotice(error.response?.data?.message || 'Unable to load machines.')); }, []);

  const createMachine = async (event) => {
    event.preventDefault();
    try {
      await mutate(editingId ? 'patch' : 'post', editingId ? `/api/machines/${editingId}` : '/api/machines', form);
      setForm({ name: '', model: '', serialNumber: '', customerId: '', location: '' });
      setShowForm(false);
      setEditingId(null);
      setNotice('Machine added.');
      await load();
    } catch (error) {
      setNotice(error.response?.data?.message || 'Unable to add machine.');
    }
  };

  const editMachine = (machine) => {
    setEditingId(machine._id);
    setForm({ name: machine.name, model: machine.model, serialNumber: machine.serialNumber, customerId: machine.customerId?._id || '', location: machine.location });
    setShowForm(true);
  };

  const deleteMachine = async (id) => {
    if (!window.confirm('Delete this machine and its service requests?')) return;
    try {
      await mutate('delete', `/api/machines/${id}`);
      setNotice('Machine deleted.');
      await load();
    } catch (error) {
      setNotice(error.response?.data?.message || 'Unable to delete machine.');
    }
  };

  return (
    <div className="dashboard-page">
      <PageHeader title="Machines" description="See service health and ownership for every machine." action={(user.role === 'owner' || user.role === 'manager' || user.role === 'customer') && <button className="primary-button" type="button" onClick={() => setShowForm((value) => !value)}>+ Add new machine</button>} />
      {notice && <div className="notice">{notice}</div>}
      {showForm && <form className="panel form-grid" onSubmit={createMachine}><label>Machine name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Model<input required value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></label><label>Serial number <span className="field-help">Leave blank to auto-generate</span><input value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} disabled={Boolean(editingId)} /></label>{user.role !== 'customer' && <label>Customer<select required value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}><option value="">Select customer</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}</select></label>}<label>Location<input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><button className="primary-button" type="submit">{editingId ? 'Update machine' : 'Save machine'}</button></form>}
      <div className="machine-grid">{machines.map((machine) => <div className="machine-card" key={machine._id}><div className="machine-icon">⚙</div><div><h3>{machine.name}</h3><p>{machine.model} · {machine.serialNumber}</p><small>{machine.location}</small><div className="card-actions"><button className="small-button" type="button" onClick={() => editMachine(machine)}>Edit</button><button className="danger-button" type="button" onClick={() => deleteMachine(machine._id)}>Delete</button></div></div><span className={`status-pill status-${machine.status.toLowerCase().replace(/\s+/g, '-')}`}>{machine.status}</span></div>)}</div>
      {machines.length === 0 && <EmptyState>No machines are available in your scope.</EmptyState>}
    </div>
  );
}

export function PeoplePage({ roleFilter, title }) {
  const { get, mutate } = usePortalData();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: 'Password123', role: roleFilter || 'manager' });
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState('');

  const load = async () => {
    const response = await get('/api/users');
    setUsers(response.data.users.filter((account) => !roleFilter || account.role === roleFilter));
  };

  useEffect(() => { load().catch((error) => setNotice(error.response?.data?.message || 'Unable to load users.')); }, []);

  const createUser = async (event) => {
    event.preventDefault();
    try {
      const endpoint = roleFilter ? `/api/${roleFilter}s` : '/api/users';
      const payload = editingId ? Object.fromEntries(Object.entries(form).filter(([key, value]) => key !== 'password' || value)) : form;
      await mutate(editingId ? 'patch' : 'post', editingId ? `${endpoint}/${editingId}` : endpoint, payload);
      setShowForm(false);
      setEditingId(null);
      setNotice('User created.');
      await load();
    } catch (error) {
      setNotice(error.response?.data?.message || 'Unable to create user.');
    }
  };

  const editUser = (account) => {
    setEditingId(account._id);
    setForm({ name: account.name, email: account.email, password: '', role: account.role, managerId: account.managerId || '' });
    setShowForm(true);
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this account?')) return;
    try {
      await mutate('delete', `/api/${roleFilter ? `${roleFilter}s/` : 'users/'}${id}`);
      setNotice('User deleted.');
      await load();
    } catch (error) {
      setNotice(error.response?.data?.message || 'Unable to delete user.');
    }
  };

  const canManage = user.role === 'owner' || user.role === 'manager';
  return <div className="dashboard-page"><PageHeader title={title} description="Manage people and keep ownership assignments clear." action={canManage ? <button className="primary-button" type="button" onClick={() => { setEditingId(null); setForm({ name: '', email: '', password: 'Password123', role: roleFilter || 'manager' }); setShowForm((value) => !value); }}>➕ Add {roleFilter || 'user'}</button> : null} />{notice && <div className="notice">{notice}</div>}{showForm && <form className="panel form-grid" onSubmit={createUser}><label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>{!editingId && <label>Password<input required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>}{!roleFilter && <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="manager">Manager</option><option value="engineer">Engineer</option><option value="customer">Customer</option></select></label>}<button className="primary-button" type="submit">{editingId ? '💾 Update account' : 'Create account'}</button></form>}<div className="people-grid">{users.map((account) => <div className="person-card" key={account._id}><div className="avatar">{account.name.slice(0, 1)}</div><div><h3>{account.name}</h3><p>{account.email}</p><span className="role-badge">{account.role}</span><div className="card-actions">{canManage && <><button className="small-button" type="button" onClick={() => editUser(account)}>✏️ Edit</button><button className="danger-button" type="button" onClick={() => deleteUser(account._id)}>🗑️ Delete</button></>}</div></div><span className={`active-dot ${account.active ? 'online' : ''}`}>{account.active ? '✅ Active' : 'Inactive'}</span></div>)}</div>{users.length === 0 && <EmptyState>No users found.</EmptyState>}</div>;
}

export function AnalyticsPage() {
  const { get } = usePortalData();
  const [data, setData] = useState({ statusBreakdown: [], priorityBreakdown: [], engineerWorkload: [], managerPerformance: [] });
  useEffect(() => { get('/api/dashboard').then((response) => setData(response.data)).catch(() => undefined); }, []);
  return <div className="dashboard-page"><PageHeader title="Analytics" description="Understand demand, workload and service health at a glance." /><div className="chart-grid two-columns"><div className="panel"><h3>Status mix</h3><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={data.statusBreakdown} dataKey="value" nameKey="name" outerRadius={92} label>{data.statusBreakdown.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div><div className="panel"><h3>Priority mix</h3><ResponsiveContainer width="100%" height={280}><BarChart data={data.priorityBreakdown}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#4f46e5" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="panel"><h3>Engineer workload</h3><ResponsiveContainer width="100%" height={280}><BarChart data={data.engineerWorkload} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={90} /><Tooltip /><Bar dataKey="value" fill="#14b8a6" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></div><div className="panel"><h3>Requests by manager</h3><ResponsiveContainer width="100%" height={280}><LineChart data={data.managerPerformance}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={3} /></LineChart></ResponsiveContainer></div></div></div>;
}

export function ReportsPage() {
  const { get } = usePortalData();
  const [data, setData] = useState(null);
  useEffect(() => { get('/api/dashboard').then((response) => setData(response.data)).catch(() => undefined); }, []);
  const histogramData = (data?.priorityBreakdown || []).map((item) => ({ range: item.name, requests: item.value }));
  return <div className="dashboard-page"><PageHeader title="Reports" description="A data-led operational review of service volume, urgency and workload." action={<button className="primary-button" type="button" onClick={() => window.print()}>Print report</button>} /><div className="report-grid">{[['Total requests', data?.summary.totalRequests], ['Open work', data?.summary.openRequests], ['In progress', data?.summary.activeRequests], ['Machines tracked', data?.summary.totalMachines]].map(([label, value]) => <div className="report-metric" key={label}><span>{label}</span><strong>{value ?? '—'}</strong></div>)}</div><div className="chart-grid two-columns"><div className="panel"><h3>Request status distribution</h3><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={data?.statusBreakdown || []} dataKey="value" nameKey="name" outerRadius={92} label>{(data?.statusBreakdown || []).map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div><div className="panel"><h3>Priority histogram</h3><ResponsiveContainer width="100%" height={280}><BarChart data={histogramData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="range" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="requests" fill="#f59e0b" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="panel"><h3>Engineer workload analysis</h3><ResponsiveContainer width="100%" height={280}><BarChart data={data?.engineerWorkload || []} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={100} /><Tooltip /><Bar dataKey="value" fill="#14b8a6" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></div><div className="panel"><h3>Manager request volume</h3><ResponsiveContainer width="100%" height={280}><AreaChart data={data?.managerPerformance || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="value" stroke="#4f46e5" fill="#c7d2fe" /></AreaChart></ResponsiveContainer></div></div><div className="panel"><h3>How to use this report</h3><p className="muted">Use the histogram to identify urgency concentration, workload analysis to rebalance engineer assignments, and the status pie to monitor unresolved work.</p></div></div>;
}

export function MessagesPage() {
  const { get, mutate } = usePortalData();
  const [message, setMessage] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [notice, setNotice] = useState('');

  const load = async () => {
    const [contactResponse, messageResponse, requestResponse] = await Promise.all([
      get('/api/message-contacts'),
      get('/api/messages'),
      get('/api/service-requests'),
    ]);
    setContacts(contactResponse.data.contacts);
    setMessages(messageResponse.data.messages);
    setRequests(requestResponse.data.requests);
    if (!recipientId && contactResponse.data.contacts[0]) setRecipientId(contactResponse.data.contacts[0]._id);
  };

  useEffect(() => { load().catch((error) => setNotice(error.response?.data?.message || 'Unable to load messages.')); }, []);

  const sendMessage = async (event) => {
    event.preventDefault();
    try {
      await mutate('post', '/api/messages', { recipientId, requestId: requestId || null, body: message });
      setMessage('');
      setRequestId('');
      setNotice('Message sent.');
      await load();
    } catch (error) {
      setNotice(error.response?.data?.message || 'Unable to send message.');
    }
  };

  return <div className="dashboard-page"><PageHeader title="Messages" description="Send updates directly to a manager or an assigned engineer." />{notice && <div className="notice">{notice}</div>}<div className="panel"><div className="message-list">{messages.length === 0 ? <EmptyState>No messages yet. Start a conversation with your service team.</EmptyState> : messages.map((item) => <div className={`message-row ${item.senderId?._id === JSON.parse(localStorage.getItem('portal-user') || '{}').id ? 'mine' : ''}`} key={item._id}><div className="message-bubble"><strong>{item.senderId?.name} → {item.recipientId?.name}</strong><span>{item.body}</span>{item.requestId?.title && <small>Request: {item.requestId.title}</small>}<small>{new Date(item.createdAt).toLocaleString()}</small></div></div>)}</div><form className="message-form message-compose" onSubmit={sendMessage}><select required value={recipientId} onChange={(event) => setRecipientId(event.target.value)}><option value="">Select recipient</option>{contacts.map((contact) => <option key={contact._id} value={contact._id}>{contact.name} ({contact.role})</option>)}</select><select value={requestId} onChange={(event) => setRequestId(event.target.value)}><option value="">Related request (optional)</option>{requests.map((request) => <option key={request._id} value={request._id}>{request.title}</option>)}</select><input required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message..." /><button className="primary-button" type="submit">Send</button></form></div></div>;
}

export function ActivityPage() {
  return <div className="dashboard-page"><PageHeader title="Activity" description="A focused view of the work happening in your account." /><MessagesPage /></div>;
}

export function RolePortal({ role }) {
  const location = useLocation();
  const path = location.pathname.split('/').filter(Boolean).slice(1).join('/');
  if (!path || path === 'dashboard') {
    if (role === 'owner') return <OwnerDashboard />;
    if (role === 'manager') return <ManagerDashboard />;
    if (role === 'engineer') return <EngineerDashboard />;
    return <CustomerDashboard />;
  }
  if (path === 'machines') return <MachinesPage />;
  if (path === 'service-requests' || path === 'requests' || path === 'assigned-requests') return <RequestsPage />;
  if (path === 'messages') return <MessagesPage />;
  if (path === 'activity') return <ActivityPage />;
  if (path === 'reports') return <ReportsPage />;
  if (path === 'analytics') return <AnalyticsPage />;
  if (path === 'settings') return <SystemControlPage />;
  if (['managers', 'engineers', 'customers'].includes(path)) return <PeoplePage roleFilter={path.slice(0, -1)} title={path[0].toUpperCase() + path.slice(1)} />;
  return <ReportsPage />;
}

export function SystemControlPage() {
  const { get, mutate } = usePortalData();
  const [status, setStatus] = useState({ running: true });
  const [notice, setNotice] = useState('');
  const load = async () => setStatus((await get('/api/system-status')).data);
  useEffect(() => { load().catch((error) => setNotice(error.response?.data?.message || 'Unable to load portal status.')); }, []);
  const toggle = async () => {
    try {
      const response = await mutate('patch', '/api/system-status', { running: !status.running });
      setStatus(response.data);
      setNotice(response.data.running ? 'Portal resumed. All users can edit again.' : 'Portal paused. Other users can view but cannot edit.');
    } catch (error) {
      setNotice(error.response?.data?.message || 'Unable to change portal status.');
    }
  };
  return <div className="dashboard-page"><PageHeader title="⚙️ Portal control center" description="Monitor the whole service portal and control database editing access." />{notice && <div className="notice">{notice}</div>}<div className="system-control-card"><div><span className={`system-badge ${status.running ? 'running' : 'paused'}`}>{status.running ? '🟢 Running' : '⏸️ Paused'}</span><h3>{status.running ? 'Portal is operational' : 'Portal is in read-only mode'}</h3><p className="muted">{status.running ? 'Managers, engineers and customers can create and update records.' : 'All portals remain visible, but only the owner can make database changes.'}</p></div><button className={status.running ? 'danger-button' : 'primary-button'} type="button" onClick={toggle}>{status.running ? '⏸️ Pause portal' : '▶️ Resume portal'}</button></div><div className="panel"><h3>📚 Owner overview</h3><p className="muted">Use Dashboard, People, Machines, Messages, Reports and Analytics to inspect live database information. The status indicator is visible to every signed-in portal.</p></div></div>;
}
