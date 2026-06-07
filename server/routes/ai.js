/**
 * Rutas de la IA (Chat con Gemini)
 */

const express = require('express');
const router = express.Router();
const { chatWithGemini, resetChat } = require('../services/gemini');
const { checkLowStock, getZoneRecommendations, getTopProducts } = require('../services/predictive');
const { getWeatherRecommendations } = require('../services/weather');
const { getDB } = require('../db/init');

/**
 * POST /api/ai/chat
 * Envía un mensaje al asistente IA
 */
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje requerido' });

    const db = getDB();

    // Construir contexto de la tienda
    const config = {};
    db.prepare('SELECT key, value FROM store_config').all().forEach(row => {
      config[row.key] = row.value;
    });

    const lowStock = db.prepare('SELECT * FROM products WHERE stock <= min_stock').all();
    const allProducts = db.prepare('SELECT id, name, category, price, stock, emoji FROM products').all();
    const weatherData = getWeatherRecommendations();

    const storeContext = {
      name: config.store_name || 'Tienda Don Carlos',
      zone: config.store_zone || 'Col. Centro, CDMX',
      nearby: [config.nearby_kinder, config.nearby_school, config.nearby_park].filter(Boolean),
      deliveryDays: config.delivery_days || 'Lunes y Jueves',
      lowStock: lowStock.map(p => `${p.emoji} ${p.name} (${p.stock}/${p.min_stock})`),
      catalog: allProducts.map(p => `ID:${p.id} ${p.emoji} ${p.name} ($${p.price}) [stock:${p.stock}]`).join('\n'),
      weather: weatherData ? `${weatherData.current.temp_max}°C, ${weatherData.current.description}` : null
    };

    // Intentar con Gemini
    const geminiResponse = await chatWithGemini(message, storeContext);

    if (geminiResponse) {
      return res.json({
        text: geminiResponse.text,
        action: geminiResponse.action,
        source: 'gemini'
      });
    }

    // Fallback: respuesta local inteligente
    const localResponse = getLocalResponse(message, { lowStock, allProducts, config, weatherData });
    return res.json(localResponse);

  } catch (error) {
    console.error('[AI] Error:', error);
    res.status(500).json({ error: 'Error al procesar mensaje', details: error.message });
  }
});

/**
 * POST /api/ai/reset
 * Reinicia la conversación
 */
router.post('/reset', (req, res) => {
  resetChat();
  res.json({ ok: true, message: 'Conversación reiniciada' });
});

/**
 * Respuesta local cuando Gemini no está disponible
 */
function getLocalResponse(message, context) {
  const msg = message.toLowerCase();
  const { lowStock, allProducts, config, weatherData } = context;

  // Pedido / Compra
  if (msg.includes('pedir') || msg.includes('comprar') || msg.includes('quiero') || msg.includes('necesito')) {
    const foundProducts = findProductsInText(msg, allProducts);
    if (foundProducts.length > 0) {
      return {
        text: `¡Claro! Te agrego:\n\n${foundProducts.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n')}\n\n¿Confirmo el pedido?`,
        action: { type: 'add_to_cart', products: foundProducts.map(p => ({ id: p.id, qty: 1 })) },
        source: 'local'
      };
    }
    return { text: '¡Con gusto! ¿Qué productos necesitas? Puedo recomendarte según tu zona y ventas.', action: null, source: 'local' };
  }

  // Inventario / Stock
  if (msg.includes('inventario') || msg.includes('stock') || msg.includes('falta') || msg.includes('acab')) {
    if (lowStock.length > 0) {
      return {
        text: `⚠️ **Alerta de inventario:**\n\n${lowStock.map(p => `${p.emoji} ${p.name}: ${p.stock} unidades (mín: ${p.min_stock})`).join('\n')}\n\n¿Hago el pedido de reabastecimiento?`,
        action: { type: 'show_inventory', products: lowStock.map(p => ({ id: p.id, qty: p.min_stock - p.stock + 5 })) },
        source: 'local'
      };
    }
    return { text: '✅ ¡Todo bien! Tu inventario está en niveles normales.', action: null, source: 'local' };
  }

  // Recomendaciones / Zona
  if (msg.includes('recomiend') || msg.includes('zona') || msg.includes('sugier')) {
    let text = `📍 **Recomendaciones para ${config.store_zone || 'tu zona'}:**\n\n`;
    if (config.nearby_kinder) text += `🏫 ${config.nearby_kinder}\n→ Jugos y snacks pequeños (11:30-13:30)\n\n`;
    if (config.nearby_school) text += `🏫 ${config.nearby_school}\n→ Snacks y agua (recreo + salida)\n\n`;
    if (config.nearby_park) text += `🌳 ${config.nearby_park}\n→ Aguas y energéticas (mañana/tarde)\n\n`;
    if (weatherData?.recommendations?.length) {
      text += weatherData.recommendations.map(r => r.message).join('\n');
    }
    return { text, action: { type: 'show_recommendations' }, source: 'local' };
  }

  // Clima
  if (msg.includes('clima') || msg.includes('temperatura') || msg.includes('lluv')) {
    if (weatherData?.current) {
      const w = weatherData.current;
      let text = `🌤️ **Clima hoy:** ${w.description}, ${Math.round(w.temp_max)}°C\n\n`;
      if (weatherData.recommendations?.length) {
        text += weatherData.recommendations.map(r => r.message).join('\n\n');
      }
      return { text, action: null, source: 'local' };
    }
    return { text: 'No tengo datos del clima disponibles en este momento.', action: null, source: 'local' };
  }

  // Default
  return {
    text: '¿En qué te puedo ayudar? Puedo hacer pedidos, revisar tu inventario, darte recomendaciones por zona o verificar el clima.',
    action: null,
    source: 'local'
  };
}

function findProductsInText(msg, products) {
  const found = [];
  const keywords = {
    'coca': 1, 'fanta': 4, 'sprite': 5, 'ciel': 7, 'topo': 24,
    'del valle': 11, 'fuze': 14, 'bokados': 15, 'monster': 19, 'powerade': 21, 'mundet': 23
  };
  Object.entries(keywords).forEach(([key, id]) => {
    if (msg.includes(key)) {
      const p = products.find(pr => pr.id === id);
      if (p && !found.find(f => f.id === p.id)) found.push(p);
    }
  });
  return found;
}

module.exports = router;
