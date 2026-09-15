require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { connectDB } = require('./config/db');
const { seedDemoData } = require('./data/seed');
const User = require('./models/User');
const Machine = require('./models/Machine');
const ServiceRequest = require('./models/ServiceRequest');
const Message = require('./models/Message');
const SystemSetting = require('./models/SystemSetting');
const { requireAuth, authorize } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'service-portal-super-secret';
const USER_ROLES = ['engineer', 'customer'];
const MACHINE_STATUSES = ['Operational', 'Service Due', 'Maintenance', 'Out of Service'];

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function cleanText(value, field, maxLength = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    return `${field} is required and must be at most ${maxLength} characters.`;
  }
  return null;
}

async function nextSerialNumber() {
  // Use the highest persisted numeric suffix rather than countDocuments: deleted
  // records and concurrent requests must not cause the generator to reuse a value.
  const machines = await Machine.find({ serialNumber: /^MCH-\d+$/ }).select('serialNumber').lean();
  const highest = machines.reduce((max, machine) => {
    const number = Number(machine.serialNumber.slice(4));
    return Number.isSafeInteger(number) ? Math.max(max, number) : max;
  }, 0);
  let candidate = highest + 1;
  while (await Machine.exists({ serialNumber: `MCH-${String(candidate).padStart(5, '0')}` })) {
    candidate += 1;
  }
  return `MCH-${String(candidate).padStart(5, '0')}`;
}

app.use(cors());
app.use(express.json());

app.use(async (req, res, next) => {
  const isWrite = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);
  const isControlRoute = req.path === '/api/system-status' || req.path === '/api/auth/login';
  if (!isWrite || isControlRoute || !req.path.startsWith('/api/')) return next();
  return requireAuth(req, res, async () => {
    const setting = await SystemSetting.findOne({ key: 'portal' }).lean();
    if (setting && !setting.running && req.user.role !== 'owner') {
      return res.status(423).json({ message: 'The portal is paused by the owner. You can view data but cannot make changes.' });
    }
    return next();
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'service-management-portal' });
});

app.get('/api/system-status', requireAuth, async (_req, res) => {
  const setting = await SystemSetting.findOneAndUpdate(
    { key: 'portal' },
    { $setOnInsert: { key: 'portal', running: true } },
    { upsert: true, new: true },
  ).lean();
  return res.json({ running: setting.running, updatedAt: setting.updatedAt });
});

app.patch('/api/system-status', requireAuth, authorize('owner'), async (req, res) => {
  if (typeof req.body?.running !== 'boolean') {
    return res.status(400).json({ message: 'running must be a boolean.' });
  }
  const setting = await SystemSetting.findOneAndUpdate(
    { key: 'portal' },
    { $set: { running: req.body.running, updatedAt: new Date() }, $setOnInsert: { key: 'portal' } },
    { upsert: true, new: true },
  ).lean();
  return res.json({ running: setting.running, updatedAt: setting.updatedAt });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.active) {
      return res.status(403).json({ message: 'This account has been deactivated.' });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to authenticate user.', error: error.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.userId).select('-password');
  res.json({ user });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  const requestQuery = {};
  const machineQuery = {};
  const scopedUserId = new mongoose.Types.ObjectId(req.user.userId);

  if (req.user.role === 'manager') {
    requestQuery.managerId = scopedUserId;
    machineQuery.managerId = scopedUserId;
  }

  if (req.user.role === 'engineer') {
    requestQuery.engineerId = scopedUserId;
  }

  if (req.user.role === 'customer') {
    requestQuery.customerId = scopedUserId;
    machineQuery.customerId = scopedUserId;
  }

  const engineerRecord = req.user.role === 'engineer'
    ? await User.findById(req.user.userId).select('managerId')
    : null;
  const teamQuery = req.user.role === 'owner'
    ? { role: { $in: ['manager', 'engineer'] } }
    : req.user.role === 'engineer'
      ? { $or: [{ _id: engineerRecord?.managerId, role: 'manager' }, { managerId: engineerRecord?.managerId, role: 'engineer' }] }
      : { managerId: req.user.userId, role: 'engineer' };

  const [totalManagers, totalEngineers, totalCustomers, totalMachines, totalRequests, openRequests, activeRequests, recentRequests, teams, statusBreakdown, priorityBreakdown, engineerWorkload, managerPerformance, monthlyBreakdown] = await Promise.all([
    User.countDocuments({ role: 'manager' }),
    User.countDocuments({ role: 'engineer' }),
    User.countDocuments({ role: 'customer' }),
    Machine.countDocuments(machineQuery),
    ServiceRequest.countDocuments(requestQuery),
    ServiceRequest.countDocuments({ ...requestQuery, status: 'Open' }),
    ServiceRequest.countDocuments({ ...requestQuery, status: 'In Progress' }),
    ServiceRequest.find(requestQuery).sort({ createdAt: -1 }).limit(5).populate('customerId', 'name email').populate('engineerId', 'name'),
    User.find(teamQuery).select('name role managerId'),
    ServiceRequest.aggregate([{ $match: requestQuery }, { $group: { _id: '$status', value: { $sum: 1 } } }, { $project: { _id: 0, name: '$_id', value: 1 } }]),
    ServiceRequest.aggregate([{ $match: requestQuery }, { $group: { _id: '$priority', value: { $sum: 1 } } }, { $project: { _id: 0, name: '$_id', value: 1 } }]),
    ServiceRequest.aggregate([{ $match: requestQuery }, { $group: { _id: '$engineerId', value: { $sum: 1 } } }, { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'engineer' } }, { $unwind: { path: '$engineer', preserveNullAndEmptyArrays: true } }, { $project: { _id: 0, name: { $ifNull: ['$engineer.name', 'Unassigned'] }, value: 1 } }]),
    ServiceRequest.aggregate([{ $match: requestQuery }, { $group: { _id: '$managerId', value: { $sum: 1 } } }, { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'manager' } }, { $unwind: { path: '$manager', preserveNullAndEmptyArrays: true } }, { $project: { _id: 0, name: { $ifNull: ['$manager.name', 'Unassigned'] }, value: 1 } }]),
    ServiceRequest.aggregate([{ $match: requestQuery }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, value: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $project: { _id: 0, month: '$_id', requests: '$value' } }]),
  ]);

  const summary = {
    totalManagers,
    totalEngineers,
    totalCustomers,
    totalMachines,
    totalRequests,
    openRequests,
    activeRequests,
  };

  return res.json({
    user: req.user,
    role: req.user.role,
    summary,
    recentRequests,
    teams,
    statusBreakdown,
    priorityBreakdown,
    engineerWorkload,
    managerPerformance,
    monthlyBreakdown,
  });
});

app.get('/api/users', requireAuth, authorize('owner', 'manager'), async (req, res) => {
  const roleFilter = req.user.role === 'owner' ? { role: { $in: ['manager', 'engineer', 'customer'] } } : { role: { $in: ['engineer', 'customer'] }, managerId: req.user.userId };

  const users = await User.find(roleFilter).select('-password').sort({ createdAt: -1 });
  return res.json({ users });
});

app.post('/api/users', requireAuth, authorize('owner'), async (req, res) => {
  const { name, email, password, role, managerId } = req.body || {};

  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !role) {
    return res.status(400).json({ message: 'Name, email, password and role are required.' });
  }

  if (!['manager', 'engineer', 'customer'].includes(role)) {
    return res.status(400).json({ message: 'Only manager, engineer and customer accounts can be created here.' });
  }
  if (managerId && (!isValidObjectId(managerId) || !(await User.exists({ _id: managerId, role: 'manager', active: true })))) {
    return res.status(400).json({ message: 'managerId must reference an active manager.' });
  }

  const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), password, role, managerId: managerId || null });
  const safeUser = user.toObject();
  delete safeUser.password;
  return res.status(201).json({ user: safeUser });
});

app.patch('/api/users/:id', requireAuth, authorize('owner'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user id.' });
  const user = await User.findById(req.params.id);
  if (!user || user.role === 'owner') {
    return res.status(404).json({ message: 'Editable user not found.' });
  }

  const allowedFields = ['name', 'email', 'role', 'managerId', 'active'];
  const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowedFields.includes(key)));
  if (updates.email) updates.email = updates.email.toLowerCase();
  if (updates.role && !['manager', 'engineer', 'customer'].includes(updates.role)) {
    return res.status(400).json({ message: 'Invalid user role.' });
  }
  if ('managerId' in updates && updates.managerId && (!isValidObjectId(updates.managerId) || !(await User.exists({ _id: updates.managerId, role: 'manager', active: true })))) {
    return res.status(400).json({ message: 'managerId must reference an active manager.' });
  }

  Object.assign(user, updates);
  await user.save();
  const safeUser = user.toObject();
  delete safeUser.password;
  return res.json({ user: safeUser });
});

app.delete('/api/users/:id', requireAuth, authorize('owner'), async (req, res) => {
  const user = await User.findOneAndDelete({ _id: req.params.id, role: { $ne: 'owner' } });
  if (!user) {
    return res.status(404).json({ message: 'Editable user not found.' });
  }
  await Machine.deleteMany({ customerId: user._id });
  return res.json({ message: 'User deleted.' });
});

// Role-specific user endpoints keep authorization scoped to the record's
// manager. The legacy /api/users routes remain available for compatibility.
function userIsInScope(user, requestUser) {
  return requestUser.role === 'owner'
    || (requestUser.role === 'manager' && user.managerId?.toString() === requestUser.userId);
}

function registerRoleCrudRoutes(role, routeName) {
  app.get(`/api/${routeName}`, requireAuth, authorize('owner', 'manager'), async (req, res) => {
    const query = { role };
    if (req.user.role === 'manager') query.managerId = req.user.userId;
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    return res.json({ users });
  });

  app.post(`/api/${routeName}`, requireAuth, authorize('owner', 'manager'), async (req, res) => {
    const { name, email, password, managerId } = req.body || {};
    const errors = [
      cleanText(name, 'Name', 100),
      cleanText(email, 'Email', 254),
      cleanText(password, 'Password', 128),
    ].filter(Boolean);
    if (errors.length || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ message: errors[0] || 'A valid email is required.' });
    }
    if (password.trim().length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
    const assignedManagerId = req.user.role === 'manager' ? req.user.userId : managerId;
    if (assignedManagerId && (!isValidObjectId(assignedManagerId) || !(await User.exists({ _id: assignedManagerId, role: 'manager', active: true })))) {
      return res.status(400).json({ message: 'managerId must reference an active manager.' });
    }
    try {
      const user = await User.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        role,
        managerId: assignedManagerId || null,
      });
      const safeUser = user.toObject();
      delete safeUser.password;
      return res.status(201).json({ user: safeUser });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'Email is already registered.' });
      throw error;
    }
  });

  app.patch(`/api/${routeName}/:id`, requireAuth, authorize('owner', 'manager'), async (req, res) => {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user id.' });
    const user = await User.findOne({ _id: req.params.id, role });
    if (!user || !userIsInScope(user, req.user)) return res.status(user ? 403 : 404).json({ message: user ? 'You cannot update this user.' : 'User not found.' });
    const body = req.body || {};
    const updates = {};
    for (const field of ['name', 'email', 'active']) if (field in body) updates[field] = body[field];
    if ('name' in updates) {
      const error = cleanText(updates.name, 'Name', 100);
      if (error) return res.status(400).json({ message: error });
      updates.name = updates.name.trim();
    }
    if ('email' in updates) {
      const error = cleanText(updates.email, 'Email', 254);
      if (error || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email.trim())) return res.status(400).json({ message: error || 'A valid email is required.' });
      updates.email = updates.email.trim().toLowerCase();
    }
    if ('active' in updates && typeof updates.active !== 'boolean') return res.status(400).json({ message: 'active must be a boolean.' });
    if ('managerId' in body) {
      if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only the owner can reassign users.' });
      if (body.managerId && (!isValidObjectId(body.managerId) || !(await User.exists({ _id: body.managerId, role: 'manager', active: true })))) {
        return res.status(400).json({ message: 'managerId must reference an active manager.' });
      }
      updates.managerId = body.managerId || null;
    }
    if ('password' in body) {
      if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) return res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
      updates.password = body.password;
    }
    Object.assign(user, updates);
    try {
      await user.save();
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'Email is already registered.' });
      throw error;
    }
    const safeUser = user.toObject();
    delete safeUser.password;
    return res.json({ user: safeUser });
  });

  app.delete(`/api/${routeName}/:id`, requireAuth, authorize('owner', 'manager'), async (req, res) => {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user id.' });
    const user = await User.findOne({ _id: req.params.id, role });
    if (!user || !userIsInScope(user, req.user)) return res.status(user ? 403 : 404).json({ message: user ? 'You cannot delete this user.' : 'User not found.' });
    await user.deleteOne();
    await Machine.deleteMany({ $or: [{ customerId: user._id }, { managerId: user._id }] });
    return res.json({ message: `${role[0].toUpperCase()}${role.slice(1)} deleted.` });
  });
}

registerRoleCrudRoutes('engineer', 'engineers');
registerRoleCrudRoutes('customer', 'customers');

app.get('/api/machines', requireAuth, async (req, res) => {
  const query = {};

  if (req.user.role === 'manager') query.managerId = req.user.userId;
  if (req.user.role === 'engineer') {
    const assignedRequests = await ServiceRequest.find({ engineerId: req.user.userId }).distinct('machineId');
    query._id = { $in: assignedRequests };
  }
  if (req.user.role === 'customer') query.customerId = req.user.userId;

  const machines = await Machine.find(query).populate('customerId', 'name email').sort({ createdAt: -1 });
  return res.json({ machines });
});

app.get('/api/service-requests', requireAuth, async (req, res) => {
  const query = {};

  if (req.user.role === 'manager') query.managerId = req.user.userId;
  if (req.user.role === 'engineer') query.engineerId = req.user.userId;
  if (req.user.role === 'customer') query.customerId = req.user.userId;

  const requests = await ServiceRequest.find(query)
    .populate('customerId', 'name email')
    .populate('machineId', 'name model')
    .populate('engineerId', 'name')
    .sort({ createdAt: -1 });

  return res.json({ requests });
});

app.get('/api/message-contacts', requireAuth, async (req, res) => {
  let query;

  if (req.user.role === 'customer') {
    const customer = await User.findById(req.user.userId).select('managerId');
    const requests = await ServiceRequest.find({ customerId: req.user.userId }).select('engineerId');
    const engineerIds = requests.map((request) => request.engineerId).filter(Boolean);
    query = { _id: { $in: [customer?.managerId, ...engineerIds].filter(Boolean) } };
  } else if (req.user.role === 'engineer') {
    const engineer = await User.findById(req.user.userId).select('managerId');
    query = { _id: engineer?.managerId || null };
  } else if (req.user.role === 'manager') {
    query = { managerId: req.user.userId, role: { $in: ['engineer', 'customer'] } };
  } else {
    query = { role: { $in: ['manager', 'engineer', 'customer'] } };
  }

  const contacts = await User.find(query).select('name email role').sort({ name: 1 });
  return res.json({ contacts });
});

app.get('/api/messages', requireAuth, async (req, res) => {
  const conversationFilter = req.query.contactId && isValidObjectId(req.query.contactId)
    ? { $or: [{ senderId: req.user.userId, recipientId: req.query.contactId }, { senderId: req.query.contactId, recipientId: req.user.userId }] }
    : { $or: [{ senderId: req.user.userId }, { recipientId: req.user.userId }] };
  const messages = await Message.find({
    ...conversationFilter,
  })
    .populate('senderId', 'name role')
    .populate('recipientId', 'name role')
    .populate('requestId', 'title')
    .sort({ createdAt: 1 });

  return res.json({ messages });
});

app.post('/api/messages', requireAuth, async (req, res) => {
  const { recipientId, body, requestId } = req.body || {};

  if (!recipientId || !body?.trim()) {
    return res.status(400).json({ message: 'Recipient and message are required.' });
  }

  const contactResponse = await (async () => {
    if (req.user.role === 'customer') {
      const customer = await User.findById(req.user.userId).select('managerId');
      const requests = await ServiceRequest.find({ customerId: req.user.userId }).select('engineerId');
      const engineerIds = requests.map((request) => request.engineerId).filter(Boolean);
      return User.findOne({ _id: recipientId, $or: [{ _id: customer?.managerId }, { _id: { $in: engineerIds } }] });
    }
    if (req.user.role === 'engineer') {
      const engineer = await User.findById(req.user.userId).select('managerId');
      return User.findOne({ $and: [{ _id: recipientId }, { _id: engineer?.managerId }, { role: 'manager' }] });
    }
    if (req.user.role === 'manager') {
      return User.findOne({ _id: recipientId, managerId: req.user.userId, role: { $in: ['engineer', 'customer'] } });
    }
    return User.findOne({ _id: recipientId, role: { $in: ['manager', 'engineer', 'customer'] } });
  })();

  if (!contactResponse) {
    return res.status(403).json({ message: 'You cannot message this user.' });
  }

  if (requestId) {
    const request = await ServiceRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Related service request not found.' });
    }
  }

  const message = await Message.create({
    senderId: req.user.userId,
    recipientId,
    requestId: requestId || null,
    body: body.trim(),
  });

  const populatedMessage = await Message.findById(message._id)
    .populate('senderId', 'name role')
    .populate('recipientId', 'name role')
    .populate('requestId', 'title');

  return res.status(201).json({ message: populatedMessage });
});

app.post('/api/service-requests', requireAuth, authorize('customer'), async (req, res) => {
  const { title, description, machineId, priority } = req.body || {};

  if (!title || !description || !machineId) {
    return res.status(400).json({ message: 'Title, description and machineId are required.' });
  }
  if (priority && !['Low', 'Medium', 'High', 'Critical'].includes(priority)) {
    return res.status(400).json({ message: 'Priority must be Low, Medium, High or Critical.' });
  }

  const machine = await Machine.findOne({ _id: machineId, customerId: req.user.userId });
  if (!machine) {
    return res.status(404).json({ message: 'Machine not found for this customer.' });
  }

  const request = await ServiceRequest.create({
    title,
    description,
    customerId: req.user.userId,
    machineId: machine._id,
    managerId: machine.managerId,
    priority: priority || 'Medium',
    status: 'Open',
  });

  return res.status(201).json({ request });
});

app.post('/api/machines', requireAuth, authorize('owner', 'manager', 'customer'), async (req, res) => {
  const { name, model, serialNumber, customerId, location } = req.body || {};

  if (!name || !model || !location) {
    return res.status(400).json({ message: 'Name, model and location are required.' });
  }

  const requestedCustomerId = req.user.role === 'customer' ? req.user.userId : customerId;
  if (!requestedCustomerId) {
    return res.status(400).json({ message: 'Customer is required when a manager or owner adds a machine.' });
  }
  if (!isValidObjectId(requestedCustomerId)) {
    return res.status(400).json({ message: 'customerId must be a valid user id.' });
  }

  const customerQuery = req.user.role === 'owner'
    ? { _id: requestedCustomerId, role: 'customer' }
    : req.user.role === 'manager'
      ? { _id: requestedCustomerId, role: 'customer', managerId: req.user.userId }
      : { _id: req.user.userId, role: 'customer' };
  const customer = await User.findOne(customerQuery);

  if (!customer) {
    return res.status(404).json({ message: 'Customer not found in your organization scope.' });
  }

  const textErrors = [
    cleanText(name, 'Name', 120),
    cleanText(model, 'Model', 120),
    cleanText(location, 'Location', 200),
  ].filter(Boolean);
  if (textErrors.length) return res.status(400).json({ message: textErrors[0] });
  if (serialNumber !== undefined && (typeof serialNumber !== 'string' || serialNumber.trim().length > 80)) {
    return res.status(400).json({ message: 'Serial number must be at most 80 characters.' });
  }
  let generatedSerial = serialNumber?.trim() || await nextSerialNumber();

  if (await Machine.exists({ serialNumber: generatedSerial })) {
    return res.status(409).json({ message: 'Serial number already exists.' });
  }

  const machine = await Machine.create({
    name: name.trim(),
    model: model.trim(),
    serialNumber: generatedSerial,
    customerId: customer._id,
    managerId: customer.managerId,
    location: location.trim(),
  });

  return res.status(201).json({ machine });
});

app.patch('/api/machines/:id', requireAuth, authorize('owner', 'manager', 'customer'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid machine id.' });
  const machine = await Machine.findById(req.params.id);
  if (!machine) return res.status(404).json({ message: 'Machine not found.' });

  const permitted = req.user.role === 'owner'
    || (req.user.role === 'manager' && machine.managerId.toString() === req.user.userId)
    || (req.user.role === 'customer' && machine.customerId.toString() === req.user.userId);
  if (!permitted) return res.status(403).json({ message: 'You cannot update this machine.' });

  const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => ['name', 'model', 'location', 'status'].includes(key)));
  for (const field of ['name', 'model', 'location']) {
    if (field in updates) {
      const error = cleanText(updates[field], field[0].toUpperCase() + field.slice(1), field === 'location' ? 200 : 120);
      if (error) return res.status(400).json({ message: error });
      updates[field] = updates[field].trim();
    }
  }
  if ('status' in updates && !MACHINE_STATUSES.includes(updates.status)) {
    return res.status(400).json({ message: `status must be one of: ${MACHINE_STATUSES.join(', ')}.` });
  }
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'At least one valid machine field is required.' });
  Object.assign(machine, updates);
  await machine.save();
  return res.json({ machine });
});

app.delete('/api/machines/:id', requireAuth, authorize('owner', 'manager', 'customer'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid machine id.' });
  const machine = await Machine.findById(req.params.id);
  if (!machine) return res.status(404).json({ message: 'Machine not found.' });

  const permitted = req.user.role === 'owner'
    || (req.user.role === 'manager' && machine.managerId.toString() === req.user.userId)
    || (req.user.role === 'customer' && machine.customerId.toString() === req.user.userId);
  if (!permitted) return res.status(403).json({ message: 'You cannot delete this machine.' });

  await machine.deleteOne();
  await ServiceRequest.deleteMany({ machineId: machine._id });
  return res.json({ message: 'Machine deleted.' });
});

app.patch('/api/service-requests/:id', requireAuth, async (req, res) => {
  const request = await ServiceRequest.findById(req.params.id);

  if (!request) {
    return res.status(404).json({ message: 'Service request not found.' });
  }

  const isOwner = req.user.role === 'owner';
  const isManager = req.user.role === 'manager' && request.managerId.toString() === req.user.userId;
  const isEngineer = req.user.role === 'engineer' && request.engineerId?.toString() === req.user.userId;
  const isCustomer = req.user.role === 'customer' && request.customerId.toString() === req.user.userId;

  if (!isOwner && !isManager && !isEngineer && !isCustomer) {
    return res.status(403).json({ message: 'You cannot update this request.' });
  }

  const allowedFields = ['status', 'priority', 'engineerId', 'resolution', 'customerApproval'];
  const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowedFields.includes(key)));

  if (isCustomer && Object.keys(updates).some((key) => !['customerApproval'].includes(key))) {
    return res.status(403).json({ message: 'Customers can only approve or reject a resolution.' });
  }

  if (isEngineer && Object.keys(updates).some((key) => !['status', 'resolution'].includes(key))) {
    return res.status(403).json({ message: 'Engineers can only update progress and resolution.' });
  }

  Object.assign(request, updates);
  await request.save();

  const updatedRequest = await ServiceRequest.findById(request._id)
    .populate('customerId', 'name email')
    .populate('machineId', 'name model')
    .populate('engineerId', 'name');

  return res.json({ request: updatedRequest });
});

app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

async function startServer() {
  try {
    await connectDB();
    await seedDemoData();
    app.listen(PORT, () => {
      console.log(`Portal API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start the service portal.', error);
    process.exit(1);
  }
}

startServer();
