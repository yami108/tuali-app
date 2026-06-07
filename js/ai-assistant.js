/* ============================================
   TUALI AI - Asistente Inteligente (v2 - Backend)
   Conecta con: Gemini API, Predictivo, Clima, Entregas
   ============================================ */

let aiMessages = [];
let aiState = 'idle';
let isListening = false;
let recognition = null;

// API Base URL - cambiar si el backend está en otro puerto
const API_BASE = window.location.origin.includes('github.io') 
  ? '' // Static mode (fallback local)
  : (window.location.origin || 'http://localhost:3000');

const USE_BACKEND = !window.location.origin.includes('github.io') && !window.location.protocol.includes('file');

// ===== COMUNICACIÓN CON BACKEND =====
async function sendToBackend(endpoint, data = null) {
  if (!USE_BACKEND) return null;
  try {
    const options = data 
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
      : { method: 'GET' };
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`[AI] Backend no disponible (${endpoint}):`, error.message);
    return null;
  }
}

// ===== RESPUESTA LOCAL (FALLBACK) =====
function getLocalAIResponse(userMessage) {
  const msg = userMessage.toLowerCase().trim();

  if (aiState === 'inventory_alert') {
    if (msg.includes('si') || msg.includes('sí') || msg.includes('ok') || msg.includes('dale') || msg.includes('hazlo') || msg.includes('acepto')) {
      aiState = 'idle';
      const lowStock = [
        { id: 1, name: 'Coca-Cola 600ml', emoji: '🥤' },
        { id: 8, name: 'Ciel 1.5L', emoji: '💧' }
      ];
      lowStock.forEach(item => addToCart(item.name));
      return { text: `¡Listo! Agregué al carrito:\n\n${lowStock.map(i => `${i.emoji} ${i.name}`).join('\n')}\n\n¿Confirmo el pedido?`, actions: [{ label: '✅ Confirmar', action: 'ai_confirm_yes' }, { label: '➕ Agregar más', action: 'ai_add_more' }] };
    } else { aiState = 'idle'; return { text: 'Entendido. Te aviso cuando sea urgente. ¿Algo más?', actions: getDefaultActions() }; }
  }

  if (aiState === 'confirming_order') {
    if (msg.includes('si') || msg.includes('sí') || msg.includes('confirma') || msg.includes('dale') || msg.includes('acepto') || msg.includes('ok')) {
      aiState = 'idle'; confirmOrder();
      return { text: '🎉 ¡Pedido confirmado! Te llegará el próximo Lunes. Te notifico cuando salga a ruta.', actions: getDefaultActions() };
    } else if (msg.includes('no') || msg.includes('cancel')) {
      aiState = 'idle'; return { text: 'Ok, tu carrito queda guardado. ¿Algo más?', actions: getDefaultActions() };
    }
  }

  if (aiState === 'asking_products') {
    const found = findProductsInMessage(msg);
    if (found.length > 0) {
      found.forEach(p => addToCart(p.name));
      aiState = 'confirming_order';
      const list = found.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
      return { text: `Agregué:\n\n${list}\n\n¿Confirmo el pedido?`, actions: [{ label: '✅ Confirmar', action: 'ai_confirm_yes' }, { label: '❌ No', action: 'ai_confirm_no' }, { label: '➕ Más', action: 'ai_add_more' }] };
    }
    return { text: 'No encontré ese producto. Tengo: Coca-Cola, Fanta, Sprite, Ciel, Del Valle, Bokados, Monster. ¿Cuál necesitas?', actions: [] };
  }

  if (aiState === 'delivery_audit') {
    if (msg.includes('si') || msg.includes('todo bien') || msg.includes('correcto') || msg.includes('completo')) {
      aiState = 'idle';
      return { text: '✅ **Entrega confirmada.** Todo recibido correctamente. Tu inventario ha sido actualizado automáticamente.', actions: getDefaultActions() };
    } else if (msg.includes('no') || msg.includes('falta') || msg.includes('incompleto') || msg.includes('problema')) {
      aiState = 'delivery_detail';
      return { text: '⚠️ Entendido. ¿Qué producto faltó o llegó incompleto? Dime el nombre y la cantidad que recibiste.', actions: [{ label: '🥤 Faltó Coca-Cola', action: 'ai_missing_coca' }, { label: '💧 Faltó Ciel', action: 'ai_missing_ciel' }, { label: '📋 Ver pedido completo', action: 'ai_show_order' }] };
    }
  }

  // Intent detection
  if (msg.includes('hola') || msg.includes('buenos') || msg.includes('buenas')) {
    return { text: '¡Hola Don Carlos! 👋 Soy tu asistente Tuali con IA. ¿En qué te ayudo?', actions: getDefaultActions() };
  }

  if (msg.includes('pedir') || msg.includes('pedido') || msg.includes('comprar') || msg.includes('quiero') || msg.includes('necesito')) {
    const found = findProductsInMessage(msg);
    if (found.length > 0) {
      found.forEach(p => addToCart(p.name));
      aiState = 'confirming_order';
      const list = found.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
      const total = found.reduce((s, p) => s + p.price, 0);
      return { text: `¡Agregado!\n\n${list}\n\n💰 Total: $${total}\n🚚 Entrega: Lunes\n\n¿Confirmo?`, actions: [{ label: '✅ Confirmar', action: 'ai_confirm_yes' }, { label: '❌ No', action: 'ai_confirm_no' }, { label: '➕ Más', action: 'ai_add_more' }] };
    }
    aiState = 'asking_products';
    return { text: '¡Con gusto! ¿Qué productos necesitas?', actions: [{ label: '🥤 Refrescos', action: 'ai_cat_refrescos' }, { label: '💧 Aguas', action: 'ai_cat_aguas' }, { label: '🧃 Jugos', action: 'ai_cat_jugos' }, { label: '🍪 Snacks', action: 'ai_cat_snacks' }, { label: '🔄 Repetir pedido', action: 'ai_repeat' }] };
  }

  if (msg.includes('inventario') || msg.includes('stock') || msg.includes('falta') || msg.includes('acab')) { return getInventoryAlert(); }
  if (msg.includes('recomiend') || msg.includes('zona') || msg.includes('sugier')) { return getZoneRecommendation(); }
  if (msg.includes('entrega') || msg.includes('lleg') || msg.includes('repartidor') || msg.includes('auditor')) { return startDeliveryAudit(); }
  if (msg.includes('clima') || msg.includes('temperatura')) { return getWeatherInfo(); }
  if (msg.includes('repetir') || msg.includes('lo de siempre')) { return repeatLastOrder(); }
  if (msg.includes('refresco')) { return showCategoryProducts('refrescos'); }
  if (msg.includes('agua') || msg.includes('ciel')) { return showCategoryProducts('aguas'); }
  if (msg.includes('jugo') || msg.includes('del valle')) { return showCategoryProducts('jugos'); }
  if (msg.includes('snack') || msg.includes('bokados')) { return showCategoryProducts('snacks'); }
  if (msg.includes('gracias')) { return { text: '¡De nada, Don Carlos! 😊 Aquí estoy.', actions: [] }; }

  return { text: '¿En qué te ayudo? Puedo: hacer pedidos, recomendarte por zona, revisar inventario, verificar entregas o informarte del clima.', actions: getDefaultActions() };
}

// ===== FUNCIONES DE RESPUESTA =====
function findProductsInMessage(msg) {
  const found = [];
  const keywords = { 'coca': [1], 'fanta': [4], 'sprite': [5], 'fresca': [6], 'ciel': [7,8,9], 'topo': [24], 'del valle': [11,12,13], 'fuze': [14], 'bokados': [15,16], 'monster': [19,20], 'powerade': [21], 'mundet': [23] };
  Object.entries(keywords).forEach(([key, ids]) => {
    if (msg.includes(key)) { const p = products.find(pr => pr.id === ids[0]); if (p && !found.find(f => f.id === p.id)) found.push(p); }
  });
  return found;
}

function showCategoryProducts(category) {
  const catProducts = products.filter(p => p.category === category).slice(0, 5);
  const list = catProducts.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
  aiState = 'asking_products';
  return { text: `Productos de ${category}:\n\n${list}\n\n¿Cuáles agrego?`, actions: catProducts.slice(0, 4).map(p => ({ label: `${p.emoji} ${p.name.split(' ').slice(0,2).join(' ')}`, action: `ai_add_product_${p.id}` })) };
}

function getZoneRecommendation() {
  return { text: `📍 **Recomendaciones para tu zona** (Col. Centro, CDMX):\n\n🏫 **Kinder Pequeños Genios (200m)**\n💡 Jugos para la salida de los niños (12:00-13:30)\n→ 🧃 Del Valle Durazno, Manzana, Naranja\n\n🏫 **Escuela Primaria B. Juárez (350m)**\n💡 Snacks y agua en recreo y salida\n→ 🍪 Bokados, 💧 Ciel 500ml\n\n🌳 **Parque Central (150m)**\n💡 Hidratación para quienes hacen ejercicio\n→ 💧 Ciel, 🏃 Powerade\n\n¿Agrego alguno al carrito?`, actions: [{ label: '🧃 Jugos (kinder)', action: 'ai_zone_kinder' }, { label: '🍪 Snacks (escuela)', action: 'ai_zone_escuela' }, { label: '💧 Aguas (parque)', action: 'ai_zone_parque' }] };
}

function getInventoryAlert() {
  aiState = 'inventory_alert';
  return { text: `⚠️ **Alerta de desabasto predictivo**\n\n🥤 Coca-Cola 600ml - Quedan 3 (se acaba en ~2 días)\n💧 Ciel 1.5L - Quedan 2 (se acaba mañana)\n⚡ Monster Ultra - Quedan 3 (stock bajo)\n🧃 Del Valle Durazno - Quedan 4 (debajo del mínimo)\n\n📊 Predicción basada en: ventas históricas + clima (30°C hoy = más aguas)\n\n¿Hago el pedido de reabastecimiento?`, actions: [{ label: '✅ Sí, pedir todo', action: 'ai_inventory_yes' }, { label: '🛒 Solo los urgentes', action: 'ai_inventory_urgent' }, { label: '🕐 Después', action: 'ai_inventory_no' }] };
}

function startDeliveryAudit() {
  aiState = 'delivery_audit';
  return { text: `📋 **Auditoría de entrega - Pedido #AC-2847**\n\nTu pedido contenía:\n🥤 Coca-Cola 600ml x2 (Pack x24)\n💧 Ciel 1L x1 (Pack x12)\n🍪 Bokados Papas x1 (Display x12)\n🧃 Del Valle Durazno x1 (Pack x6)\n\n¿Recibiste todo correctamente?`, actions: [{ label: '✅ Todo completo', action: 'ai_delivery_ok' }, { label: '⚠️ Falta algo', action: 'ai_delivery_issue' }, { label: '📸 Tomar foto', action: 'ai_delivery_photo' }] };
}

function getWeatherInfo() {
  return { text: `🌤️ **Clima hoy en CDMX:**\n\n🌡️ Máxima: 30°C | Mínima: 16°C\n💧 Humedad: 55%\n☀️ Parcialmente soleado\n\n**Impacto en ventas:**\n📈 +40% demanda de aguas (hace calor)\n📈 +30% refrescos fríos\n📈 +20% energéticas (gente en parque)\n\n💡 Te sugiero reabastecer Ciel y Coca-Cola antes del Lunes.`, actions: [{ label: '🛒 Pedir aguas extra', action: 'ai_weather_order' }, { label: '📊 Ver predicción completa', action: 'ai_recommend' }] };
}

function repeatLastOrder() {
  const items = [products[0], products[6], products[10]];
  items.forEach(p => addToCart(p.name));
  aiState = 'confirming_order';
  const list = items.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
  const total = items.reduce((s, p) => s + p.price, 0);
  return { text: `Tu último pedido:\n\n${list}\n\n💰 Total: $${total}\n🚚 Entrega: Lunes\n\n¿Lo confirmo?`, actions: [{ label: '✅ Confirmar', action: 'ai_confirm_yes' }, { label: '✏️ Modificar', action: 'ai_add_more' }, { label: '❌ Cancelar', action: 'ai_confirm_no' }] };
}

function getDefaultActions() {
  return [
    { label: '🛒 Hacer pedido', action: 'ai_order' },
    { label: '📊 Recomendaciones', action: 'ai_recommend' },
    { label: '📦 Inventario', action: 'ai_inventory' },
    { label: '🌤️ Clima', action: 'ai_weather' },
    { label: '📋 Auditar entrega', action: 'ai_delivery' },
    { label: '🔄 Repetir pedido', action: 'ai_repeat' }
  ];
}

// ===== HANDLE ACTIONS =====
function handleAIAction(action) {
  let userMsg = '';
  switch(action) {
    case 'ai_order': userMsg = 'Quiero hacer un pedido'; break;
    case 'ai_recommend': userMsg = 'Dame recomendaciones para mi zona'; break;
    case 'ai_inventory': userMsg = 'Revisa mi inventario'; break;
    case 'ai_weather': userMsg = 'Cómo está el clima'; break;
    case 'ai_delivery': userMsg = 'Quiero auditar mi entrega'; break;
    case 'ai_repeat': userMsg = 'Repetir mi último pedido'; break;
    case 'ai_confirm_yes': userMsg = 'Sí, confirmar'; break;
    case 'ai_confirm_no': userMsg = 'No, cancelar'; break;
    case 'ai_add_more': userMsg = 'Quiero agregar más'; aiState = 'asking_products'; break;
    case 'ai_inventory_yes': userMsg = 'Sí, pedir todo'; break;
    case 'ai_inventory_urgent': userMsg = 'Sí, solo los urgentes'; break;
    case 'ai_inventory_no': userMsg = 'Después'; break;
    case 'ai_delivery_ok': userMsg = 'Sí, todo completo'; break;
    case 'ai_delivery_issue': userMsg = 'No, falta algo'; break;
    case 'ai_delivery_photo': userMsg = 'Quiero tomar foto'; break;
    case 'ai_cat_refrescos': userMsg = 'Refrescos'; break;
    case 'ai_cat_aguas': userMsg = 'Aguas'; break;
    case 'ai_cat_jugos': userMsg = 'Jugos'; break;
    case 'ai_cat_snacks': userMsg = 'Snacks'; break;
    case 'ai_weather_order':
      [7,8,9].forEach(id => { const p = products.find(pr => pr.id === id); if(p) addToCart(p.name); });
      aiState = 'confirming_order'; userMsg = 'Agrega aguas extra'; break;
    case 'ai_zone_kinder':
      [11,12,13].forEach(id => { const p = products.find(pr => pr.id === id); if(p) addToCart(p.name); });
      aiState = 'confirming_order'; userMsg = 'Agrega jugos del kinder'; break;
    case 'ai_zone_escuela':
      [15,17,9].forEach(id => { const p = products.find(pr => pr.id === id); if(p) addToCart(p.name); });
      aiState = 'confirming_order'; userMsg = 'Agrega snacks de la escuela'; break;
    case 'ai_zone_parque':
      [7,8,21].forEach(id => { const p = products.find(pr => pr.id === id); if(p) addToCart(p.name); });
      aiState = 'confirming_order'; userMsg = 'Agrega aguas del parque'; break;
    case 'ai_missing_coca': userMsg = 'Faltó Coca-Cola'; aiState = 'idle'; break;
    case 'ai_missing_ciel': userMsg = 'Faltó Ciel'; aiState = 'idle'; break;
    case 'ai_show_order': userMsg = 'Muéstrame el pedido'; break;
    default:
      if (action.startsWith('ai_add_product_')) {
        const id = parseInt(action.replace('ai_add_product_', ''));
        const p = products.find(pr => pr.id === id);
        if (p) { addToCart(p.name); userMsg = `Agrega ${p.name}`; }
      } break;
  }
  if (userMsg) sendAIMessage(userMsg);
}

// ===== SEND MESSAGE =====
async function sendAIMessage(text = null) {
  const input = document.getElementById('ai-input');
  const message = text || (input ? input.value.trim() : '');
  if (!message) return;
  if (!text && input) input.value = '';

  addMessageToChat('user', message);

  // Mostrar "escribiendo..."
  const typingId = showTypingIndicator();

  // Intentar backend primero
  if (USE_BACKEND) {
    const backendResponse = await sendToBackend('/api/ai/chat', { message });
    removeTypingIndicator(typingId);
    
    if (backendResponse) {
      const actions = backendResponse.action ? getActionsFromBackend(backendResponse.action) : getDefaultActions();
      addMessageToChat('ai', backendResponse.text, actions);
      
      // Ejecutar acciones del backend
      if (backendResponse.action) {
        executeBackendAction(backendResponse.action);
      }
      return;
    }
  }

  // Fallback local
  removeTypingIndicator(typingId);
  setTimeout(() => {
    const response = getLocalAIResponse(message);
    addMessageToChat('ai', response.text, response.actions);
  }, 400);
}

function getActionsFromBackend(action) {
  if (!action) return getDefaultActions();
  if (action.type === 'add_to_cart') {
    return [{ label: '✅ Confirmar pedido', action: 'ai_confirm_yes' }, { label: '➕ Más', action: 'ai_add_more' }, { label: '❌ Cancelar', action: 'ai_confirm_no' }];
  }
  return getDefaultActions();
}

function executeBackendAction(action) {
  if (!action) return;
  if (action.type === 'add_to_cart' && action.products) {
    action.products.forEach(item => {
      const p = products.find(pr => pr.id === item.id);
      if (p) { for (let i = 0; i < (item.qty || 1); i++) addToCart(p.name); }
    });
    aiState = 'confirming_order';
  }
  if (action.type === 'confirm_order') { confirmOrder(); }
}

// ===== TYPING INDICATOR =====
function showTypingIndicator() {
  const chatMessages = document.getElementById('ai-chat-messages');
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'chat-message chat-ai';
  div.id = id;
  div.innerHTML = '<div class="chat-bubble chat-bubble-ai" style="display:flex;gap:4px;padding:16px 20px;"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ===== CHAT UI =====
function addMessageToChat(sender, text, actions = []) {
  const chatMessages = document.getElementById('ai-chat-messages');
  if (!chatMessages) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message chat-${sender}`;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-bubble-${sender}`;
  bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  msgDiv.appendChild(bubble);
  if (actions && actions.length > 0) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'chat-actions';
    actions.forEach(act => {
      const btn = document.createElement('button');
      btn.className = 'chat-action-btn';
      btn.textContent = act.label;
      btn.onclick = () => { actionsDiv.remove(); handleAIAction(act.action); };
      actionsDiv.appendChild(btn);
    });
    msgDiv.appendChild(actionsDiv);
  }
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== VOICE =====
function initVoiceRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return false;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'es-MX';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => { isListening = true; document.getElementById('ai-voice-btn')?.classList.add('listening'); document.getElementById('ai-voice-status').style.display = 'flex'; showToast('🎙️ Escuchando...'); };
  recognition.onresult = (e) => {
    let finalTranscript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
      else { const input = document.getElementById('ai-input'); if (input) input.value = e.results[i][0].transcript; }
    }
    if (finalTranscript) { const input = document.getElementById('ai-input'); if (input) input.value = ''; sendAIMessage(finalTranscript); }
  };
  recognition.onerror = (e) => { stopListening(); if (e.error === 'not-allowed') { showToast('⚠️ Permite acceso al micrófono'); addMessageToChat('ai', '⚠️ Necesito permiso de micrófono. Abre desde **https://yami108.github.io/tuali-app/** y permite el acceso.', []); } else if (e.error === 'no-speech') { showToast('No escuché nada'); } };
  recognition.onend = () => stopListening();
  return true;
}

function toggleVoice() {
  if (window.location.protocol === 'file:') { showToast('⚠️ Voz solo funciona en HTTPS'); addMessageToChat('ai', '⚠️ Abre desde **https://yami108.github.io/tuali-app/** para usar voz.', []); return; }
  if (!recognition && !initVoiceRecognition()) { showToast('Tu navegador no soporta voz'); return; }
  if (isListening) { recognition.stop(); } else {
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => { stream.getTracks().forEach(t => t.stop()); try { recognition.start(); } catch(e) { recognition.stop(); setTimeout(() => recognition.start(), 300); } }).catch(() => { showToast('⚠️ Permite el micrófono'); });
    } else { try { recognition.start(); } catch(e) { recognition.stop(); setTimeout(() => recognition.start(), 300); } }
  }
}

function stopListening() { isListening = false; document.getElementById('ai-voice-btn')?.classList.remove('listening'); const vs = document.getElementById('ai-voice-status'); if (vs) vs.style.display = 'none'; }

// ===== NOTIFICATIONS =====
function showInventoryNotification() {
  const notif = document.getElementById('ai-notification');
  if (!notif) return;
  notif.innerHTML = `<div class="notif-icon">📸</div><div class="notif-content"><div class="notif-title">⚠️ Desabasto predictivo</div><div class="notif-text">Coca-Cola 600ml se acabará en 2 días (quedan 3)</div></div><button class="notif-close" onclick="event.stopPropagation();closeNotification()">✕</button>`;
  notif.style.display = 'flex';
  notif.onclick = () => { closeNotification(); navigateTo('asistente'); setTimeout(() => { aiState = 'inventory_alert'; addMessageToChat('ai', '📸 **Alerta de desabasto predictivo**\n\nSegún tus ventas y el clima de hoy (30°C), la demanda de bebidas frías aumentará 40%.\n\n🥤 Coca-Cola 600ml: quedan 3 → se acaba en ~2 días\n💧 Ciel 1.5L: quedan 2 → se acaba mañana\n\n¿Hago el pedido ahora?', [{ label: '✅ Pedir', action: 'ai_inventory_yes' }, { label: '🕐 Después', action: 'ai_inventory_no' }]); }, 500); };
}

function closeNotification() { const n = document.getElementById('ai-notification'); if (n) n.style.display = 'none'; }

// ===== INIT =====
function initAI() {
  const chat = document.getElementById('ai-chat-messages');
  if (chat && chat.children.length === 0) {
    addMessageToChat('ai', '¡Hola Don Carlos! 👋 Soy tu asistente Tuali con **IA de Gemini**.\n\nPuedo ayudarte con:\n🛒 Hacer pedidos por texto o voz\n📊 Recomendarte productos según tu zona y clima\n📸 Alertarte cuando algo se acaba (predictivo)\n📋 Auditar tus entregas automáticamente\n🌤️ Ajustar sugerencias según el clima\n⚡ Todo con un solo clic\n\n¿En qué te ayudo?', getDefaultActions());
  }
  initVoiceRecognition();
  // Notificación de desabasto a los 12 segundos
  setTimeout(() => { if (currentPage !== 'login') showInventoryNotification(); }, 12000);
}
