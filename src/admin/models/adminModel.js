const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true,
         unique: true },
    password: {
         type: String, 
         required: function () {
            // Require password for non-Google and non-apple users
            return this.provider !== "google" && this.provider !== "apple";
          }
        },
    provider: {
            type: String,
            enum: ["app", "google"],
            default: "app",
            required: true,
          },
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
