/**
 * Servicio de Auditoría de Entregas
 * Verifica que lo recibido coincida con lo pedido
 */

const { getDB } = require('../db/init');

/**
 * Registra una nueva entrega y verifica discrepancias
 */
function auditDelivery(orderId, receivedItems, notes = '', photoUrl = '') {
  const db = getDB();

  // Obtener pedido original
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { error: 'Pedido no encontrado' };

  const expectedItems = JSON.parse(order.items);
  const discrepancies = findDiscrepancies(expectedItems, receivedItems);

  const status = discrepancies.length === 0 ? 'completed' : 'completed_with_issues';
  const discrepancyJson = discrepancies.length > 0 ? JSON.stringify({ issues: discrepancies }) : null;

  // Guardar entrega
  const result = db.prepare(`
    INSERT INTO deliveries (order_id, driver_name, expected_items, received_items, status, discrepancy, photo_url, notes, scheduled_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    orderId,
    'Repartidor',
    JSON.stringify(expectedItems),
    JSON.stringify(receivedItems),
    status,
    discrepancyJson,
    photoUrl,
    notes,
    order.estimated_delivery
  );

  // Actualizar stock con lo recibido
  receivedItems.forEach(item => {
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.qty, item.id);
  });

  // Actualizar estatus del pedido
  db.prepare("UPDATE orders SET status = 'delivered', delivered_at = datetime('now') WHERE id = ?").run(orderId);

  return {
    delivery_id: result.lastInsertRowid,
    status,
    discrepancies,
    summary: generateAuditSummary(expectedItems, receivedItems, discrepancies)
  };
}

/**
 * Encuentra discrepancias entre lo esperado y lo recibido
 */
function findDiscrepancies(expected, received) {
  const discrepancies = [];
  const db = getDB();

  // Crear mapa de recibidos
  const receivedMap = {};
  received.forEach(item => { receivedMap[item.id] = item.qty; });

  // Verificar cada item esperado
  expected.forEach(exp => {
    const product = db.prepare('SELECT name, emoji FROM products WHERE id = ?').get(exp.id);
    const receivedQty = receivedMap[exp.id] || 0;

    if (receivedQty === 0) {
      discrepancies.push({
        type: 'missing',
        product_id: exp.id,
        product_name: product?.name || `Producto #${exp.id}`,
        emoji: product?.emoji || '📦',
        expected: exp.qty,
        received: 0,
        message: `${product?.emoji} ${product?.name}: No recibido (esperado: ${exp.qty})`
      });
    } else if (receivedQty < exp.qty) {
      discrepancies.push({
        type: 'shortage',
        product_id: exp.id,
        product_name: product?.name || `Producto #${exp.id}`,
        emoji: product?.emoji || '📦',
        expected: exp.qty,
        received: receivedQty,
        difference: exp.qty - receivedQty,
        message: `${product?.emoji} ${product?.name}: Recibido ${receivedQty} de ${exp.qty} (faltan ${exp.qty - receivedQty})`
      });
    } else if (receivedQty > exp.qty) {
      discrepancies.push({
        type: 'excess',
        product_id: exp.id,
        product_name: product?.name || `Producto #${exp.id}`,
        emoji: product?.emoji || '📦',
        expected: exp.qty,
        received: receivedQty,
        difference: receivedQty - exp.qty,
        message: `${product?.emoji} ${product?.name}: Recibido ${receivedQty} (esperado: ${exp.qty}, sobran ${receivedQty - exp.qty})`
      });
    }
  });

  // Items recibidos que no estaban en el pedido
  received.forEach(rec => {
    const wasExpected = expected.find(e => e.id === rec.id);
    if (!wasExpected) {
      const product = db.prepare('SELECT name, emoji FROM products WHERE id = ?').get(rec.id);
      discrepancies.push({
        type: 'unexpected',
        product_id: rec.id,
        product_name: product?.name || `Producto #${rec.id}`,
        emoji: product?.emoji || '📦',
        expected: 0,
        received: rec.qty,
        message: `${product?.emoji} ${product?.name}: Recibido ${rec.qty} pero no estaba en el pedido`
      });
    }
  });

  return discrepancies;
}

/**
 * Genera resumen legible de la auditoría
 */
function generateAuditSummary(expected, received, discrepancies) {
  const totalExpected = expected.reduce((s, i) => s + i.qty, 0);
  const totalReceived = received.reduce((s, i) => s + i.qty, 0);

  let summary = `📋 **Resumen de Entrega**\n\n`;
  summary += `Esperados: ${totalExpected} items\n`;
  summary += `Recibidos: ${totalReceived} items\n\n`;

  if (discrepancies.length === 0) {
    summary += `✅ **Entrega completa** - Todo coincide correctamente.`;
  } else {
    summary += `⚠️ **${discrepancies.length} discrepancia(s) encontrada(s):**\n\n`;
    discrepancies.forEach(d => {
      summary += `• ${d.message}\n`;
    });
    summary += `\nSe ha registrado el reporte automáticamente.`;
  }

  return summary;
}

/**
 * Obtiene historial de entregas
 */
function getDeliveryHistory(limit = 10) {
  const db = getDB();
  return db.prepare(`
    SELECT d.*, o.order_number, o.total as order_total
    FROM deliveries d
    JOIN orders o ON d.order_id = o.id
    ORDER BY d.completed_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Obtiene la próxima entrega pendiente
 */
function getPendingDelivery() {
  const db = getDB();
  return db.prepare(`
    SELECT o.*, 
      (SELECT COUNT(*) FROM deliveries WHERE order_id = o.id) as has_delivery
    FROM orders o 
    WHERE o.status = 'in_transit' AND 
      (SELECT COUNT(*) FROM deliveries WHERE order_id = o.id) = 0
    ORDER BY o.estimated_delivery ASC
    LIMIT 1
  `).get();
}

module.exports = { auditDelivery, getDeliveryHistory, getPendingDelivery, findDiscrepancies };
