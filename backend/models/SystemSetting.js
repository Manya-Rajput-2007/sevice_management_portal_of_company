const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  running: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
