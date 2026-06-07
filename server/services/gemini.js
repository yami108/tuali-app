/**
 * Servicio de integración con Google Gemini API
 * Maneja el chat conversacional con contexto de la tienda
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI;
let chatSession;

function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'tu_api_key_aqui') {
    console.warn('[GEMINI] ⚠️ No se configuró GEMINI_API_KEY. Usando respuestas locales.');
    return false;
  }
  genAI = new GoogleGenerativeAI(apiKey);
  return true;
}

function getSystemPrompt(storeContext) {
  return `Eres el asistente IA de Tuali, la plataforma de Arca Continental para tenderos en México.

CONTEXTO DE LA TIENDA:
- Nombre: ${storeContext.name}
- Zona: ${storeContext.zone}
- Lugares cercanos: ${storeContext.nearby.join(', ')}
- Días de entrega: ${storeContext.deliveryDays}
- Productos con bajo stock: ${JSON.stringify(storeContext.lowStock)}

PRODUCTOS DISPONIBLES:
${storeContext.catalog}

CLIMA ACTUAL:
${storeContext.weather || 'No disponible'}

TU PERSONALIDAD:
- Hablas en español informal mexicano, amigable y directo
- Eres proactivo: sugieres productos antes de que te los pidan
- Recomiendas según la zona (si hay kinder cerca, sugiere jugos)
- Si hace calor, recomiendas aguas y bebidas frías
- Si un producto se está acabando, alertas al tendero
- Puedes agregar productos al carrito y confirmar pedidos
- Siempre preguntas confirmación antes de finalizar un pedido

INSTRUCCIONES DE FORMATO:
- Responde en máximo 3-4 oraciones
- Usa emojis relevantes
- Si agregas productos al carrito, lista con emoji + nombre + precio
- Al final de recomendaciones, pregunta si quiere agregar al carrito

ACCIONES QUE PUEDES INDICAR (responde con JSON al final si aplica):
Si necesitas ejecutar una acción, agrega al final de tu respuesta un bloque:
[ACTION:{"type":"add_to_cart","products":[{"id":1,"qty":1}]}]
[ACTION:{"type":"confirm_order"}]
[ACTION:{"type":"show_inventory"}]
[ACTION:{"type":"show_recommendations","zone":"kinder"}]

Responde SOLO con texto natural + acción si es necesario.`;
}

async function chatWithGemini(message, storeContext) {
  if (!genAI) {
    if (!initGemini()) return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    if (!chatSession) {
      chatSession = model.startChat({
        history: [],
        generationConfig: {
          temperature: 0.8,
          topP: 0.9,
          maxOutputTokens: 500,
        },
        systemInstruction: getSystemPrompt(storeContext),
      });
    }

    const result = await chatSession.sendMessage(message);
    const response = result.response.text();

    // Extraer acciones del response
    const actionMatch = response.match(/\[ACTION:(.*?)\]/);
    let action = null;
    let text = response;

    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1]);
        text = response.replace(/\[ACTION:.*?\]/g, '').trim();
      } catch (e) {
        // Si no se puede parsear, ignorar acción
      }
    }

    return { text, action, source: 'gemini' };
  } catch (error) {
    console.error('[GEMINI] Error:', error.message);
    // Reset session on error
    chatSession = null;
    return null;
  }
}

function resetChat() {
  chatSession = null;
}

module.exports = { initGemini, chatWithGemini, resetChat };
