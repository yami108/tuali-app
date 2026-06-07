/* ============================================
   TUALITO - Mascota Virtual IA
   Asistente persistente contextual + Voz
   ============================================ */

// ===== STATE =====
let aiState = 'idle'; // idle, asking_products, confirming_order, inventory_alert
let recognition = null;
let isListening = false;
let escucharActivamente = false; // Flag para escucha continua persistente
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
// SISTEMA DE VOZ - ESCUCHA CONTINUA PERSISTENTE
// ============================================================

/**
 * Inicializa el reconocimiento de voz con reinicio automático.
 * BUG FIX: El recognition.onend ahora reinicia la escucha si
 * escucharActivamente === true, evitando que se destruya tras cada frase.
 */
function initVoiceSystem() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Web Speech API no soportada en este navegador');
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'es-MX';
  recognition.continuous = false; // Se maneja reinicio manual en onend para evitar bloqueos de buffer
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    setTualitoState('listening');
    updateVoiceUI(true);
    // Agregar clase de grabación a la mascota global
    const mascota = document.getElementById('tuali-mascota-flotante');
    if (mascota) mascota.classList.add('grabando-active');
    showToast('🎙️ Tualito está escuchando... habla ahora');
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
      // NO llamar stopVoiceCapture aquí - dejar que onend maneje el reinicio
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
    // Quitar clase visual
    const mascota = document.getElementById('tuali-mascota-flotante');
    if (mascota) mascota.classList.remove('grabando-active');

    switch (event.error) {
      case 'not-allowed':
        micPermissionGranted = false;
        escucharActivamente = false;
        updateVoiceUI(false);
        setTualitoState('idle');
        showToast('⚠️ Permite el acceso al micrófono');
        addMessageToChat('ai', '⚠️ **Necesito permiso para tu micrófono, jefe.**\n\nDale clic al candadito 🔒 arriba en tu navegador y activa "Micrófono".\n\nSi lo abriste desde un archivo, mejor ábrelo desde:\n🌐 **https://yami108.github.io/tuali-app/**', []);
        break;
      case 'no-speech':
        // No detener escucha activa por silencio
        if (!escucharActivamente) {
          showToast('No escuché nada. Intenta de nuevo.');
        }
        break;
      case 'network':
        escucharActivamente = false;
        updateVoiceUI(false);
        setTualitoState('idle');
        showToast('⚠️ Se necesita internet para reconocimiento de voz');
        break;
      case 'aborted':
        break;
      default:
        if (!escucharActivamente) {
          showToast('Error de voz: ' + event.error);
        }
    }
  };

  // SOLUCIÓN AL BUG PRINCIPAL: Reinicio automático continuo
  recognition.onend = () => {
    isListening = false;
    const mascota = document.getElementById('tuali-mascota-flotante');
    if (mascota) mascota.classList.remove('grabando-active');

    // Si la vista de chat de voz sigue abierta Y el usuario quiere seguir escuchando,
    // reiniciar la escucha automáticamente tras un breve delay
    if (escucharActivamente) {
      setTimeout(() => {
        if (escucharActivamente) {
          try {
            recognition.start();
          } catch(e) {
            console.log('Reinicio de escucha diferido');
            setTimeout(() => { try { recognition.start(); } catch(_){} }, 500);
          }
        }
      }, 300);
    } else {
      updateVoiceUI(false);
      setTualitoState('idle');
    }
  };

  return true;
}

/**
 * Solicita permisos de micrófono explícitamente con getUserMedia
 * y luego inicia la escucha continua.
 */
async function requestMicAndStartListening() {
  if (window.location.protocol === 'file:') {
    showToast('⚠️ La voz requiere servidor. Abre desde GitHub Pages.');
    addMessageToChat('ai', '⚠️ **El micro no jala desde archivos locales, jefe.**\n\nÁbrelo desde:\n🌐 **https://yami108.github.io/tuali-app/**\n\nO corre el servidor:\n`python server.py` y abre `http://localhost:5000`', []);
    return;
  }

  if (micPermissionGranted && recognition) {
    startContinuousListening();
    return;
  }

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      micPermissionGranted = true;
      console.log('Acceso al micrófono concedido por el tendero.');

      if (!recognition) {
        if (!initVoiceSystem()) {
          showToast('Tu navegador no soporta reconocimiento de voz');
          return;
        }
      }
      startContinuousListening();
    } else {
      if (!recognition && !initVoiceSystem()) {
        showToast('Tu navegador no soporta reconocimiento de voz');
        return;
      }
      startContinuousListening();
    }
  } catch (err) {
    console.error('Error de acceso al micrófono:', err);
    micPermissionGranted = false;
    showToast('⚠️ Permite el acceso al micrófono en tu navegador');
    alert('Por favor, permite el acceso al micrófono en la barra del navegador para usar a Tualito por voz.');
  }
}

function startContinuousListening() {
  if (!recognition) return;
  escucharActivamente = true;
  try {
    recognition.start();
  } catch (e) {
    try { recognition.stop(); } catch(_) {}
    setTimeout(() => { try { recognition.start(); } catch(_) {} }, 300);
  }
}

function stopContinuousListening() {
  escucharActivamente = false;
  isListening = false;
  updateVoiceUI(false);
  setTualitoState('idle');
  const mascota = document.getElementById('tuali-mascota-flotante');
  if (mascota) mascota.classList.remove('grabando-active');
  if (recognition) {
    try { recognition.stop(); } catch(_) {}
  }
}

function updateVoiceUI(active) {
  const chatVoiceBtn = document.getElementById('ai-voice-btn');
  if (chatVoiceBtn) chatVoiceBtn.classList.toggle('listening', active);
  const voiceStatus = document.getElementById('ai-voice-status');
  if (voiceStatus) voiceStatus.classList.toggle('show', active);
  const tualitoVoiceBtn = document.getElementById('tualito-voice-btn');
  if (tualitoVoiceBtn) tualitoVoiceBtn.classList.toggle('recording', active);
}

// ===== VOICE BUTTON HANDLERS =====

/** Botón de voz en el chat dedicado - Toggle continuo */
function toggleVoice() {
  if (escucharActivamente) {
    stopContinuousListening();
    showToast('🎙️ Micrófono apagado');
  } else {
    requestMicAndStartListening();
  }
}

/** Botón de voz en la mascota flotante (accesibilidad adultos mayores) */
function tualitoVoice() {
  if (escucharActivamente) {
    stopContinuousListening();
    showToast('🎙️ Micrófono apagado');
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
  const msg = userMessage.toLowerCase().trim()
    // Normalizar modismos mexicanos informales
    .replace(/^oiga\s*/,'').replace(/^mire\s*/,'').replace(/^fíjese\s*/,'')
    .replace(/pos\b/g,'pues').replace(/pa\b/g,'para').replace(/nel\b/g,'no')
    .replace(/simón/g,'sí').replace(/neta/g,'verdad').replace(/chido/g,'bien')
    .replace(/jale\b/g,'trabajo').replace(/chamba/g,'trabajo').replace(/morro/g,'niño')
    .replace(/chela/g,'cerveza').replace(/refri\b/g,'refrigerador').replace(/nomas/g,'nomás')
    .replace(/ahorita/g,'ahora').replace(/ándale/g,'sí').replace(/órale/g,'sí')
    .replace(/va\b$/,'sí').replace(/sale\b$/,'sí').replace(/jalo\b/g,'sí');

  // Estado: Alerta de inventario
  if (aiState === 'inventory_alert') {
    if (msg.match(/s[ií]|ok|dale|hazlo|acepto|va|sale|jalo|ándale|órale|pues|arre/)) {
      aiState = 'idle';
      storeContext.lowStock.forEach(item => addToCart(item.name));
      return { text: `¡Listo, jefe! Ya te los puse en el carrito:\n\n${storeContext.lowStock.map(i => `${i.emoji} ${i.name}`).join('\n')}\n\n¿Le doy confirmar al pedido o le agregas algo más?`, actions: [{ label: '✅ Confirmar', action: 'ai_confirm_yes' }, { label: '➕ Agregar más', action: 'ai_add_more' }] };
    }
    aiState = 'idle';
    return { text: 'Sale, no hay problema. Te echo un grito cuando ya esté más urgente. ¿Te ayudo con algo más?', actions: getDefaultActions() };
  }

  // Estado: Confirmando pedido
  if (aiState === 'confirming_order') {
    if (msg.match(/s[ií]|confirma|dale|acepto|ok|va|sale|jalo|arre|órale|pues s/)) {
      aiState = 'idle'; confirmOrder();
      return { text: '🎉 ¡Listo, Don Carlos! Pedido confirmado. Te llega el ' + storeContext.deliveryDay + '. Yo te aviso cuando el camión salga para acá. ¡Éxito con las ventas! 💪', actions: getDefaultActions() };
    }
    if (msg.match(/no|cancel|espera|nel|todavía no|ahorita no|luego/)) {
      aiState = 'idle';
      return { text: 'Órale, ahí te lo dejo en el carrito por si al rato te animas. ¿Algo más en que te eche la mano?', actions: getDefaultActions() };
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
      return { text: `¡Va que va! Te puse en el carrito:\n\n${list}\n\n💰 Total: $${total.toLocaleString()}\n🚚 Te llega el: ${storeContext.deliveryDay}\n\n¿Le confirmo, jefe?`, actions: [{ label: '✅ Dale', action: 'ai_confirm_yes' }, { label: '❌ Nel', action: 'ai_confirm_no' }, { label: '➕ Falta más', action: 'ai_add_more' }] };
    }
    return { text: 'Hmm, no le caché cuál producto, jefe. Tengo de todo: Coca, Fanta, Sprite, aguas Ciel, jugos Del Valle, Bokados, Monster... ¿Cuál le pongo?', actions: [] };
  }

  // Saludos informales mexicanos
  if (msg.match(/^(hola|buenos|buenas|hey|que tal|quiubo|qué onda|que onda|quihúbole|epa)/)) {
    const temp = storeContext.temperature;
    let greeting = `¡Quiúbole Don Carlos! Soy Tualito, su asistente de confianza. 🧢`;
    if (temp > 28) greeting += `\n\n☀️ ¡Uff, hoy está haciendo un calorón de ${temp}°C! Las cocas frías y las aguas se te van a ir como agua (literalmente 😄). Asegúrate de tener bien surtido el refri.`;
    else if (temp < 18) greeting += `\n\n🧥 Está fresquecito hoy (${temp}°C). Los chavos de la escuela van a querer papitas y cacahuates, y los del parque un cafecito.`;
    else greeting += `\n\n🌤️ Bonito día hoy, ${temp}°C. Buen clima pa' vender de todo un poco.`;
    greeting += '\n\n¿En qué le ayudo, jefe?';
    return { text: greeting, actions: getDefaultActions() };
  }

  // Pedir productos - incluye formas coloquiales
  if (msg.match(/pedir|pedido|comprar|ordenar|quiero|necesito|ocupo|encarga|manda|mándame|échale|ponme|surte|surtir|tráe|traeme|dame/)) {
    const found = findProductsInMessage(msg);
    if (found.length > 0) {
      found.forEach(p => addToCart(p.name));
      aiState = 'confirming_order';
      const list = found.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
      const total = found.reduce((s, p) => s + p.price, 0);
      return { text: `¡Órale! Ya te lo puse, jefe:\n\n${list}\n\n💰 Total: $${total.toLocaleString()}\n🚚 Te llega: ${storeContext.deliveryDay}\n\n¿Le damos pa'delante con el pedido?`, actions: [{ label: '✅ ¡Dale!', action: 'ai_confirm_yes' }, { label: '❌ Espérate', action: 'ai_confirm_no' }, { label: '➕ Ponle más', action: 'ai_add_more' }] };
    }
    aiState = 'asking_products';
    return { text: '¡Claro que sí! ¿Qué te hace falta? Dime nomás y te lo pongo en el carrito.', actions: [{ label: '🥤 Refrescos', action: 'ai_cat_refrescos' }, { label: '💧 Aguas', action: 'ai_cat_aguas' }, { label: '🧃 Jugos', action: 'ai_cat_jugos' }, { label: '🍪 Snacks', action: 'ai_cat_snacks' }, { label: '🔄 Lo de siempre', action: 'ai_repeat' }] };
  }

  // Recomendaciones por zona
  if (msg.match(/recomiend|sugier|que me conviene|zona|que se vende|qué jalo|que jalo|tip/)) { return getZoneRecommendation(); }
  // Inventario
  if (msg.match(/inventario|stock|se acab|falta|queda|hay poco|se va a acabar|se me acaba/)) { return getInventoryAlert(); }
  // Repetir
  if (msg.match(/repetir|lo de siempre|mismo|lo mismo|igual que antes|lo que siempre pido/)) { return repeatLastOrder(); }
  // Categorías con variantes coloquiales
  if (msg.match(/refresco|coca|coca.?cola/)) { return showCategoryProducts('refrescos'); }
  if (msg.match(/agua|ciel|topo chico/)) { return showCategoryProducts('aguas'); }
  if (msg.match(/jugo|del valle|juguit/)) { return showCategoryProducts('jugos'); }
  if (msg.match(/snack|papas|bokados|frituras|churritos|cacahuate|palomita/)) { return showCategoryProducts('snacks'); }
  if (msg.match(/monster|powerade|energetica|bebida energética|energy/)) { return showCategoryProducts('energeticas'); }
  // Clima
  if (msg.match(/clima|temperatura|calor|frio|lluv|hace calor|está haciendo/)) {
    const t = storeContext.temperature;
    let text = `🌡️ Ahorita estamos a **${t}°C**, jefe.\n\n`;
    if (t > 28) text += '🔥 ¡Está haciendo un calorón! Los refrescos bien fríos y las aguas se van a vender como pan caliente. Asegúrate de tener surtido.';
    else if (t > 22) text += '☀️ Clima bonito. Buen día pa\' vender de todo un poquito.';
    else text += '🧥 Está fresco. Los snackecitos y las bebidas calientes jalan bien con este clima.';
    return { text, actions: getDefaultActions() };
  }
  // Ayuda
  if (msg.match(/ayuda|que puedes|cómo funciona|qué haces|para qué sirves/)) { return { text: '¡Aquí andamos, jefe! Te puedo echar la mano con:\n\n🛒 **Pedidos** - Dime qué necesitas y yo lo pongo\n🎙️ **Por voz** - Nomás háblame, como si fuera tu compa\n📊 **Consejos** - Te digo qué se vende según tu zona y el clima\n📸 **Inventario** - Te aviso antes de que se te acabe algo\n⚡ **Rapidito** - Todo con un clic, sin complicaciones\n\n¿Qué se te ofrece?', actions: getDefaultActions() }; }
  // Gracias / despedida
  if (msg.match(/gracias|mil gracias|te la rifas|chido|va pues|nos vemos/)) { return { text: '¡No hay de queso, nomás de papa! 😄 Aquí ando siempre que me necesites, Don Carlos. ¡Éxito con las ventas hoy! 💪🧢', actions: [] }; }
  // Groserías / frustración (manejar con empatía)
  if (msg.match(/chin|diablos|rayos|no sirve|no funciona|no jala/)) { return { text: '¡Tranquilo, jefe! Dígame qué pasó y le echo la mano. Si es algo del pedido, del inventario o lo que sea, aquí estoy pa\' resolverle. 🤝', actions: getDefaultActions() }; }

  return { text: '¡Aquí andamos, jefe! Dígame qué se le ofrece. Le puedo hacer pedidos, dar consejos de qué surtir, o checar su inventario. También me puede hablar por el micrófono si se le hace más fácil 🎙️', actions: getDefaultActions() };
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
  notif.innerHTML = `<div class="notif-icon">🧢</div><div class="notif-content"><div class="notif-title">Tualito dice:</div><div class="notif-text">¡Ey jefe! Tu Coca-Cola 600ml se está acabando (quedan 3). ¡Tócame pa' pedirla!</div></div><button class="notif-close" onclick="event.stopPropagation();closeNotification()">✕</button>`;
  notif.style.display = 'flex';
  notif.onclick = () => {
    closeNotification();
    navigateTo('asistente');
    setTimeout(() => {
      aiState = 'inventory_alert';
      addMessageToChat('ai', '📸 **¡Ojo, jefe!** Le estoy checando el refri y vi que la Coca-Cola 600ml ya nomás te quedan 3.\n\nSi no le surtes ahorita, pa\' mañana ya no vas a tener. ¿Le hago el pedido de una vez?', [{ label: '✅ ¡Dale!', action: 'ai_inventory_yes' }, { label: '🕐 Al rato', action: 'ai_inventory_no' }]);
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
    addMessageToChat('ai', '¡Quiúbole, Don Carlos! 🧢 Soy **Tualito**, su asistente de confianza.\n\nYo le echo la mano con:\n🛒 Pedidos - Dígame qué le falta y yo lo pongo\n🎙️ Por voz - Hábleme como si fuera su compa\n📊 Consejos - Le digo qué surtir según su zona\n📸 Inventario - Le aviso antes de que se le acabe algo\n⚡ Todo rapidito - Con un clic, sin tanto rollo\n\n¿Qué se le ofrece, jefe?', getDefaultActions());
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
