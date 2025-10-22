// models/Server.js

const mongoose = require('mongoose');

/**
 * @typedef {object} PlayerInfo
 * @property {number} online - The number of online players.
 * @property {number} max - The maximum number of players allowed.
 */

/**
 * @typedef {object} Server
 * @property {string} ip - The IP address of the server.
 * @property {number} port - The port of the server.
 * @property {boolean} online - Whether the server is currently online.
 * @property {string} motd - The message of the day of the server.
 * @property {PlayerInfo} players - Information about the players on the server.
 * @property {string} version - The version of the server.
 * @property {Date} lastScanned - The last time the server was scanned.
 * @property {Date} createdAt - The timestamp of when the server was created.
 * @property {Date} updatedAt - The timestamp of when the server was last updated.
 */

/**
 * Mongoose schema for a Minecraft server.
 * @type {mongoose.Schema<Server>}
 */
const serverSchema = new mongoose.Schema({
    ip: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true // Index for faster queries
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
}, { timestamps: true }); // Adds createdAt and updatedAt timestamps

module.exports = mongoose.model('Server', serverSchema);