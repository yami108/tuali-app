/**
 * Rutas de Auditoría de Entregas
 */

const express = require('express');
const router = express.Router();
const { auditDelivery, getDeliveryHistory, getPendingDelivery } = require('../services/delivery');
const { getDB } = require('../db/init');

/**
 * POST /api/delivery/audit
 * Registra la auditoría de una entrega
 * Body: { orderId, receivedItems: [{id, qty}], notes, photoUrl }
 */
router.post('/audit', (req, res) => {
  try {
    const { orderId, receivedItems, notes, photoUrl } = req.body;
    
    if (!orderId || !receivedItems) {
      return res.status(400).json({ error: 'orderId y receivedItems son requeridos' });
    }

    const result = auditDelivery(orderId, receivedItems, notes || '', photoUrl || '');
    
    if (result.error) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/delivery/history
 * Historial de entregas con auditoría
 */
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = getDeliveryHistory(limit);
    res.json({ deliveries: history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/delivery/pending
 * Obtiene la próxima entrega por recibir
 */
router.get('/pending', (req, res) => {
  try {
    const pending = getPendingDelivery();
    if (!pending) {
      return res.json({ pending: null, message: 'No hay entregas pendientes' });
    }
    res.json({ pending });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/delivery/confirm-quick
 * Confirmación rápida: todo llegó bien
 */
router.post('/confirm-quick', (req, res) => {
  try {
    const { orderId } = req.body;
    const db = getDB();
    
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

    const expectedItems = JSON.parse(order.items);
    // Confirmar que se recibió todo igual
    const result = auditDelivery(orderId, expectedItems, 'Confirmación rápida - todo correcto', '');
    
    res.json({
      ...result,
      message: '✅ Entrega confirmada. Todo recibido correctamente.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/delivery/report-issue
 * Reportar problema con una entrega
 */
router.post('/report-issue', (req, res) => {
  try {
    const { orderId, receivedItems, issueDescription } = req.body;
    
    if (!orderId || !receivedItems) {
      return res.status(400).json({ error: 'orderId y receivedItems son requeridos' });
    }

    const result = auditDelivery(orderId, receivedItems, issueDescription || 'Reporte de discrepancia', '');
    
    res.json({
      ...result,
      message: `⚠️ Reporte registrado. Se encontraron ${result.discrepancies.length} discrepancia(s). Tu ejecutivo será notificado.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
