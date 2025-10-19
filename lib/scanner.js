// lib/scanner.js

const net = require('net');
const mcUtil = require('minecraft-server-util');
const fs = require('fs');
const path = require('path');
const Server = require('../models/Server');

const MINECRAFT_PORT = 25565;
const SCAN_TIMEOUT = 3000;
const LOG_FILE = path.join(__dirname, '..', 'scan.log'); 
const BATCH_PAUSE_MS = 50; // 500ms Pause nach jedem Batch

// --- LOG-FUNKTION ---
function log(message, consoleOnly = false) {
    const timestamp = new Date().toLocaleString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const logMessage = `[${timestamp}] ${message}\n`;

    // Schreibe in die Konsole
    console.log(message);

    // Schreibe in die Log-Datei
    if (!consoleOnly) {
        try {
            fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
        } catch (e) {
            console.error("Fehler beim Schreiben der Log-Datei:", e.message);
        }
    }
}
// -----------------------------

// --- Hilfsfunktionen für IP-Konvertierung und Filterung ---

function ipToNumber(ip) {
    if (!ip) return 0; 
    const parts = ip.split('.').map(Number);
    return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0; 
}

function numberToIp(num) {
    return [
        (num >>> 24) & 0xFF,
        (num >>> 16) & 0xFF,
        (num >>> 8) & 0xFF,
        num & 0xFF
    ].join('.');
}

function isPrivateOrReserved(ipNum) {
    if ((ipNum >>> 24) === 0) return true;
    if ((ipNum >>> 24) === 10) return true;
    if ((ipNum >>> 24) === 127) return true;
    if (((ipNum >>> 20) & 0xFFF) === 172 * 16 + 16) return true;
    if (((ipNum >>> 16) & 0xFFFF) === 192 * 256 + 168) return true;
    if ((ipNum >>> 28) === 14) return true; 
    if ((ipNum >>> 28) === 15) return true;
    return false;
}

// --- Netzwerk- und Protokollfunktionen ---

function checkPort(host, port = MINECRAFT_PORT) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(SCAN_TIMEOUT);
        socket.on('connect', () => { socket.destroy(); resolve(true); });
        socket.on('timeout', () => { socket.destroy(); resolve(false); });
        socket.on('error', () => { socket.destroy(); resolve(false); });
        socket.connect(port, host);
    });
}

async function getMinecraftStatus(host, port = MINECRAFT_PORT) {
    try {
        const status = await mcUtil.status(host, port, { timeout: SCAN_TIMEOUT });
        return {
            online: true,
            motd: status.motd.clean,
            players: { online: status.players.online, max: status.players.max },
            version: status.version.name
        };
    } catch (error) {
        return null;
    }
}

async function scanAndSave(ip, port = MINECRAFT_PORT) {
    const isPortOpen = await checkPort(ip, port);

    if (!isPortOpen) {
        // Rote Meldungen nur in die Log-Datei, nicht in die Konsole
        log(`🔴 ${ip}:${port} - Port geschlossen/Timeout.`, true); 
        return;
    }

    const statusData = await getMinecraftStatus(ip, port);

    if (statusData) {
        // Grüne Meldungen in Konsole und Log-Datei
        await Server.findOneAndUpdate(
            { ip, port },
            { ...statusData, lastScanned: Date.now() },
            { upsert: true, new: true }
        );
        log(`🟢 ${ip}:${port} - ONLINE! Spieler: ${statusData.players.online}/${statusData.players.max}`);
    } else {
        // Gelbe Meldungen in Konsole und Log-Datei
        log(`🟡 ${ip}:${port} - Port offen, aber keine MC-Antwort. (Ignoriert)`);
    }
}


// --- Hauptfunktion für den IP-Bereich-Scan (Batch/Concurrency) ---

/**
 * Startet den Scan mit kontrollierter Gleichzeitigkeit (Batches).
 */
async function startConcurrentStream(startIp, endIp, batchSize = 25) {
    if (!startIp || !endIp) {
        log("Fehler: Start- oder End-IP fehlt. Scan abgebrochen.", true);
        return;
    }
    
    // Log-Datei initialisieren (alte Logs überschreiben)
    try {
        fs.writeFileSync(LOG_FILE, `\n--- NEUER SCAN GESTARTET ${new Date().toLocaleString()} ---\n`, 'utf8');
    } catch (e) {
        console.error("FEHLER beim Initialisieren der Log-Datei:", e.message);
    }
    
    let currentNum = ipToNumber(startIp);
    const endNum = ipToNumber(endIp);
    
    if (currentNum > endNum) {
        log("❌ Start-IP ist größer als End-IP. Scan abgebrochen.", true);
        return;
    }
    
    const totalScanable = endNum - currentNum;

    log(`\n================================================================`, true);
    log(`SCAN-START: ${new Date().toLocaleString()}`, true);
    log(`Bereich: ${startIp} bis ${endIp} | Geschätzte ${totalScanable} IPs`, true);
    log(`Modus: KONTROLLIERTER BATCH | Batch-Größe: ${batchSize} | Pause: ${BATCH_PAUSE_MS}ms`, true);
    log(`================================================================`, true);

    // Haupt-Batch-Logik
    while (currentNum <= endNum) {
        const batchPromises = [];
        const startIpBatch = numberToIp(currentNum);
        
        for (let i = 0; i < batchSize && currentNum <= endNum; i++) {
            const ip = numberToIp(currentNum);
            
            if (!isPrivateOrReserved(currentNum)) { 
                batchPromises.push(scanAndSave(ip, MINECRAFT_PORT));
            }
            currentNum++;
        }
        
        // Wartet auf den Abschluss aller gleichzeitigen Anfragen
        await Promise.allSettled(batchPromises); 
        
        const endIpBatch = numberToIp(Math.min(currentNum - 1, endNum));
        
        // Batch-Fortschritt in die Konsole
        log(`\n✅ Batch abgeschlossen: ${startIpBatch} - ${endIpBatch}.`, true);
        
        if (currentNum <= endNum) {
            // Kurze Pause zur Entlastung
            await new Promise(resolve => setTimeout(resolve, BATCH_PAUSE_MS));
        }
    }

    log(`================================================================`, true);
    log(`SCAN-ENDE: ${new Date().toLocaleString()}`, true);
    log(`================================================================\n`, true);
}

module.exports = { 
    scanAndSave, 
    startSequentialScan: startConcurrentStream 
};