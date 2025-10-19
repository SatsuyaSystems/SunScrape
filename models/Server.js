// models/Server.js

const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
    ip: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true // Index für schnelle Abfragen
    },
    port: { 
        type: Number, 
        default: 25565 
    },
    online: { 
        type: Boolean, 
        default: false 
    },
    motd: String,
    players: {
        online: Number,
        max: Number
    },
    version: String,
    lastScanned: { 
        type: Date, 
        default: Date.now 
    },
}, { timestamps: true }); // Fügt createdAt und updatedAt hinzu

module.exports = mongoose.model('Server', serverSchema);