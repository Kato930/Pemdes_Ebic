const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());

// --- 1. CONNECT TO XAMPP DATABASE ---
// Make sure XAMPP is open and MySQL is "Started" (Green)
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // XAMPP default is empty
  database: 'sensor_monitor'
});

db.connect(err => {
  if (err) {
    console.error("❌ DATABASE ERROR: Is MySQL started in XAMPP?");
    // Don't kill the whole app, just log the error
  } else {
    console.log('✅ Successfully connected to XAMPP SQL Database!');
  }
});

// --- 2. CONNECT TO ARDUINO ---
// UPDATED TO COM4 AS REQUESTED
const ARDUINO_PORT = 'COM4'; 

const port = new SerialPort({ 
  path: ARDUINO_PORT, 
  baudRate: 9600,
  autoOpen: false 
});

// This opens the port and tells you exactly what's wrong if it fails
port.open((err) => {
  if (err) {
    console.error(`\n❌ ERROR: Could not find the Arduino on ${ARDUINO_PORT}`);
    console.log("\n--- TRY THESE STEPS: ---");
    console.log("1. Close the Serial Monitor in the Arduino IDE.");
    console.log("2. Unplug and replug the Arduino.");
    console.log("3. Make sure the Arduino IDE still says COM4 at the bottom right.");
    
    SerialPort.list().then(ports => {
      console.log("\nI currently see these ports on your laptop:");
      ports.forEach(p => console.log(`-> ${p.path}`));
    });
    return;
  }
  console.log(`✅ Listening to Arduino on ${ARDUINO_PORT}`);
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

let latestData = { distance: 0, movement: false };

parser.on('data', (line) => {
  const parts = line.split(',');
  if (parts.length === 2) {
    latestData.distance = parseInt(parts[0]);
    latestData.movement = parts[1] === "1";

    // Save to SQL Database only when movement is detected
    if (latestData.movement) {
      db.query('INSERT INTO sensor_history (distance, movement) VALUES (?, ?)', [latestData.distance, 1], (err) => {
        if (!err) console.log("🔔 Movement detected and saved to SQL!");
      });
    }
  }
});

// --- 3. API FOR YOUR HTML FRONTEND ---
app.get('/sensor-data', (req, res) => {
  db.query('SELECT * FROM sensor_history ORDER BY timestamp DESC LIMIT 10', (err, results) => {
    res.json({
      distance: latestData.distance,
      movement: latestData.movement,
      led: latestData.movement,
      buzzer: latestData.movement,
      history: results || []
    });
  });
});

app.listen(5000, () => {
  console.log('🚀 Backend is ALIVE at http://localhost:5000');
});
