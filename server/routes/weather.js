/**
 * Rutas del Clima
 */

const express = require('express');
const router = express.Router();
const { updateWeatherData, getWeatherForecast, getWeatherRecommendations } = require('../services/weather');

/**
 * GET /api/weather/forecast
 * Pronóstico del clima
 */
router.get('/forecast', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 3;
    const forecast = getWeatherForecast(days);
    
    if (forecast.length === 0) {
      // Si no hay datos, generar simulados
      updateWeatherData();
      const newForecast = getWeatherForecast(days);
      return res.json({ forecast: newForecast });
    }
    
    res.json({ forecast });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/weather/recommendations
 * Recomendaciones basadas en clima
 */
router.get('/recommendations', (req, res) => {
  try {
    const recommendations = getWeatherRecommendations();
    if (!recommendations) {
      return res.json({ recommendations: [], message: 'No hay datos de clima disponibles' });
    }
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/weather/refresh
 * Fuerza actualización del clima
 */
router.post('/refresh', async (req, res) => {
  try {
    await updateWeatherData();
    const forecast = getWeatherForecast(3);
    res.json({ ok: true, forecast });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
