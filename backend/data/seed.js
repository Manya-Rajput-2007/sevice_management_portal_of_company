const User = require('../models/User');
const Machine = require('../models/Machine');
const ServiceRequest = require('../models/ServiceRequest');

async function seedDemoData() {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    return;
  }

  const owner = await User.create({
    name: 'Owner Admin',
    email: 'owner@portal.com',
    password: 'Password123',
    role: 'owner',
  });

  const manager = await User.create({
    name: 'Manager Olivia',
    email: 'manager@portal.com',
    password: 'Password123',
    role: 'manager',
  });

  const engineer = await User.create({
    name: 'Engineer Liam',
    email: 'engineer@portal.com',
    password: 'Password123',
    role: 'engineer',
    managerId: manager._id,
  });

  const customer = await User.create({
    name: 'Customer Maya',
    email: 'customer@portal.com',
    password: 'Password123',
    role: 'customer',
    managerId: manager._id,
  });

  const machineOne = await Machine.create({
    name: 'Hydraulic Press 14A',
    model: 'HP-14A',
    serialNumber: 'HP-14A-1001',
    customerId: customer._id,
    managerId: manager._id,
    location: 'Plant South Bay',
    status: 'Service Due',
  });

  const machineTwo = await Machine.create({
    name: 'Cooling Tower CT-7',
    model: 'CT-7',
    serialNumber: 'CT-7-2049',
    customerId: customer._id,
    managerId: manager._id,
    location: 'Unit 5 Warehouse',
    status: 'Operational',
  });

  await ServiceRequest.create({
    title: 'Hydraulic pressure drop',
    description: 'The main press is dropping pressure during the second cycle and the operator reports vibrations.',
    customerId: customer._id,
    machineId: machineOne._id,
    managerId: manager._id,
    engineerId: engineer._id,
    status: 'In Progress',
    priority: 'High',
  });

  await ServiceRequest.create({
    title: 'Cooling tower inspection',
    description: 'Perform a routine inspection and verify the fan alignment and water circulation.',
    customerId: customer._id,
    machineId: machineTwo._id,
    managerId: manager._id,
    engineerId: engineer._id,
    status: 'Open',
    priority: 'Medium',
  });

  return { owner, manager, engineer, customer };
}

module.exports = { seedDemoData };
