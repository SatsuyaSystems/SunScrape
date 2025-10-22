// index.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const serverRoutes = require('./routes/serverRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
// Add URL-encoded parser to handle x-www-form-urlencoded requests
app.use(express.urlencoded({ extended: true }));
// Add JSON parser for handling JSON requests
app.use(express.json());

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('📦 Successfully connected to MongoDB.');
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

// --- API Routes ---
app.use('/api/servers', serverRoutes);

// --- Base Route ---
app.get('/', (req, res) => {
    res.send('Minecraft Server Scanner API is running. Use /api/servers to access the data.');
});

// --- Server Startup ---
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});