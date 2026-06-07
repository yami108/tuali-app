/**
 * TUALI AI - Servidor Backend
 * Integra: Gemini API, Desabasto Predictivo, Auditoría de Entregas, Clima
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const { initDB } = require('./db/init');
const aiRoutes = require('./routes/ai');
const predictiveRoutes = require('./routes/predictive');
const deliveryRoutes = require('./routes/delivery');
const weatherRoutes = require('./routes/weather');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Inicializar base de datos
initDB();

// Rutas API
app.use('/api/ai', aiRoutes);
app.use('/api/predictive', predictiveRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/weather', weatherRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', ai: 'Gemini Pro' });
});

// Cron job: Revisar inventario cada hora para alertas de desabasto
cron.schedule('0 * * * *', () => {
  const { checkLowStock } = require('./services/predictive');
  console.log('[CRON] Revisando inventario para alertas de desabasto...');
  checkLowStock();
});

// Cron job: Actualizar clima cada 3 horas
cron.schedule('0 */3 * * *', () => {
  const { updateWeatherData } = require('./services/weather');
  console.log('[CRON] Actualizando datos del clima...');
  updateWeatherData();
});

// Fallback: servir index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║     🤖 TUALI AI Server v2.0.0           ║
║     Puerto: ${PORT}                          ║
║     AI: Google Gemini Pro                ║
║     DB: SQLite                           ║
╚══════════════════════════════════════════╝
  `);
});
