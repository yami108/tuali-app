/**
 * Servicio de Desabasto Predictivo
 * Analiza ventas históricas + clima para predecir demanda
 */

const { getDB } = require('../db/init');

/**
 * Calcula la demanda promedio de un producto por día de la semana
 */
function getAvgDemand(productId, dayOfWeek = null) {
  const db = getDB();
  let query = `
    SELECT AVG(quantity) as avg_qty, COUNT(*) as days_sold
    FROM sales WHERE product_id = ?
  `;
  const params = [productId];

  if (dayOfWeek !== null) {
    query += ' AND day_of_week = ?';
    params.push(dayOfWeek);
  }

  return db.prepare(query).get(...params);
}

/**
 * Predice la demanda para los próximos N días
 */
function predictDemand(productId, daysAhead = 7) {
  const db = getDB();
  const today = new Date();

  let totalPredicted = 0;
  for (let i = 1; i <= daysAhead; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + i);
    const dow = futureDate.getDay();

    const demand = getAvgDemand(productId, dow);
    totalPredicted += demand?.avg_qty || 0;
  }

  // Ajuste por clima
  const weatherAdjust = getWeatherAdjustment(productId);
  totalPredicted = Math.ceil(totalPredicted * weatherAdjust);

  return totalPredicted;
}

/**
 * Ajuste de demanda basado en clima
 */
function getWeatherAdjustment(productId) {
  const db = getDB();
  const product = db.prepare('SELECT category FROM products WHERE id = ?').get(productId);
  if (!product) return 1;

  const weather = db.prepare('SELECT * FROM weather ORDER BY id DESC LIMIT 1').get();
  if (!weather) return 1;

  const temp = weather.temp_max || 25;

  // Si hace calor (>30°C), más demanda de aguas y refrescos
  if (temp > 30) {
    if (product.category === 'aguas') return 1.5;
    if (product.category === 'refrescos') return 1.3;
    if (product.category === 'energeticas') return 1.2;
  }

  // Si hace frío (<15°C), menos demanda de aguas
  if (temp < 15) {
    if (product.category === 'aguas') return 0.7;
    if (product.category === 'jugos') return 1.1; // Jugos calientes
  }

  // Día lluvioso
  if (weather.condition && weather.condition.includes('rain')) {
    if (product.category === 'snacks') return 1.3; // La gente se queda en casa
  }

  return 1;
}

/**
 * Revisa todos los productos con stock bajo según predicción
 */
function checkLowStock() {
  const db = getDB();
  const products = db.prepare('SELECT * FROM products').all();
  const alerts = [];

  for (const product of products) {
    const predictedDemand = predictDemand(product.id, 5); // Próximos 5 días
    const daysUntilEmpty = product.stock > 0 ? Math.floor(product.stock / (predictedDemand / 5)) : 0;

    if (product.stock <= product.min_stock || daysUntilEmpty <= 2) {
      const urgency = product.stock <= 2 ? 'critical' : product.stock <= product.min_stock ? 'high' : 'medium';

      const alert = {
        product_id: product.id,
        product_name: product.name,
        product_emoji: product.emoji,
        current_stock: product.stock,
        predicted_demand: predictedDemand,
        days_until_empty: daysUntilEmpty,
        urgency,
        recommended_qty: Math.max(predictedDemand - product.stock, product.min_stock),
        message: `${product.emoji} ${product.name}: quedan ${product.stock} unidades. Se estima que se acabará en ${daysUntilEmpty} días.`
      };

      alerts.push(alert);

      // Guardar en DB
      db.prepare(`
        INSERT INTO inventory_alerts (product_id, current_stock, predicted_demand, urgency, message)
        VALUES (?, ?, ?, ?, ?)
      `).run(product.id, product.stock, predictedDemand, urgency, alert.message);
    }
  }

  if (alerts.length > 0) {
    console.log(`[PREDICTIVE] ⚠️ ${alerts.length} alertas de desabasto generadas`);
  }

  return alerts;
}

/**
 * Obtiene recomendaciones por zona
 */
function getZoneRecommendations() {
  const db = getDB();
  const config = {};
  db.prepare('SELECT key, value FROM store_config').all().forEach(row => {
    config[row.key] = row.value;
  });

  const recommendations = [];

  // Kinder cercano -> jugos y snacks pequeños
  if (config.nearby_kinder) {
    const jugos = db.prepare("SELECT * FROM products WHERE category = 'jugos' ORDER BY stock ASC LIMIT 3").all();
    recommendations.push({
      zone: 'kinder',
      label: `🏫 ${config.nearby_kinder}`,
      reason: 'Los papás compran jugos y snacks para los niños a la hora de la salida (12:00-13:00)',
      products: jugos,
      peak_hours: '11:30 - 13:30'
    });
  }

  // Escuela -> snacks y agua
  if (config.nearby_school) {
    const snacks = db.prepare("SELECT * FROM products WHERE category IN ('snacks', 'aguas') ORDER BY stock ASC LIMIT 4").all();
    recommendations.push({
      zone: 'escuela',
      label: `🏫 ${config.nearby_school}`,
      reason: 'Los estudiantes compran snacks y agua en el recreo y a la salida',
      products: snacks,
      peak_hours: '10:00 - 10:30, 14:00 - 15:00'
    });
  }

  // Parque -> aguas y energéticas
  if (config.nearby_park) {
    const aguas = db.prepare("SELECT * FROM products WHERE category IN ('aguas', 'energeticas') ORDER BY stock ASC LIMIT 3").all();
    recommendations.push({
      zone: 'parque',
      label: `🌳 ${config.nearby_park}`,
      reason: 'La gente que hace ejercicio busca hidratación y bebidas deportivas',
      products: aguas,
      peak_hours: '06:00 - 08:00, 17:00 - 19:00'
    });
  }

  return recommendations;
}

/**
 * Obtiene el top de productos más vendidos
 */
function getTopProducts(days = 7, limit = 5) {
  const db = getDB();
  const date = new Date();
  date.setDate(date.getDate() - days);
  const dateStr = date.toISOString().split('T')[0];

  return db.prepare(`
    SELECT p.*, SUM(s.quantity) as total_sold, SUM(s.total) as revenue
    FROM sales s
    JOIN products p ON s.product_id = p.id
    WHERE s.date >= ?
    GROUP BY s.product_id
    ORDER BY total_sold DESC
    LIMIT ?
  `).all(dateStr, limit);
}

module.exports = { checkLowStock, predictDemand, getZoneRecommendations, getTopProducts, getWeatherAdjustment };
