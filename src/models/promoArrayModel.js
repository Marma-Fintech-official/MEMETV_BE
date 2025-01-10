const mongoose = require('mongoose');

const arraySchema = new mongoose.Schema({
  data: [String],
});

const ArrayModel = mongoose.model('Array', arraySchema);
exports.module = ArrayModel;
