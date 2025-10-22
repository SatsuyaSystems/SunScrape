// lib/scanner.js

const net = require('net');
const mcUtil = require('minecraft-server-util');
const fs = require('fs');
const path = require('path');
const Server = require('../models/Server');

const MINECRAFT_PORT = 25565;
const SCAN_TIMEOUT = 3000;
const LOG_FILE = path.join(__dirname, '..', 'scan.log');
const BATCH_PAUSE_MS = 50; // 50ms pause after each batch

/**
 * Logs a message to the console and optionally to a log file.
 * @param {string} message - The message to log.
 * @param {boolean} [consoleOnly=false] - If true, only logs to the console.
 */
function log(message, consoleOnly = false) {
    const timestamp = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const logMessage = `[${timestamp}] ${message}\n`;

    // Log to console
    console.log(message);

    // Write to log file
    if (!consoleOnly) {
        try {
            fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
        } catch (e) {
            console.error("Error writing to log file:", e.message);
        }
    }
}

/**
 * Converts an IP address string to a 32-bit integer.
 * @param {string} ip - The IP address to convert.
 * @returns {number} The numeric representation of the IP.
 */
function ipToNumber(ip) {
    if (!ip) return 0;
    const parts = ip.split('.').map(Number);
    return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

/**
 * Converts a 32-bit integer to an IP address string.
 * @param {number} num - The number to convert.
 * @returns {string} The IP address string.
 */
function numberToIp(num) {
    return [
        (num >>> 24) & 0xFF,
        (num >>> 16) & 0xFF,
        (num >>> 8) & 0xFF,
        num & 0xFF
    ].join('.');
}

/**
 * Checks if an IP number belongs to a private or reserved range.
 * @param {number} ipNum - The numeric representation of the IP.
 * @returns {boolean} True if the IP is private or reserved.
 */
function isPrivateOrReserved(ipNum) {
    const byte1 = ipNum >>> 24;
    const byte2 = (ipNum >>> 16) & 0xFF;

    if (byte1 === 0) return true;   // 0.0.0.0/8
    if (byte1 === 10) return true;  // 10.0.0.0/8
    if (byte1 === 127) return true; // 127.0.0.0/8
    if (byte1 === 172 && (byte2 >= 16 && byte2 <= 31)) return true; // 172.16.0.0/12
    if (byte1 === 192 && byte2 === 168) return true; // 192.168.0.0/16
    if ((ipNum >>> 28) === 14) return true; // Reserved for multicast
    if ((ipNum >>> 28) === 15) return true; // Reserved for future use
    return false;
}

/**
 * Checks if a specific port is open on a host.
 * @param {string} host - The host IP address.
 * @param {number} [port=MINECRAFT_PORT] - The port to check.
 * @returns {Promise<boolean>} A promise that resolves to true if the port is open, false otherwise.
 */
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

/**
 * Gets the status of a Minecraft server.
 * @param {string} host - The host IP address.
 * @param {number} [port=MINECRAFT_PORT] - The server port.
 * @returns {Promise<object|null>} A promise that resolves to the server status object or null if an error occurs.
 */
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

/**
 * Scans a single IP address for a Minecraft server and saves the data if found.
 * @param {string} ip - The IP address to scan.
 * @param {number} [port=MINECRAFT_PORT] - The port to scan.
 */
async function scanAndSave(ip, port = MINECRAFT_PORT) {
    const isPortOpen = await checkPort(ip, port);

    if (!isPortOpen) {
        log(`🔴 ${ip}:${port} - Port closed or timeout.`, true);
        return;
    }

    const statusData = await getMinecraftStatus(ip, port);

    if (statusData) {
        await Server.findOneAndUpdate(
            { ip, port },
            { ...statusData, lastScanned: Date.now() },
            { upsert: true, new: true }
        );
        log(`🟢 ${ip}:${port} - ONLINE! Players: ${statusData.players.online}/${statusData.players.max}`);
    } else {
        log(`🟡 ${ip}:${port} - Port open, but no Minecraft response. (Ignored)`);
    }
}

/**
 * Starts a concurrent scan of an IP range in batches.
 * @param {string} startIp - The starting IP address of the range.
 * @param {string} endIp - The ending IP address of the range.
 * @param {number} [batchSize=25] - The number of concurrent scans in each batch.
 */
async function startRangeScan(startIp, endIp, batchSize = 25) {
    if (!startIp || !endIp) {
        log("Error: Start or end IP is missing. Scan aborted.", true);
        return;
    }

    // Initialize log file (overwrite old logs)
    try {
        fs.writeFileSync(LOG_FILE, `\n--- NEW SCAN STARTED ${new Date().toLocaleString('en-US')} ---\n`, 'utf8');
    } catch (e) {
        console.error("ERROR initializing log file:", e.message);
    }

    let currentNum = ipToNumber(startIp);
    const endNum = ipToNumber(endIp);

    if (currentNum > endNum) {
        log("❌ Start IP is greater than end IP. Scan aborted.", true);
        return;
    }

    const totalScanable = endNum - currentNum;

    log(`\n================================================================`, true);
    log(`SCAN START: ${new Date().toLocaleString('en-US')}`, true);
    log(`Range: ${startIp} to ${endIp} | Estimated ${totalScanable} IPs`, true);
    log(`Mode: CONTROLLED BATCH | Batch Size: ${batchSize} | Pause: ${BATCH_PAUSE_MS}ms`, true);
    log(`================================================================`, true);

    // Main batch logic
    while (currentNum <= endNum) {
        const batchPromises = [];
        const startIpBatch = numberToIp(currentNum);

        for (let i = 0; i < batchSize && currentNum <= endNum; i++) {
            const ipNum = currentNum;
            const ip = numberToIp(ipNum);

            if (!isPrivateOrReserved(ipNum)) {
                batchPromises.push(scanAndSave(ip, MINECRAFT_PORT));
            }
            currentNum++;
        }

        // Wait for all concurrent requests in the batch to complete
        await Promise.allSettled(batchPromises);

        const endIpBatch = numberToIp(Math.min(currentNum - 1, endNum));

        // Log batch progress to the console
        log(`\n✅ Batch complete: ${startIpBatch} - ${endIpBatch}.`, true);

        if (currentNum <= endNum) {
            // Brief pause to relieve system load
            await new Promise(resolve => setTimeout(resolve, BATCH_PAUSE_MS));
        }
    }

    log(`================================================================`, true);
    log(`SCAN END: ${new Date().toLocaleString('en-US')}`, true);
    log(`================================================================\n`, true);
}

module.exports = {
    scanAndSave,
    startRangeScan
};
