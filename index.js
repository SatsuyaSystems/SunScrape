// index.js (aktualisiert)

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const serverRoutes = require('./routes/serverRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// NEU: Füge URL-Encoded-Parser hinzu, um x-www-form-urlencoded zu verarbeiten
app.use(express.urlencoded({ extended: true })); // <-- DIES HINZUFÜGEN
app.use(express.json()); // Behält den JSON-Parser für zukünftige JSON-Anfragen bei

// Datenbank-Verbindung (bleibt gleich)
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('📦 MongoDB erfolgreich verbunden.');
    })
    .catch((err) => {
        console.error('❌ MongoDB Verbindungsfehler:', err);
        process.exit(1);
    });

// API Routen einbinden (bleibt gleich)
app.use('/api/servers', serverRoutes);

// Basis-Route (bleibt gleich)
app.get('/', (req, res) => {
    res.send('Minecraft Server Scanner API läuft. Nutze /api/servers.');
});

// Server starten (bleibt gleich)
app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
});