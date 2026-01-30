const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path'); // Added for localhost file serving

const app = express();
app.use(cors());

// --- NEW: SERVE YOUR HTML ON LOCALHOST ---
// This line tells the backend to serve your index.html and other files 
// so you can visit http://localhost:5000
app.use(express.static(__dirname));

// --- 1. CONNECT TO XAMPP DATABASE ---
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', 
  database: 'sensor_monitor'
});

db.connect(err => {
  if (err) {
    console.error("❌ XAMPP ERROR: " + err.message);
  } else {
    console.log('✅ Connected to XAMPP Database!');
    
    // AUTO-CREATE TABLE
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS sensor_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        distance INT NOT NULL,
        movement BOOLEAN NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    db.query(createTableQuery, (err) => {
      if (err) console.error("❌ Error creating table:", err.message);
      else console.log("✅ Database Table is Ready (Auto-Verified)");
    });
  }
});

// --- 2. CONNECT TO ARDUINO ---
const ARDUINO_PORT = 'COM4'; 
const port = new SerialPort({ path: ARDUINO_PORT, baudRate: 9600 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

let latest = { distance: 0, movement: false };

parser.on('data', (data) => {
  const parts = data.split(',');
  if (parts.length === 2) {
    latest.distance = parseInt(parts[0]);
    latest.movement = parts[1] === "1";

    if (latest.movement) {
      db.query('INSERT INTO sensor_history (distance, movement) VALUES (?, ?)', [latest.distance, 1], (err) => {
        if (err) console.error("❌ Save Error:", err.message);
        else console.log(`🔔 Movement at ${latest.distance}cm - Saved!`);
      });
    }
  }
});

// --- 3. API FOR UI ---
app.get('/sensor-data', (req, res) => {
  db.query('SELECT * FROM sensor_history ORDER BY timestamp DESC LIMIT 10', (err, rows) => {
    res.json({
      distance: latest.distance,
      movement: latest.movement,
      led: latest.movement,
      buzzer: latest.movement,
      history: rows || []
    });
  });
});

// Start the server
app.listen(5000, () => {
  console.log('\n🚀 SYSTEM ONLINE');
  console.log('👉 Dashboard: http://localhost:5000');
  console.log('👉 Raw Data:  http://localhost:5000/sensor-data');
});
