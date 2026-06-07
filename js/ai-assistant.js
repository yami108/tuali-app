/* ============================================
   TUALITO - Mascota Virtual IA
   Asistente persistente contextual + Voz
   ============================================ */

// ===== STATE =====
let aiState = 'idle'; // idle, asking_products, confirming_order, inventory_alert
let recognition = null;
let isListening = false;
let micPermissionGranted = false;
let tualitoClickTimer = null;

// ===== STORE CONTEXT =====
const storeContext = {
  name: 'Tienda Don Carlos',
  zone: 'Col. Centro, CDMX',
  nearbyPlaces: ['Kinder Pequeños Genios (200m)', 'Primaria B. Juárez (350m)', 'Parque Central (150m)'],
  lowStock: [
    { name: 'Coca-Cola 600ml', remaining: 3, emoji: '🥤' },
    { name: 'Ciel 500ml', remaining: 2, emoji: '💧' },
  ],
  deliveryDay: 'Lunes',
  temperature: 28,
};

// ===== API CONFIG =====
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? `http://${window.location.hostname}:5000` : '';

// ============================================================
// TUALITO MASCOTA - Interacción y Contexto
// ============================================================

function onTualitoClick() {
  // Clic simple: mostrar/ocultar burbuja contextual
  if (tualitoClickTimer) { clearTimeout(tualitoClickTimer); tualitoClickTimer = null; return; }
  tualitoClickTimer = setTimeout(() => {
    tualitoClickTimer = null;
    toggleTualitoBubble();
  }, 280);
}

function onTualitoDblClick() {
  // Doble clic: ir al Chat Dedicado
  clearTimeout(tualitoClickTimer);
  tualitoClickTimer = null;
  closeTualitoBubble();
  navigateTo('asistente');
}

function toggleTualitoBubble() {
  const bubble = document.getElementById('tualito-bubble');
  if (!bubble) return;
  if (bubble.classList.contains('show')) {
    closeTualitoBubble();
  } else {
    updateTualitoContext();
    bubble.classList.add('show');
    setTualitoState('excited');
    setTimeout(() => setTualitoState('idle'), 1500);
  }
}

function closeTualitoBubble() {
  const bubble = document.getElementById('tualito-bubble');
  if (bubble) bubble.classList.remove('show');
}

function setTualitoState(state) {
  const avatar = document.getElementById('tualito-avatar');
  if (!avatar) return;
  avatar.className = 'tualito-avatar ' + state;
}

function showTualitoBadge(count) {
  const badge = document.getElementById('tualito-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

// ===== CONTEXTO DINÁMICO POR SECCIÓN =====
function updateTualitoContext() {
  const textEl = document.getElementById('tualito-bubble-text');
  const actionEl = document.getElementById('tualito-bubble-action');
  if (!textEl || !actionEl) return;

  const page = currentPage || 'home';

  switch (page) {
    case 'home':
      const lowCount = storeContext.lowStock.length;
      textEl.innerHTML = `📦 <strong>¡Ey!</strong> Tienes ${lowCount} productos por agotarse. Revisa tu <strong>Pedido Sugerido</strong> antes de que se acaben.`;
      actionEl.textContent = '🛒 Ver pedido sugerido';
      actionEl.onclick = () => { closeTualitoBubble(); navigateTo('catalogo'); };
      break;

    case 'catalogo':
      const temp = storeContext.temperature;
      if (temp > 25) {
        textEl.innerHTML = `☀️ ¡Hola! Hoy hace calor (<strong>${temp}°C</strong>), te sugiero revisar si te falta <strong>Agua Ciel</strong> o <strong>Coca-Cola 600ml</strong> antes de que se agoten.`;
      } else {
        textEl.innerHTML = `🌤️ Hoy está a <strong>${temp}°C</strong>. Los snacks y bebidas calientes podrían venderse bien hoy.`;
      }
      actionEl.textContent = '💬 Pedir por voz';
      actionEl.onclick = () => { closeTualitoBubble(); navigateTo('asistente'); };
      break;

    case 'pedidos':
      textEl.innerHTML = `🔔 <strong>¡Importante!</strong> Tienes pedidos que necesitan <strong>confirmación de entrega</strong>. Confirma para proteger tu negocio contra pérdidas.`;
      actionEl.textContent = '✅ Confirmar entregas';
      actionEl.onclick = () => { closeTualitoBubble(); navigateTo('home'); };
      break;

    case 'recompensas':
      textEl.innerHTML = `⭐ ¡Vas muy bien, Don Carlos! Estás a <strong>660 puntos</strong> del nivel Platino. ¡Sigue pidiendo semanal!`;
      actionEl.textContent = '🛒 Hacer pedido';
      actionEl.onclick = () => { closeTualitoBubble(); navigateTo('catalogo'); };
      break;

    case 'perfil':
      textEl.innerHTML = `👋 ¿Necesitas ayuda con tu cuenta? Puedo guiarte con facturas, pagos o cualquier duda.`;
      actionEl.textContent = '💬 Hablar con Tualito';
      actionEl.onclick = () => { closeTualitoBubble(); navigateTo('asistente'); };
      break;

    default:
      textEl.innerHTML = `¡Hola! Soy <strong>Tualito</strong> 🐕 Tu asistente. ¿En qué te ayudo?`;
      actionEl.textContent = '💬 Ir al chat';
      actionEl.onclick = () => { closeTualitoBubble(); navigateTo('asistente'); };
  }
}

function handleTualitoAction() {
  const actionEl = document.getElementById('tualito-bubble-action');
  if (actionEl && actionEl.onclick) actionEl.onclick();
}

// ============================================================
// SISTEMA DE VOZ - FIX COMPLETO
// ============================================================

/**
 * Inicializa el reconocimiento de voz de forma segura.
 * 1. Valida soporte del navegador
 * 2. Solicita permisos explícitamente con getUserMedia
 * 3. Inicializa SpeechRecognition con compatibilidad cruzada
 */
function initVoiceSystem() {
  // Validación de soporte
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Web Speech API no soportada en este navegador');
    return false;
  }

  // Crear instancia
  recognition = new SpeechRecognition();
  recognition.lang = 'es-MX';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  // Event handlers
  recognition.onstart = () => {
    isListening = true;
    setTualitoState('listening');
    updateVoiceUI(true);
    showToast('🎙️ Escuchando... habla ahora');
  };

  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    // Mostrar texto intermedio en el input del chat
    const input = document.getElementById('ai-input');
    if (input && interimTranscript) {
      input.value = interimTranscript;
    }

    // Resultado final: enviar al chat
    if (finalTranscript) {
      if (input) input.value = '';
      stopVoiceCapture();
      // Si estamos en el chat, enviar ahí. Si no, abrir chat y enviar.
      if (currentPage === 'asistente') {
        sendAIMessage(finalTranscript);
      } else {
        navigateTo('asistente');
        setTimeout(() => sendAIMessage(finalTranscript), 500);
      }
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    stopVoiceCapture();

    switch (event.error) {
      case 'not-allowed':
        micPermissionGranted = false;
        showToast('⚠️ Permite el acceso al micrófono');
        addMessageToChat('ai', '⚠️ **Necesito permiso para usar tu micrófono.**\n\nHaz clic en el icono de candado 🔒 en la barra de tu navegador y activa "Micrófono".\n\nSi estás abriendo desde un archivo local, abre desde:\n🌐 **https://yami108.github.io/tuali-app/**', []);
        break;
      case 'no-speech':
        showToast('No escuché nada. Intenta de nuevo.');
        break;
      case 'network':
        showToast('⚠️ Se necesita internet para reconocimiento de voz');
        break;
      case 'aborted':
        break; // Usuario canceló
      default:
        showToast('Error de voz: ' + event.error);
    }
  };

  recognition.onend = () => {
    stopVoiceCapture();
  };

  return true;
}

/**
 * Solicita permisos de micrófono explícitamente y luego inicia la captura.
 * Esto resuelve el bug de que no se pedían permisos antes de iniciar.
 */
async function requestMicAndStartListening() {
  // Verificar protocolo (file:// no soporta getUserMedia)
  if (window.location.protocol === 'file:') {
    showToast('⚠️ La voz requiere servidor. Abre desde GitHub Pages.');
    addMessageToChat('ai', '⚠️ **El micrófono no funciona desde archivos locales.**\n\nAbre la app desde:\n🌐 **https://yami108.github.io/tuali-app/**\n\nO ejecuta el servidor local:\n`python server.py`\ny abre `http://localhost:5000`', []);
    return;
  }

  // Si ya tenemos permiso, iniciar directamente
  if (micPermissionGranted && recognition) {
    startVoiceCapture();
    return;
  }

  // Solicitar permiso explícitamente con getUserMedia
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permiso concedido - liberar el stream inmediatamente
      stream.getTracks().forEach(track => track.stop());
      micPermissionGranted = true;

      // Inicializar reconocimiento si no existe
      if (!recognition) {
        if (!initVoiceSystem()) {
          showToast('Tu navegador no soporta reconocimiento de voz');
          return;
        }
      }

      startVoiceCapture();
    } else {
      // Fallback: intentar sin getUserMedia
      if (!recognition && !initVoiceSystem()) {
        showToast('Tu navegador no soporta reconocimiento de voz');
        return;
      }
      startVoiceCapture();
    }
  } catch (err) {
    console.error('Error de acceso al micrófono:', err);
    micPermissionGranted = false;
    showToast('⚠️ Permite el acceso al micrófono en tu navegador');
  }
}

function startVoiceCapture() {
  if (!recognition) return;
  try {
    recognition.start();
  } catch (e) {
    // Si ya estaba corriendo, parar y reiniciar
    try { recognition.stop(); } catch(_) {}
    setTimeout(() => { try { recognition.start(); } catch(_) {} }, 300);
  }
}

function stopVoiceCapture() {
  isListening = false;
  setTualitoState('idle');
  updateVoiceUI(false);
  if (recognition) {
    try { recognition.stop(); } catch(_) {}
  }
}

function updateVoiceUI(active) {
  // Botón de voz en el chat
  const chatVoiceBtn = document.getElementById('ai-voice-btn');
  if (chatVoiceBtn) chatVoiceBtn.classList.toggle('listening', active);

  // Indicador de voz en el chat
  const voiceStatus = document.getElementById('ai-voice-status');
  if (voiceStatus) voiceStatus.classList.toggle('show', active);

  // Botón de voz en la mascota
  const tualitoVoiceBtn = document.getElementById('tualito-voice-btn');
  if (tualitoVoiceBtn) tualitoVoiceBtn.classList.toggle('recording', active);
}

// ===== VOICE BUTTON HANDLERS =====

/** Botón de voz en el chat dedicado */
function toggleVoice() {
  if (isListening) {
    stopVoiceCapture();
  } else {
    requestMicAndStartListening();
  }
}

/** Botón de voz en la mascota flotante (accesibilidad adultos mayores) */
function tualitoVoice() {
  if (isListening) {
    stopVoiceCapture();
  } else {
    closeTualitoBubble();
    setTualitoState('listening');
    requestMicAndStartListening();
  }
}

// ============================================================
// CHAT AI - Lógica de conversación
// ============================================================

const zoneRecommendations = {
  kinder: { label: '🏫 Kinder Pequeños Genios (200m)', products: [11, 12, 13], reason: 'Los papás compran jugos para los niños a la salida' },
  escuela: { label: '🏫 Primaria B. Juárez (350m)', products: [15, 17, 18, 9], reason: 'Estudiantes compran snacks y agua en el recreo' },
  parque: { label: '🌳 Parque Central (150m)', products: [7, 8, 21], reason: 'Gente haciendo ejercicio busca hidratación' }
};

function getAIResponse(userMessage) {
  const msg = userMessage.toLowerCase().trim();

  // Estado: Alerta de inventario
  if (aiState === 'inventory_alert') {
    if (msg.match(/s[ií]|ok|dale|hazlo|acepto/)) {
      aiState = 'idle';
      storeContext.lowStock.forEach(item => addToCart(item.name));
      return { text: `¡Listo! Agregué al carrito:\n\n${storeContext.lowStock.map(i => `${i.emoji} ${i.name}`).join('\n')}\n\n¿Confirmo el pedido?`, actions: [{ label: '✅ Confirmar', action: 'ai_confirm_yes' }, { label: '➕ Agregar más', action: 'ai_add_more' }] };
    }
    aiState = 'idle';
    return { text: 'Entendido. Te aviso después. ¿Algo más?', actions: getDefaultActions() };
  }

  // Estado: Confirmando pedido
  if (aiState === 'confirming_order') {
    if (msg.match(/s[ií]|confirma|dale|acepto|ok/)) {
      aiState = 'idle'; confirmOrder();
      return { text: '🎉 ¡Pedido confirmado! Te llegará el próximo ' + storeContext.deliveryDay + '. Te aviso cuando salga a ruta.', actions: getDefaultActions() };
    }
    if (msg.match(/no|cancel|espera/)) {
      aiState = 'idle';
      return { text: 'Ok, lo dejé en tu carrito. ¿En qué más te ayudo?', actions: getDefaultActions() };
    }
  }

  // Estado: Pidiendo productos
  if (aiState === 'asking_products') {
    const found = findProductsInMessage(msg);
    if (found.length > 0) {
      found.forEach(p => addToCart(p.name));
      aiState = 'confirming_order';
      const list = found.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
      const total = found.reduce((s, p) => s + p.price, 0);
      return { text: `Agregué al carrito:\n\n${list}\n\n💰 Total: $${total.toLocaleString()}\n🚚 Entrega: ${storeContext.deliveryDay}\n\n¿Confirmo?`, actions: [{ label: '✅ Confirmar', action: 'ai_confirm_yes' }, { label: '❌ No', action: 'ai_confirm_no' }, { label: '➕ Más', action: 'ai_add_more' }] };
    }
    return { text: 'No encontré esos productos. Tengo: Coca-Cola, Fanta, Sprite, Ciel, Del Valle, Bokados, Monster y Powerade. ¿Qué necesitas?', actions: [] };
  }

  // Saludos
  if (msg.match(/^(hola|buenos|buenas|hey|que tal)/)) {
    const temp = storeContext.temperature;
    let greeting = `¡Hola Don Carlos! 🐕 Soy Tualito, tu asistente.`;
    if (temp > 28) greeting += ` Hoy hace ${temp}°C, ¡las bebidas frías se van a vender mucho! 🥤❄️`;
    else if (temp < 18) greeting += ` Hoy está a ${temp}°C, buen día para snacks y bebidas calientes. ☕`;
    else greeting += ` Hoy está a ${temp}°C, buen clima para vender de todo.`;
    greeting += '\n\n¿En qué te ayudo?';
    return { text: greeting, actions: getDefaultActions() };
  }

  // Pedir productos
  if (msg.match(/pedir|pedido|comprar|ordenar|quiero|necesito|ocupo|encarga/)) {
    const found = findProductsInMessage(msg);
    if (found.length > 0) {
      found.forEach(p => addToCart(p.name));
      aiState = 'confirming_order';
      const list = found.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
      const total = found.reduce((s, p) => s + p.price, 0);
      return { text: `¡Claro! Agregué:\n\n${list}\n\n💰 Total: $${total.toLocaleString()}\n🚚 Entrega: ${storeContext.deliveryDay}\n\n¿Confirmo el pedido?`, actions: [{ label: '✅ Confirmar', action: 'ai_confirm_yes' }, { label: '❌ No', action: 'ai_confirm_no' }, { label: '➕ Más', action: 'ai_add_more' }] };
    }
    aiState = 'asking_products';
    return { text: '¡Con gusto! ¿Qué productos necesitas?', actions: [{ label: '🥤 Refrescos', action: 'ai_cat_refrescos' }, { label: '💧 Aguas', action: 'ai_cat_aguas' }, { label: '🧃 Jugos', action: 'ai_cat_jugos' }, { label: '🍪 Snacks', action: 'ai_cat_snacks' }, { label: '🔄 Repetir pedido', action: 'ai_repeat' }] };
  }

  // Recomendaciones por zona
  if (msg.match(/recomiend|sugier|que me conviene|zona|que se vende/)) { return getZoneRecommendation(); }
  // Inventario
  if (msg.match(/inventario|stock|se acab|falta|queda/)) { return getInventoryAlert(); }
  // Repetir
  if (msg.match(/repetir|lo de siempre|mismo de siempre/)) { return repeatLastOrder(); }
  // Categorías
  if (msg.match(/refresco/)) { return showCategoryProducts('refrescos'); }
  if (msg.match(/agua|ciel/)) { return showCategoryProducts('aguas'); }
  if (msg.match(/jugo|del valle/)) { return showCategoryProducts('jugos'); }
  if (msg.match(/snack|papas|bokados/)) { return showCategoryProducts('snacks'); }
  if (msg.match(/monster|powerade|energetica/)) { return showCategoryProducts('energeticas'); }
  // Clima
  if (msg.match(/clima|temperatura|calor|frio|lluv/)) {
    const t = storeContext.temperature;
    let text = `🌡️ Hoy está a **${t}°C**.\n\n`;
    if (t > 28) text += '🔥 Día caluroso. ¡Refrescos y aguas se venderán mucho!';
    else if (t > 22) text += '☀️ Clima agradable. Buen día para todo tipo de ventas.';
    else text += '🧥 Está fresco. Los snacks y bebidas calientes son buena opción.';
    return { text, actions: getDefaultActions() };
  }
  // Ayuda
  if (msg.match(/ayuda|que puedes/)) { return { text: 'Puedo ayudarte con:\n\n🛒 **Hacer pedidos** - Dime qué necesitas\n🎙️ **Por voz** - Presiona el micrófono\n📊 **Recomendaciones** - Según tu zona y clima\n📸 **Inventario** - Aviso cuando algo se acaba\n⚡ **Pedido rápido** - Confirma con un clic', actions: getDefaultActions() }; }
  // Gracias
  if (msg.match(/gracias/)) { return { text: '¡De nada, Don Carlos! 😊🐕 Aquí estoy siempre que me necesites. ¡Éxito con las ventas! 💪', actions: [] }; }

  return { text: '¿En qué te ayudo? Puedo hacer pedidos, darte recomendaciones o revisar tu inventario. También puedes hablarme por voz 🎙️', actions: getDefaultActions() };
}

function findProductsInMessage(msg) {
  const found = [];
  const keywords = { 'coca': [1,2,3,22], 'fanta': [4], 'sprite': [5], 'fresca': [6], 'ciel': [7,8,9,10], 'topo': [24], 'del valle': [11,12,13], 'fuze': [14], 'bokados': [15,16,17,18], 'monster': [19,20], 'powerade': [21], 'mundet': [23] };
  Object.entries(keywords).forEach(([key, ids]) => {
    if (msg.includes(key)) {
      const p = products.find(pr => pr.id === ids[0]);
      if (p && !found.find(f => f.id === p.id)) found.push(p);
    }
  });
  return found;
}

function showCategoryProducts(category) {
  const catProducts = products.filter(p => p.category === category);
  const list = catProducts.slice(0, 5).map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
  aiState = 'asking_products';
  return { text: `Productos de ${category}:\n\n${list}\n\n¿Cuáles quieres?`, actions: catProducts.slice(0, 4).map(p => ({ label: `${p.emoji} ${p.name.split(' ').slice(0,2).join(' ')}`, action: `ai_add_product_${p.id}` })) };
}

function getZoneRecommendation() {
  let text = `📍 **Recomendaciones para tu zona** (${storeContext.zone}):\n\n`;
  text += `🌡️ Clima: ${storeContext.temperature}°C\n\n`;
  Object.values(zoneRecommendations).forEach(rec => {
    const prods = rec.products.map(id => products.find(p => p.id === id)).filter(Boolean);
    text += `**${rec.label}**\n💡 ${rec.reason}\n→ ${prods.map(p => p.emoji + ' ' + p.name.split(' ').slice(0,2).join(' ')).join(', ')}\n\n`;
  });
  text += '¿Agrego alguno al carrito?';
  return { text, actions: [{ label: '🧃 Jugos (kinder)', action: 'ai_zone_kinder' }, { label: '🍪 Snacks (escuela)', action: 'ai_zone_escuela' }, { label: '💧 Aguas (parque)', action: 'ai_zone_parque' }] };
}

function getInventoryAlert() {
  if (storeContext.lowStock.length === 0) return { text: '✅ ¡Todo bien! No hay productos con bajo inventario. 👍', actions: getDefaultActions() };
  aiState = 'inventory_alert';
  const list = storeContext.lowStock.map(i => `${i.emoji} ${i.name} - Solo quedan ${i.remaining}`).join('\n');
  return { text: `⚠️ **Alerta de inventario**\n\n${list}\n\nPróxima entrega: ${storeContext.deliveryDay}. ¿Hago el pedido?`, actions: [{ label: '✅ Sí, pedir', action: 'ai_inventory_yes' }, { label: '🕐 Después', action: 'ai_inventory_no' }] };
}

function repeatLastOrder() {
  const items = [products[0], products[6], products[10]];
  items.forEach(p => addToCart(p.name));
  aiState = 'confirming_order';
  const list = items.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
  const total = items.reduce((s, p) => s + p.price, 0);
  return { text: `Repetí tu último pedido:\n\n${list}\n\n💰 Total: $${total.toLocaleString()}\n🚚 Entrega: ${storeContext.deliveryDay}\n\n¿Lo confirmo?`, actions: [{ label: '✅ Confirmar', action: 'ai_confirm_yes' }, { label: '✏️ Modificar', action: 'ai_add_more' }, { label: '❌ Cancelar', action: 'ai_confirm_no' }] };
}

function getDefaultActions() {
  return [{ label: '🛒 Hacer pedido', action: 'ai_order' }, { label: '📊 Recomendaciones', action: 'ai_recommend' }, { label: '📦 Inventario', action: 'ai_inventory' }, { label: '🔄 Repetir pedido', action: 'ai_repeat' }];
}

// ===== ACTION HANDLER =====
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
      aiState = 'confirming_order'; userMsg = 'Agrega jugos del kinder'; break;
    case 'ai_zone_escuela':
      [15,17,18,9].forEach(id => { const p = products.find(pr => pr.id === id); if(p) addToCart(p.name); });
      aiState = 'confirming_order'; userMsg = 'Agrega snacks de la escuela'; break;
    case 'ai_zone_parque':
      [7,8,21].forEach(id => { const p = products.find(pr => pr.id === id); if(p) addToCart(p.name); });
      aiState = 'confirming_order'; userMsg = 'Agrega aguas del parque'; break;
    case 'ai_go_cart': navigateTo('carrito'); return;
    case 'ai_go_home': navigateTo('home'); return;
    default:
      if (action.startsWith('ai_add_product_')) {
        const id = parseInt(action.replace('ai_add_product_', ''));
        const p = products.find(pr => pr.id === id);
        if (p) { addToCart(p.name); userMsg = `Agrega ${p.name}`; }
      } break;
  }
  if (userMsg) sendAIMessage(userMsg);
}

// ===== CHAT MESSAGING =====
function sendAIMessage(text = null) {
  const input = document.getElementById('ai-input');
  const message = text || (input ? input.value.trim() : '');
  if (!message) return;
  if (!text && input) input.value = '';

  addMessageToChat('user', message);
  setTualitoState('thinking');

  // Try backend first, fallback to local
  sendToBackend(message).then(backendResp => {
    setTualitoState('idle');
    if (backendResp && backendResp.response) {
      let actions = backendResp.action === 'order_created'
        ? [{ label: '📦 Ver carrito', action: 'ai_go_cart' }, { label: '🏠 Inicio', action: 'ai_go_home' }]
        : getDefaultActions();
      addMessageToChat('ai', backendResp.response, actions);
    } else {
      const response = getAIResponse(message);
      addMessageToChat('ai', response.text, response.actions);
    }
  });
}

async function sendToBackend(message) {
  if (!API_BASE && window.location.protocol === 'file:') return null;
  try {
    const resp = await fetch(`${API_BASE}/api/tuali-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context: '' })
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) { return null; }
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

// ============================================================
// ALERTAS SYSTEM
// ============================================================

async function loadAlertas() {
  const container = document.getElementById('contenedor-alertas-tuali');
  if (!container) return;

  try {
    const resp = await fetch(`${API_BASE}/api/alertas`);
    if (!resp.ok) throw new Error('No alertas');
    const data = await resp.json();
    container.innerHTML = '';

    // Actualizar temperatura
    if (data.clima) storeContext.temperature = data.clima.temp;

    // Alertas de seguridad
    data.alertas.filter(a => a.tipo === 'confirmacion_entrega').forEach(alerta => {
      container.innerHTML += `
        <div class="alerta-tuali alerta-seguridad" id="alerta-${alerta.id_pedido}">
          <div class="alerta-tuali-icon">🔔</div>
          <div class="alerta-tuali-content">
            <div class="alerta-tuali-title">Confirmar recepción</div>
            <div class="alerta-tuali-text">${alerta.mensaje}</div>
            <div class="alerta-tuali-actions">
              <button class="alerta-tuali-btn alerta-tuali-btn-confirm" onclick="confirmarEntrega(${alerta.id_pedido}, 1)">✅ Sí recibí</button>
              <button class="alerta-tuali-btn alerta-tuali-btn-report" onclick="confirmarEntrega(${alerta.id_pedido}, -1)">🚨 Reportar</button>
            </div>
          </div>
          <button class="alerta-tuali-close" onclick="this.parentElement.remove()">✕</button>
        </div>`;
    });

    // Alertas de desabasto
    data.alertas.filter(a => a.tipo === 'desabasto').forEach(alerta => {
      container.innerHTML += `
        <div class="alerta-tuali alerta-desabasto">
          <div class="alerta-tuali-icon">⚠️</div>
          <div class="alerta-tuali-content">
            <div class="alerta-tuali-title">Bajo inventario</div>
            <div class="alerta-tuali-text">${alerta.producto}: ${alerta.stock_actual} unidades (~${alerta.dias_restantes} días)</div>
            <div class="alerta-tuali-actions">
              <button class="alerta-tuali-btn alerta-tuali-btn-order" onclick="navigateTo('asistente');setTimeout(()=>sendAIMessage('Pedir ${alerta.producto}'),500)">🛒 Pedir</button>
              <button class="alerta-tuali-btn alerta-tuali-btn-dismiss" onclick="this.closest('.alerta-tuali').remove()">Después</button>
            </div>
          </div>
        </div>`;
    });

    showTualitoBadge(data.alertas.length);
    if (data.alertas.length > 0) setTualitoState('alert');

  } catch (e) {
    // Backend no disponible - alertas simuladas
    showSimulatedAlerts();
  }
}

function showSimulatedAlerts() {
  const container = document.getElementById('contenedor-alertas-tuali');
  if (!container) return;
  container.innerHTML = `
    <div class="alerta-tuali alerta-seguridad" id="alerta-1">
      <div class="alerta-tuali-icon">🔔</div>
      <div class="alerta-tuali-content">
        <div class="alerta-tuali-title">Confirmar recepción</div>
        <div class="alerta-tuali-text">¿Recibió el pedido #AC-2847? ($3,240)</div>
        <div class="alerta-tuali-actions">
          <button class="alerta-tuali-btn alerta-tuali-btn-confirm" onclick="confirmarEntrega(1, 1)">✅ Sí recibí</button>
          <button class="alerta-tuali-btn alerta-tuali-btn-report" onclick="confirmarEntrega(1, -1)">🚨 Reportar</button>
        </div>
      </div>
      <button class="alerta-tuali-close" onclick="this.parentElement.remove()">✕</button>
    </div>
    <div class="alerta-tuali alerta-desabasto">
      <div class="alerta-tuali-icon">⚠️</div>
      <div class="alerta-tuali-content">
        <div class="alerta-tuali-title">Bajo inventario</div>
        <div class="alerta-tuali-text">Ciel 500ml: 5 unidades (~0.4 días)</div>
        <div class="alerta-tuali-actions">
          <button class="alerta-tuali-btn alerta-tuali-btn-order" onclick="navigateTo('asistente');setTimeout(()=>sendAIMessage('Pedir Ciel 500ml'),500)">🛒 Pedir</button>
          <button class="alerta-tuali-btn alerta-tuali-btn-dismiss" onclick="this.closest('.alerta-tuali').remove()">Después</button>
        </div>
      </div>
    </div>`;
  showTualitoBadge(2);
  setTualitoState('alert');
  setTimeout(() => setTualitoState('idle'), 3000);
}

async function confirmarEntrega(idPedido, confirmacion) {
  try {
    const resp = await fetch(`${API_BASE}/api/confirmar-entrega`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_pedido: idPedido, confirmacion })
    });
    const data = await resp.json();
    if (data.success) showToast(data.mensaje);
  } catch (e) {
    showToast(confirmacion === 1 ? '✅ Recepción confirmada. +50 puntos Tuali' : '🚨 Incidencia reportada. Te contactaremos.');
  }
  const alertEl = document.getElementById(`alerta-${idPedido}`);
  if (alertEl) alertEl.remove();
}

// ============================================================
// NOTIFICATIONS
// ============================================================

function showInventoryNotification() {
  const notif = document.getElementById('ai-notification');
  if (!notif) return;
  notif.innerHTML = `<div class="notif-icon">🐕</div><div class="notif-content"><div class="notif-title">Tualito dice:</div><div class="notif-text">Tu Coca-Cola 600ml se está acabando (3 unidades). ¡Toca para pedir!</div></div><button class="notif-close" onclick="event.stopPropagation();closeNotification()">✕</button>`;
  notif.style.display = 'flex';
  notif.onclick = () => {
    closeNotification();
    navigateTo('asistente');
    setTimeout(() => {
      aiState = 'inventory_alert';
      addMessageToChat('ai', '📸 **Alerta de inventario**\n\nDetecté que tu Coca-Cola 600ml se está acabando (solo quedan 3).\n\n¿Quieres que haga el pedido ahora?', [{ label: '✅ Sí, pedir', action: 'ai_inventory_yes' }, { label: '🕐 Después', action: 'ai_inventory_no' }]);
    }, 500);
  };
}

function closeNotification() {
  const n = document.getElementById('ai-notification');
  if (n) n.style.display = 'none';
}

// ============================================================
// INIT
// ============================================================

function initAI() {
  const chat = document.getElementById('ai-chat-messages');
  if (chat && chat.children.length === 0) {
    addMessageToChat('ai', '¡Hola Don Carlos! 🐕 Soy **Tualito**, tu asistente.\n\nPuedo ayudarte a:\n🛒 Hacer pedidos (texto o voz)\n📊 Recomendarte productos según tu zona y clima\n📸 Avisarte cuando algo se acaba\n🔔 Confirmar entregas para tu seguridad\n⚡ Todo con un clic o hablándome\n\n¿En qué te ayudo?', getDefaultActions());
  }
  initVoiceSystem();
}

function showTualitoWidget() {
  const widget = document.getElementById('tuali-mascota-flotante');
  if (widget) widget.classList.add('visible');
}

function hideTualitoWidget() {
  const widget = document.getElementById('tuali-mascota-flotante');
  if (widget) widget.classList.remove('visible');
  closeTualitoBubble();
}

// Auto-show notification after 15 seconds
function scheduleNotification() {
  setTimeout(() => {
    if (currentPage !== 'login' && currentPage !== 'asistente') {
      showInventoryNotification();
    }
  }, 15000);
}
