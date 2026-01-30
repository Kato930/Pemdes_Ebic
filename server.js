const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());

// 1. DATABASE CONNECTION
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', 
  database: 'sensor_monitor'
});

db.connect(err => {
  if (err) console.error("❌ XAMPP Error: Is MySQL running?");
  else console.log('✅ Connected to XAMPP Database!');
});

// 2. ARDUINO CONNECTION (COM4)
const ARDUINO_PORT = 'COM4'; 
const port = new SerialPort({ path: ARDUINO_PORT, baudRate: 9600 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

let latest = { distance: 0, movement: false };

parser.on('data', (data) => {
  const parts = data.split(',');
  if (parts.length === 2) {
    latest.distance = parseInt(parts[0]);
    latest.movement = parts[1] === "1";

    // ONLY SAVE TO DATABASE IF MOVEMENT IS TRUE (Distance < 15)
    if (latest.movement) {
      db.query('INSERT INTO sensor_history (distance, movement) VALUES (?, ?)', [latest.distance, 1], (err) => {
        if (err) console.error("Database Save Error:", err);
        else console.log(`🔔 Movement detected at ${latest.distance}cm! Saved to XAMPP.`);
      });
    }
  }
});

// 3. API ENDPOINT
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

app.listen(5000, () => {
  console.log('🚀 Backend running at http://localhost:5000');
});
