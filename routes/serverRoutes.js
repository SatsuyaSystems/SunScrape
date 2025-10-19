// routes/serverRoutes.js

const express = require('express');
const router = express.Router();
const Server = require('../models/Server');
const { startSequentialScan } = require('../lib/scanner'); 

// --- Öffentliche API-Routen ---

router.get('/', async (req, res) => {
    try {
        const servers = await Server.find({ online: true })
                                     .sort({ 'players.online': -1 })
                                     .limit(100);
        res.json(servers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Fehler beim Abrufen der Serverdaten' });
    }
});

router.get('/:ip', async (req, res) => {
    try {
        const server = await Server.findOne({ ip: req.params.ip });
        if (!server) {
            return res.status(404).json({ message: 'Server nicht gefunden' });
        }
        res.json(server);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Fehler beim Abrufen der Serverdetails' });
    }
});

// --- Controller-Route für den Scan ---

// POST /api/servers/scan/range - Startet den Batch-Scan
router.post('/scan/range', async (req, res) => {
    
    const startIp = req.body.startIp; 
    const endIp = req.body.endIp;     
    // Lese batchSize mit Standardwert 25
    const batchSize = req.body.batchSize || 25; 

    if (!startIp || !endIp) {
        return res.status(400).json({ 
            message: 'Fehler: Start- und End-IP müssen im Body enthalten sein. Bitte Body-Typ auf RAW/JSON setzen.', 
            example: { startIp: "5.9.0.0", endIp: "5.9.255.255", batchSize: 100 }
        });
    }
    
    if (batchSize > 500) {
        return res.status(400).json({ message: 'Batch Size auf maximal 500 beschränkt, um Systemüberlastung zu vermeiden.' });
    }

    // Starte den Scan und übergib batchSize
    startSequentialScan(startIp, endIp, batchSize) 
        .catch(error => console.error("Fehler im Batch-Scan:", error));
    
    res.json({ 
        message: `Kontrollierter Batch-Scan (Batch: ${batchSize}) von ${startIp} bis ${endIp} im Hintergrund gestartet. Ergebnisse in Konsole & scan.log.` 
    });
});

module.exports = router;