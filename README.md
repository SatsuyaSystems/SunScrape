# SunScrape - Minecraft Server Scanner

SunScrape is a Node.js application that scans IP address ranges for open Minecraft servers, retrieves their status, and saves the information to a MongoDB database. It provides a simple API to view the discovered servers.

## Features

-   Scan IP ranges for Minecraft servers.
-   Concurrent scanning with configurable batch sizes.
-   Saves server data (MOTD, player count, version) to MongoDB.
-   API to list found servers.
-   Logs scan progress to console and a log file (`scan.log`).

## Prerequisites

-   Node.js (v14 or higher)
-   MongoDB server

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/SatsuyaSystems/SunScrape.git
    cd SunScrape
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create a `.env` file:**
    Create a file named `.env` in the root of the project and add the following environment variables:

    ```
    # The port for the API server to run on
    PORT=3000

    # Your MongoDB connection string
    MONGO_URI=mongodb://localhost:27017/sunscrape
    ```

4.  **Start the server:**
    ```bash
    npm start
    ```
    The API server will be running on the port specified in your `.env` file (default: 3000).

## API Usage

### Get All Online Servers

-   **URL:** `/api/servers`
-   **Method:** `GET`
-   **Description:** Retrieves a list of all servers marked as online, sorted by the number of online players in descending order.
-   **Success Response:**
    -   **Code:** 200 OK
    -   **Content:** `[{ "ip": "...", "port": 25565, ... }]`

### Get Server by IP

-   **URL:** `/api/servers/:ip`
-   **Method:** `GET`
-   **Description:** Retrieves the details of a specific server by its IP address.
-   **Success Response:**
    -   **Code:** 200 OK
    -   **Content:** `{ "ip": "...", "port": 25565, ... }`
-   **Error Response:**
    -   **Code:** 404 Not Found
    -   **Content:** `{ "message": "Server not found" }`

### Start an IP Range Scan

-   **URL:** `/api/servers/scan/range`
-   **Method:** `POST`
-   **Description:** Starts a background scan for a given IP address range.
-   **Body (raw JSON):**
    ```json
    {
        "startIp": "5.9.0.0",
        "endIp": "5.9.255.255",
        "batchSize": 100
    }
    ```
    -   `startIp` (required): The starting IP of the scan range.
    -   `endIp` (required): The ending IP of the scan range.
    -   `batchSize` (optional): The number of IPs to scan concurrently. Defaults to 25. Max is 500.
-   **Success Response:**
    -   **Code:** 202 Accepted
    -   **Content:** `{ "message": "Controlled batch scan (Batch Size: 100) from 5.9.0.0 to 5.9.255.255 started in the background. See console & scan.log for results." }`

## How it Works

The scanner works by iterating through the given IP range. For each IP, it first checks if the default Minecraft port (25565) is open. If the port is open, it then attempts to get the Minecraft server status. If a valid Minecraft server is found, its information is saved or updated in the MongoDB database.

The scan runs in the background to prevent blocking the API. You can monitor the progress in the console or in the `scan.log` file.