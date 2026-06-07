/**
 * Rutas de Desabasto Predictivo
 */

const express = require('express');
const router = express.Router();
const { checkLowStock, getZoneRecommendations, getTopProducts, predictDemand } = require('../services/predictive');
const { getDB } = require('../db/init');

/**
 * GET /api/predictive/alerts
 * Obtiene alertas de desabasto actuales
 */
router.get('/alerts', (req, res) => {
  try {
    const alerts = checkLowStock();
    res.json({ alerts, count: alerts.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/predictive/recommendations
 * Recomendaciones basadas en zona
 */
router.get('/recommendations', (req, res) => {
  try {
    const recommendations = getZoneRecommendations();
    res.json({ recommendations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/predictive/top-products
 * Top productos más vendidos
 */
router.get('/top-products', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const limit = parseInt(req.query.limit) || 5;
    const topProducts = getTopProducts(days, limit);
    res.json({ topProducts, period: `${days} días` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/predictive/demand/:productId
 * Predicción de demanda para un producto específico
 */
router.get('/demand/:productId', (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const days = parseInt(req.query.days) || 7;
    const predicted = predictDemand(productId, days);
    
    const db = getDB();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    
    res.json({
      product,
      predicted_demand: predicted,
      days_ahead: days,
      days_until_empty: product ? Math.floor(product.stock / (predicted / days)) : 0,
      needs_restock: product ? product.stock <= product.min_stock : false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/predictive/suggested-order
 * Genera un pedido sugerido completo
 */
router.get('/suggested-order', (req, res) => {
  try {
    const db = getDB();
    const products = db.prepare('SELECT * FROM products WHERE stock <= min_stock + 3').all();
    
    const suggestedItems = products.map(p => {
      const predicted = predictDemand(p.id, 7);
      const suggestedQty = Math.max(predicted - p.stock + p.min_stock, 1);
      return {
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        current_stock: p.stock,
        suggested_qty: suggestedQty,
        price: p.price,
        subtotal: suggestedQty * p.price
      };
    });

    const total = suggestedItems.reduce((s, item) => s + item.subtotal, 0);

    res.json({
      items: suggestedItems,
      total,
      item_count: suggestedItems.length,
      reason: 'Basado en ventas históricas, clima y niveles de inventario'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
