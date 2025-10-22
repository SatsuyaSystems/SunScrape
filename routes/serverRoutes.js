// routes/serverRoutes.js

const express = require('express');
const router = express.Router();
const Server = require('../models/Server');
const { startRangeScan } = require('../lib/scanner');

// --- Public API Routes ---

/**
 * @route GET /api/servers
 * @description Get a list of online Minecraft servers, sorted by player count.
 * @access Public
 */
router.get('/', async (req, res) => {
    try {
        const servers = await Server.find({ online: true })
                                     .sort({ 'players.online': -1 })
                                     .limit(100);
        res.json(servers);
    } catch (err) {
        console.error("Error fetching server data:", err);
        res.status(500).json({ message: 'Error fetching server data' });
    }
});

/**
 * @route GET /api/servers/:ip
 * @description Get details for a specific server by its IP address.
 * @access Public
 */
router.get('/:ip', async (req, res) => {
    try {
        const server = await Server.findOne({ ip: req.params.ip });
        if (!server) {
            return res.status(404).json({ message: 'Server not found' });
        }
        res.json(server);
    } catch (err) {
        console.error("Error fetching server details:", err);
        res.status(500).json({ message: 'Error fetching server details' });
    }
});

// --- Scan Controller Route ---

/**
 * @route POST /api/servers/scan/range
 * @description Start a batch scan for a range of IP addresses.
 * @access Public
 */
router.post('/scan/range', async (req, res) => {
    const { startIp, endIp, batchSize = 25 } = req.body;

    if (!startIp || !endIp) {
        return res.status(400).json({ 
            message: 'Error: startIp and endIp must be provided in the request body.', 
            example: { startIp: "5.9.0.0", endIp: "5.9.255.255", batchSize: 100 }
        });
    }
    
    if (batchSize > 500) {
        return res.status(400).json({ message: 'Batch size is limited to a maximum of 500 to prevent system overload.' });
    }

    // Start the scan in the background
    startRangeScan(startIp, endIp, parseInt(batchSize, 10))
        .catch(error => console.error("Error during batch scan:", error));
    
    res.status(202).json({ 
        message: `Controlled batch scan (Batch Size: ${batchSize}) from ${startIp} to ${endIp} started in the background. See console & scan.log for results.` 
    });
});

module.exports = router;