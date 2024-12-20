const mongoose = require('mongoose');

// Define the schema for the Quiz model
const quizSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  question: {
    type: String,
    required: true
  },
  options: {
    type: [String], // Array of strings for multiple choice options
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  date: {
    type: Date, // Store date as a Date object
    required: true
  }
}, {
  timestamps: true // Optional: adds createdAt and updatedAt fields
});

// Create and export the model
const Quiz = mongoose.model('Quiz', quizSchema);

module.exports = Quiz;
