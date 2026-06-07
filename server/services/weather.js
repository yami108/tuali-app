/**
 * Servicio de Clima
 * Obtiene datos meteorológicos para ajustar predicciones
 */

const { getDB } = require('../db/init');

/**
 * Actualiza datos del clima desde OpenWeatherMap (o usa datos simulados)
 */
async function updateWeatherData() {
  const db = getDB();
  const apiKey = process.env.WEATHER_API_KEY;
  const lat = process.env.STORE_LAT || '19.4326';
  const lng = process.env.STORE_LNG || '-99.1332';

  let weatherData;

  if (apiKey && apiKey !== 'tu_weather_api_key_aqui') {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&lang=es&appid=${apiKey}`
      );
      const data = await response.json();

      if (data.list) {
        // Guardar pronóstico de los próximos 5 días
        const dailyData = {};
        data.list.forEach(item => {
          const date = item.dt_txt.split(' ')[0];
          if (!dailyData[date]) {
            dailyData[date] = {
              temp_max: item.main.temp_max,
              temp_min: item.main.temp_min,
              condition: item.weather[0].main,
              humidity: item.main.humidity,
              description: item.weather[0].description,
              icon: item.weather[0].icon,
            };
          } else {
            dailyData[date].temp_max = Math.max(dailyData[date].temp_max, item.main.temp_max);
            dailyData[date].temp_min = Math.min(dailyData[date].temp_min, item.main.temp_min);
          }
        });

        const insert = db.prepare(`
          INSERT INTO weather (date, temp_max, temp_min, condition, humidity, description, icon)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        Object.entries(dailyData).forEach(([date, w]) => {
          insert.run(date, w.temp_max, w.temp_min, w.condition, w.humidity, w.description, w.icon);
        });

        console.log('[WEATHER] ✅ Datos del clima actualizados desde API');
        return;
      }
    } catch (error) {
      console.error('[WEATHER] Error al obtener clima:', error.message);
    }
  }

  // Fallback: datos simulados para CDMX
  const today = new Date();
  const simulated = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const month = date.getMonth();

    // Simulación por temporada en CDMX
    let temp_max, temp_min, condition;
    if (month >= 5 && month <= 9) { // Temporada de lluvias
      temp_max = 22 + Math.random() * 6;
      temp_min = 12 + Math.random() * 4;
      condition = Math.random() > 0.5 ? 'Rain' : 'Clouds';
    } else { // Temporada seca
      temp_max = 24 + Math.random() * 8;
      temp_min = 8 + Math.random() * 6;
      condition = Math.random() > 0.7 ? 'Clouds' : 'Clear';
    }

    simulated.push({
      date: dateStr,
      temp_max: Math.round(temp_max * 10) / 10,
      temp_min: Math.round(temp_min * 10) / 10,
      condition,
      humidity: 40 + Math.floor(Math.random() * 40),
      description: condition === 'Rain' ? 'lluvia ligera' : condition === 'Clouds' ? 'parcialmente nublado' : 'cielo despejado',
      icon: condition === 'Rain' ? '10d' : condition === 'Clouds' ? '03d' : '01d'
    });
  }

  const insert = db.prepare(`
    INSERT INTO weather (date, temp_max, temp_min, condition, humidity, description, icon)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  simulated.forEach(w => {
    insert.run(w.date, w.temp_max, w.temp_min, w.condition, w.humidity, w.description, w.icon);
  });

  console.log('[WEATHER] 🌤️ Datos del clima simulados insertados');
}

/**
 * Obtiene el pronóstico actual y próximos días
 */
function getWeatherForecast(days = 3) {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  return db.prepare(`
    SELECT * FROM weather WHERE date >= ? ORDER BY date ASC LIMIT ?
  `).all(today, days);
}

/**
 * Genera recomendaciones basadas en el clima
 */
function getWeatherRecommendations() {
  const forecast = getWeatherForecast(1);
  if (!forecast || forecast.length === 0) return null;

  const today = forecast[0];
  const recommendations = [];

  if (today.temp_max > 30) {
    recommendations.push({
      type: 'hot',
      message: `🌡️ Se esperan ${Math.round(today.temp_max)}°C hoy. Las aguas y refrescos fríos se venderán más.`,
      boost_categories: ['aguas', 'refrescos'],
      boost_factor: 1.4
    });
  }

  if (today.condition === 'Rain') {
    recommendations.push({
      type: 'rain',
      message: `🌧️ Se espera lluvia. Los snacks y productos de impulso suben de demanda.`,
      boost_categories: ['snacks'],
      boost_factor: 1.3
    });
  }

  if (today.temp_max < 18) {
    recommendations.push({
      type: 'cold',
      message: `❄️ Día fresco (${Math.round(today.temp_max)}°C). Los jugos y bebidas calientes se venden bien.`,
      boost_categories: ['jugos'],
      boost_factor: 1.2
    });
  }

  return { current: today, recommendations };
}

module.exports = { updateWeatherData, getWeatherForecast, getWeatherRecommendations };
