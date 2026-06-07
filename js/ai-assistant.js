/* ============================================
   TUALI AI - Asistente Inteligente
   ============================================ */

let aiMessages = [];
let aiState = 'idle';
let aiPendingCart = [];
let isListening = false;
let recognition = null;

const storeContext = {
  name: 'Tienda Don Carlos',
  zone: 'Col. Centro, CDMX',
  nearbyPlaces: ['Kinder Pequeños Genios', 'Escuela Primaria Benito Juárez', 'Parque Central'],
  lowStock: [
    { name: 'Coca-Cola 600ml', remaining: 3, emoji: '🥤' },
    { name: 'Ciel 500ml', remaining: 2, emoji: '💧' },
  ],
  deliveryDay: 'Lunes',
};

const zoneRecommendations = {
  kinder: { label: '🏫 Kinder Pequeños Genios (200m)', products: [11, 12, 13], reason: 'Los papás compran jugos para los niños a la hora de la salida' },
  escuela: { label: '🏫 Escuela Primaria B. Juárez (350m)', products: [15, 17, 18, 9], reason: 'Los estudiantes compran snacks y agua en el recreo' },
  parque: { label: '🌳 Parque Central (150m)', products: [7, 8, 21], reason: 'La gente que hace ejercicio busca hidratación y energía' }
};

function getAIResponse(userMessage) {
  const msg = userMessage.toLowerCase().trim();

  if (aiState === 'inventory_alert') {
    if (msg.includes('si') || msg.includes('sí') || msg.includes('ok') || msg.includes('dale') || msg.includes('hazlo') || msg.includes('acepto')) {
      aiState = 'idle';
      storeContext.lowStock.forEach(item => addToCart(item.name));
      return { text: `¡Listo! Agregué al carrito:\n\n${storeContext.lowStock.map(i => `${i.emoji} ${i.name}`).join('\n')}\n\n¿Quieres que confirme el pedido ahora o prefieres agregar algo más?`, actions: [{ label: '✅ Confirmar pedido', action: 'ai_confirm_yes' }, { label: '➕ Agregar más', action: 'ai_add_more' }] };
    } else { aiState = 'idle'; return { text: 'Entendido. Te avisaré cuando sea más urgente. ¿Hay algo más en lo que pueda ayudarte?', actions: getDefaultActions() }; }
  }

  if (aiState === 'confirming_order') {
    if (msg.includes('si') || msg.includes('sí') || msg.includes('confirma') || msg.includes('dale') || msg.includes('acepto') || msg.includes('ok')) {
      aiState = 'idle'; confirmOrder();
      return { text: '🎉 ¡Pedido confirmado! Te llegará el próximo ' + storeContext.deliveryDay + '. Te notificaré cuando salga a ruta. ¿Necesitas algo más?', actions: getDefaultActions() };
    } else if (msg.includes('no') || msg.includes('cancel') || msg.includes('espera')) {
      aiState = 'idle'; return { text: 'Ok, dejé el pedido en tu carrito por si quieres revisarlo después. ¿En qué más te puedo ayudar?', actions: getDefaultActions() };
    }
  }

  if (aiState === 'asking_products') {
    const foundProducts = findProductsInMessage(msg);
    if (foundProducts.length > 0) {
      foundProducts.forEach(p => addToCart(p.name));
      aiState = 'confirming_order';
      const productList = foundProducts.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
      const total = foundProducts.reduce((sum, p) => sum + p.price, 0);
      return { text: `Perfecto, agregué al carrito:\n\n${productList}\n\n💰 Total: $${total.toLocaleString()}\n🚚 Entrega: ${storeContext.deliveryDay}\n\n¿Confirmo el pedido?`, actions: [{ label: '✅ Sí, confirmar', action: 'ai_confirm_yes' }, { label: '❌ No', action: 'ai_confirm_no' }, { label: '➕ Agregar más', action: 'ai_add_more' }] };
    }
    return { text: 'No encontré esos productos. Tengo: refrescos (Coca-Cola, Fanta, Sprite), aguas (Ciel, Topo Chico), jugos (Del Valle, Fuze Tea), snacks (Bokados) y energéticas (Monster, Powerade). ¿Qué necesitas?', actions: [] };
  }

  if (msg.includes('hola') || msg.includes('buenos') || msg.includes('buenas') || msg === 'hey') {
    return { text: '¡Hola Don Carlos! 👋 Soy tu asistente Tuali. ¿En qué te puedo ayudar hoy?', actions: getDefaultActions() };
  }

  if (msg.includes('pedir') || msg.includes('pedido') || msg.includes('comprar') || msg.includes('ordenar') || msg.includes('quiero') || msg.includes('necesito') || msg.includes('ocupo')) {
    const foundProducts = findProductsInMessage(msg);
    if (foundProducts.length > 0) {
      foundProducts.forEach(p => addToCart(p.name));
      aiState = 'confirming_order';
      const productList = foundProducts.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
      const total = foundProducts.reduce((sum, p) => sum + p.price, 0);
      return { text: `¡Claro! Agregué al carrito:\n\n${productList}\n\n💰 Total: $${total.toLocaleString()}\n🚚 Entrega: ${storeContext.deliveryDay}\n\n¿Confirmo el pedido?`, actions: [{ label: '✅ Sí, confirmar', action: 'ai_confirm_yes' }, { label: '❌ No', action: 'ai_confirm_no' }, { label: '➕ Agregar más', action: 'ai_add_more' }] };
    }
    aiState = 'asking_products';
    return { text: '¡Con gusto! ¿Qué productos necesitas?', actions: [{ label: '🥤 Refrescos', action: 'ai_cat_refrescos' }, { label: '💧 Aguas', action: 'ai_cat_aguas' }, { label: '🧃 Jugos', action: 'ai_cat_jugos' }, { label: '🍪 Snacks', action: 'ai_cat_snacks' }, { label: '🔄 Repetir pedido', action: 'ai_repeat' }] };
  }

  if (msg.includes('recomiend') || msg.includes('sugier') || msg.includes('que me conviene') || msg.includes('zona') || msg.includes('que se vende')) { return getZoneRecommendation(); }
  if (msg.includes('inventario') || msg.includes('stock') || msg.includes('se acab') || msg.includes('falta')) { return getInventoryAlert(); }
  if (msg.includes('repetir') || msg.includes('lo de siempre') || msg.includes('mismo')) { return repeatLastOrder(); }
  if (msg.includes('refresco')) { return showCategoryProducts('refrescos'); }
  if (msg.includes('agua') || msg.includes('ciel')) { return showCategoryProducts('aguas'); }
  if (msg.includes('jugo') || msg.includes('del valle')) { return showCategoryProducts('jugos'); }
  if (msg.includes('snack') || msg.includes('papas') || msg.includes('bokados')) { return showCategoryProducts('snacks'); }
  if (msg.includes('monster') || msg.includes('powerade') || msg.includes('energetica')) { return showCategoryProducts('energeticas'); }
  if (msg.includes('ayuda') || msg.includes('que puedes')) { return { text: 'Puedo ayudarte con:\n\n🛒 **Hacer pedidos** - Dime qué necesitas\n🎙️ **Por voz** - Presiona el micrófono\n📊 **Recomendaciones** - Según tu zona\n📸 **Inventario** - Aviso cuando algo se acaba\n⚡ **Pedido rápido** - Confirma con un clic', actions: getDefaultActions() }; }
  if (msg.includes('gracias')) { return { text: '¡De nada, Don Carlos! 😊 Aquí estoy siempre que me necesites. 💪', actions: [] }; }

  return { text: '¿En qué te puedo ayudar? Puedo hacer pedidos, darte recomendaciones o revisar tu inventario.', actions: getDefaultActions() };
}

function findProductsInMessage(msg) {
  const found = [];
  const keywords = { 'coca': [1,2,3,22], 'fanta': [4], 'sprite': [5], 'fresca': [6], 'ciel': [7,8,9,10], 'topo': [24], 'del valle': [11,12,13], 'fuze': [14], 'bokados': [15,16,17,18], 'monster': [19,20], 'powerade': [21], 'mundet': [23] };
  Object.entries(keywords).forEach(([key, ids]) => {
    if (msg.includes(key)) { const p = products.find(pr => pr.id === ids[0]); if (p && !found.find(f => f.id === p.id)) found.push(p); }
  });
  return found;
}

function showCategoryProducts(category) {
  const catProducts = products.filter(p => p.category === category);
  const list = catProducts.slice(0, 5).map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
  aiState = 'asking_products';
  return { text: `Productos de ${category}:\n\n${list}\n\n¿Cuáles quieres agregar?`, actions: catProducts.slice(0, 4).map(p => ({ label: `${p.emoji} ${p.name.split(' ').slice(0,2).join(' ')}`, action: `ai_add_product_${p.id}` })) };
}

function getZoneRecommendation() {
  let text = `📍 **Recomendaciones para tu zona** (${storeContext.zone}):\n\n`;
  Object.values(zoneRecommendations).forEach(rec => {
    const prods = rec.products.map(id => products.find(p => p.id === id)).filter(Boolean);
    text += `**${rec.label}**\n💡 ${rec.reason}\n→ ${prods.map(p => p.emoji + ' ' + p.name.split(' ').slice(0,2).join(' ')).join(', ')}\n\n`;
  });
  text += '¿Quieres que agregue alguno al carrito?';
  return { text, actions: [{ label: '🧃 Jugos (kinder)', action: 'ai_zone_kinder' }, { label: '🍪 Snacks (escuela)', action: 'ai_zone_escuela' }, { label: '💧 Aguas (parque)', action: 'ai_zone_parque' }] };
}

function getInventoryAlert() {
  if (storeContext.lowStock.length === 0) return { text: '¡Todo bien! No hay productos con bajo inventario. 👍', actions: getDefaultActions() };
  aiState = 'inventory_alert';
  const list = storeContext.lowStock.map(i => `${i.emoji} ${i.name} - Solo quedan ${i.remaining}`).join('\n');
  return { text: `⚠️ **Alerta de inventario**\n\n${list}\n\nPróxima entrega: ${storeContext.deliveryDay}. ¿Hago el pedido ahora?`, actions: [{ label: '✅ Sí, pedir', action: 'ai_inventory_yes' }, { label: '🕐 Después', action: 'ai_inventory_no' }] };
}

function repeatLastOrder() {
  const items = [products[0], products[6], products[10]];
  items.forEach(p => addToCart(p.name));
  aiState = 'confirming_order';
  const list = items.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
  const total = items.reduce((s, p) => s + p.price, 0);
  return { text: `Agregué tu último pedido:\n\n${list}\n\n💰 Total: $${total.toLocaleString()}\n🚚 Entrega: ${storeContext.deliveryDay}\n\n¿Lo confirmo?`, actions: [{ label: '✅ Confirmar', action: 'ai_confirm_yes' }, { label: '✏️ Modificar', action: 'ai_add_more' }, { label: '❌ Cancelar', action: 'ai_confirm_no' }] };
}

function getDefaultActions() { return [{ label: '🛒 Hacer pedido', action: 'ai_order' }, { label: '📊 Recomendaciones', action: 'ai_recommend' }, { label: '📦 Inventario', action: 'ai_inventory' }, { label: '🔄 Repetir pedido', action: 'ai_repeat' }]; }

function handleAIAction(action) {
  let userMsg = '';
  switch(action) {
    case 'ai_order': userMsg = 'Quiero hacer un pedido'; break;
    case 'ai_recommend': userMsg = 'Dame recomendaciones para mi zona'; break;
    case 'ai_inventory': userMsg = 'Revisa mi inventario'; break;
    case 'ai_repeat': userMsg = 'Repetir mi último pedido'; break;
    case 'ai_confirm_yes': userMsg = 'Sí, confirmar'; break;
    case 'ai_confirm_no': userMsg = 'No, cancelar'; break;
    case 'ai_add_more': userMsg = 'Quiero agregar más'; aiState = 'asking_products'; break;
    case 'ai_inventory_yes': userMsg = 'Sí, hazlo'; break;
    case 'ai_inventory_no': userMsg = 'Después'; break;
    case 'ai_cat_refrescos': userMsg = 'Muéstrame refrescos'; break;
    case 'ai_cat_aguas': userMsg = 'Muéstrame aguas'; break;
    case 'ai_cat_jugos': userMsg = 'Muéstrame jugos'; break;
    case 'ai_cat_snacks': userMsg = 'Muéstrame snacks'; break;
    case 'ai_zone_kinder':
      [11,12,13].forEach(id => { const p = products.find(pr => pr.id === id); if(p) addToCart(p.name); });
      aiState = 'confirming_order'; userMsg = 'Agrega los jugos del kinder'; break;
    case 'ai_zone_escuela':
      [15,17,18,9].forEach(id => { const p = products.find(pr => pr.id === id); if(p) addToCart(p.name); });
      aiState = 'confirming_order'; userMsg = 'Agrega snacks de la escuela'; break;
    case 'ai_zone_parque':
      [7,8,21].forEach(id => { const p = products.find(pr => pr.id === id); if(p) addToCart(p.name); });
      aiState = 'confirming_order'; userMsg = 'Agrega aguas del parque'; break;
    default:
      if (action.startsWith('ai_add_product_')) {
        const id = parseInt(action.replace('ai_add_product_', ''));
        const p = products.find(pr => pr.id === id);
        if (p) { addToCart(p.name); userMsg = `Agrega ${p.name}`; }
      } break;
  }
  if (userMsg) sendAIMessage(userMsg);
}

function sendAIMessage(text = null) {
  const input = document.getElementById('ai-input');
  const message = text || (input ? input.value.trim() : '');
  if (!message) return;
  if (!text && input) input.value = '';
  addMessageToChat('user', message);
  setTimeout(() => { const response = getAIResponse(message); addMessageToChat('ai', response.text, response.actions); }, 600);
}

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

function initVoiceRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.log('Speech Recognition no disponible');
    return false;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'es-MX';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    document.getElementById('ai-voice-btn')?.classList.add('listening');
    const vs = document.getElementById('ai-voice-status');
    if (vs) vs.style.display = 'flex';
    showToast('🎙️ Escuchando... habla ahora');
  };

  recognition.onresult = (e) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = e.resultIndex; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    // Mostrar texto intermedio en el input
    const input = document.getElementById('ai-input');
    if (input && interimTranscript) {
      input.value = interimTranscript;
    }

    // Cuando hay resultado final, enviarlo
    if (finalTranscript) {
      if (input) input.value = '';
      sendAIMessage(finalTranscript);
    }
  };

  recognition.onerror = (e) => {
    console.log('Voice error:', e.error);
    stopListening();
    if (e.error === 'not-allowed') {
      showToast('⚠️ Permite el acceso al microfono en tu navegador');
      addMessageToChat('ai', '⚠️ **No tengo acceso al micrófono.**\n\nPara usar comandos de voz:\n1. Abre desde **https://yami108.github.io/tuali-app/**\n2. Permite el acceso al micrófono cuando el navegador lo pida\n3. Si lo bloqueaste, haz clic en el candado 🔒 de la barra de dirección y activa "Micrófono"\n\nMientras tanto, puedes escribirme aquí abajo. 👇', []);
    } else if (e.error === 'no-speech') {
      showToast('No escuché nada, intenta de nuevo');
    } else if (e.error === 'network') {
      showToast('⚠️ Se necesita conexión a internet para voz');
    } else {
      showToast('Error de voz: ' + e.error);
    }
  };

  recognition.onend = () => {
    stopListening();
  };

  return true;
}

function toggleVoice() {
  // Check if protocol supports voice (needs https or localhost)
  if (window.location.protocol === 'file:') {
    showToast('⚠️ La voz solo funciona desde un servidor (GitHub Pages)');
    addMessageToChat('ai', '⚠️ **El reconocimiento de voz necesita HTTPS.**\n\nAbre la app desde:\n🌐 **https://yami108.github.io/tuali-app/**\n\nDesde archivos locales (file://) el navegador bloquea el micrófono por seguridad.\n\nMientras tanto puedes escribirme aquí. 👇', []);
    return;
  }

  if (!recognition && !initVoiceRecognition()) {
    showToast('Tu navegador no soporta reconocimiento de voz');
    return;
  }

  if (isListening) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch(e) {
      // Si ya estaba corriendo, reiniciar
      recognition.stop();
      setTimeout(() => recognition.start(), 200);
    }
  }
}

function stopListening() {
  isListening = false;
  document.getElementById('ai-voice-btn')?.classList.remove('listening');
  const vs = document.getElementById('ai-voice-status');
  if (vs) vs.style.display = 'none';
}

function showInventoryNotification() {
  const notif = document.getElementById('ai-notification');
  if (!notif) return;
  notif.innerHTML = `<div class="notif-icon">📸</div><div class="notif-content"><div class="notif-title">Alerta de inventario</div><div class="notif-text">Tu Coca-Cola 600ml se está acabando (3 unidades)</div></div><button class="notif-close" onclick="event.stopPropagation();closeNotification()">✕</button>`;
  notif.style.display = 'flex';
  notif.onclick = () => { closeNotification(); navigateTo('asistente'); setTimeout(() => { aiState = 'inventory_alert'; addMessageToChat('ai', '📸 **Alerta de cámara del refrigerador**\n\nDetecté que tu Coca-Cola 600ml se está acabando (solo quedan 3 unidades).\n\n¿Quieres que haga el pedido ahora?', [{ label: '✅ Sí, pedir', action: 'ai_inventory_yes' }, { label: '🕐 Después', action: 'ai_inventory_no' }]); }, 500); };
}

function closeNotification() { const n = document.getElementById('ai-notification'); if (n) n.style.display = 'none'; }

function simulateInventoryNotification() { setTimeout(() => { if (currentPage !== 'login') showInventoryNotification(); }, 15000); }

function initAI() {
  const chat = document.getElementById('ai-chat-messages');
  if (chat && chat.children.length === 0) {
    addMessageToChat('ai', '¡Hola Don Carlos! 👋 Soy tu asistente Tuali con IA.\n\nPuedo ayudarte a:\n🛒 Hacer pedidos (texto o voz)\n📊 Recomendarte productos según tu zona\n📸 Avisarte cuando algo se acaba\n⚡ Confirmar compras con un clic\n\n¿En qué te ayudo?', getDefaultActions());
  }
  initVoiceRecognition();
  simulateInventoryNotification();
}
