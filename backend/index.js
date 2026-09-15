const { app } = require('./server');
const { connectDB } = require('./config/db');
const { seedDemoData } = require('./data/seed');

let initialized;

async function initialize() {
  if (!initialized) {
    initialized = connectDB().then(() => seedDemoData());
  }
  await initialized;
}

module.exports = async (req, res) => {
  await initialize();
  return app(req, res);
};
