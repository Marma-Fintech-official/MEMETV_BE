const bcrypt = require('bcryptjs');
const Admin = require('../models/adminModel');
const mongoose = require('mongoose')
require('dotenv').config()

  // Connect to MongoDB
  mongoose
    .connect(process.env.DBURL, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000
    })
    .then(() => {
      console.log(
        '*********🛡️ 🔍  Successfully Connected to MongoDB Stagging🛡️ 🔍 **********'
      )
    })
    .catch(err => {
      console.error('MongoDB Connection Failure', err)
    })

// Function to generate a random password
const generatePassword = () => {
    return Math.random().toString(36).slice(-8); // Generates an 8-character password
};

// Create Admin User
const createAdminUser = async () => {
    try {
        const adminEmail = 'ramya@throughbit.com'; // You can modify this
        const adminPassword = generatePassword();

        // Hash the password
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: adminEmail });
        if (existingAdmin) {
            console.log('Admin already exists:', existingAdmin.email);
            return;
        }

        // Save to database
        const newAdmin = new Admin({
            email: adminEmail,
            password: hashedPassword
        });

        await newAdmin.save();
        console.log(`Admin created successfully! Email: ${adminEmail}, Password: ${adminPassword}`);

    } catch (error) {
        console.error('Error creating admin user:', error);
    }
};

// Call the function to create an admin user
createAdminUser();
