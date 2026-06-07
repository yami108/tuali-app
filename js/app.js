/* ============================================
   TUALI - Arca Continental
   App completa + IA Tualito (Chat estilo ChatGPT)
   VERSIÓN LIMPIA FINAL
   ============================================ */

// ===== PRODUCTOS =====
const products = [
  { id: 1, name: 'Coca-Cola 600ml', category: 'refrescos', price: 189, unit: 'Pack x24', emoji: '🥤', promo: '-20%' },
  { id: 2, name: 'Coca-Cola 2L', category: 'refrescos', price: 245, unit: 'Pack x8', emoji: '🥤' },
  { id: 3, name: 'Coca-Cola Zero 600ml', category: 'refrescos', price: 195, unit: 'Pack x24', emoji: '🥤' },
  { id: 4, name: 'Fanta Naranja 600ml', category: 'refrescos', price: 175, unit: 'Pack x24', emoji: '🍊', promo: '-10%' },
  { id: 5, name: 'Sprite 600ml', category: 'refrescos', price: 175, unit: 'Pack x24', emoji: '🍋' },
  { id: 6, name: 'Fresca 600ml', category: 'refrescos', price: 170, unit: 'Pack x24', emoji: '🫧' },
  { id: 7, name: 'Ciel 1L', category: 'aguas', price: 96, unit: 'Pack x12', emoji: '💧' },
  { id: 8, name: 'Ciel 1.5L', category: 'aguas', price: 108, unit: 'Pack x12', emoji: '💧', promo: '-15%' },
  { id: 9, name: 'Ciel 500ml', category: 'aguas', price: 72, unit: 'Pack x24', emoji: '💧' },
  { id: 10, name: 'Ciel Mineralizada', category: 'aguas', price: 115, unit: 'Pack x12', emoji: '💧' },
  { id: 11, name: 'Del Valle Durazno 1L', category: 'jugos', price: 145, unit: 'Pack x6', emoji: '🧃', promo: '2x1' },
  { id: 12, name: 'Del Valle Manzana 1L', category: 'jugos', price: 145, unit: 'Pack x6', emoji: '🧃' },
  { id: 13, name: 'Del Valle Naranja 500ml', category: 'jugos', price: 89, unit: 'Pack x12', emoji: '🧃' },
  { id: 14, name: 'Fuze Tea Limon 600ml', category: 'jugos', price: 165, unit: 'Pack x12', emoji: '🍵' },
  { id: 15, name: 'Bokados Papas Clasicas', category: 'snacks', price: 85, unit: 'Display x12', emoji: '🍪', promo: '-25%' },
  { id: 16, name: 'Bokados Chicharron', category: 'snacks', price: 92, unit: 'Display x12', emoji: '🍪' },
  { id: 17, name: 'Bokados Cacahuates', category: 'snacks', price: 78, unit: 'Display x15', emoji: '🥜' },
  { id: 18, name: 'Bokados Palomitas', category: 'snacks', price: 65, unit: 'Display x12', emoji: '🍿' },
  { id: 19, name: 'Monster Energy', category: 'energeticas', price: 320, unit: 'Pack x12', emoji: '⚡' },
  { id: 20, name: 'Monster Ultra', category: 'energeticas', price: 335, unit: 'Pack x12', emoji: '⚡', promo: '-10%' },
  { id: 21, name: 'Powerade 600ml', category: 'energeticas', price: 198, unit: 'Pack x12', emoji: '🏃' },
  { id: 22, name: 'Coca-Cola 355ml Lata', category: 'refrescos', price: 168, unit: 'Pack x24', emoji: '🥫' },
  { id: 23, name: 'Sidral Mundet 600ml', category: 'refrescos', price: 180, unit: 'Pack x24', emoji: '🍎' },
  { id: 24, name: 'Topo Chico 600ml', category: 'aguas', price: 142, unit: 'Pack x12', emoji: '🫧', promo: 'Nuevo' },
];

// Contexto de la tienda (para recomendaciones)
const tiendaInfo = {
  zona: 'Col. Centro, CDMX',
  cercanos: ['Kinder (200m)', 'Primaria (350m)', 'Parque (150m)'],
  productosBajos: ['Ciel 500ml', 'Coca-Cola 600ml'],
};

// ===== ESTADO GLOBAL =====
let cart = [];
let currentPage = 'login';
let currentCategory = 'todos';
let aiState = 'idle'; // idle | esperando_mas | esperando_confirmacion
let aiCarritoTemp = []; // Productos pendientes de confirmar

// ============================================================
// TUALITO CHAT - Abrir / Cerrar
// ============================================================
function abrirChat() {
  document.getElementById('tualito-chat').classList.add('abierto');
  document.getElementById('tualito-boton').style.display = 'none'; // Desaparece el botón
  // Mensaje de bienvenida solo la primera vez
  const msgs = document.getElementById('chat-mensajes');
  if (msgs.children.length === 0) {
    mensajeBienvenida();
  }
}

function cerrarChat() {
  document.getElementById('tualito-chat').classList.remove('abierto');
  // El botón reaparece
  if (currentPage !== 'login') {
    document.getElementById('tualito-boton').style.display = 'flex';
  }
}

function mensajeBienvenida() {
  let texto = '¡Hola! Soy Tualito, tu asistente de Arca Continental.\n\n';
  // Recomendaciones basadas en stock bajo
  if (tiendaInfo.productosBajos.length > 0) {
    texto += '📦 **Productos por terminarse:**\n';
    tiendaInfo.productosBajos.forEach(p => { texto += `• ${p}\n`; });
    texto += '\n¿Quieres que te haga un pedido de estos productos?\n\n';
  }
  texto += 'También puedo ayudarte a:\n• Hacer pedidos por voz o texto\n• Recomendarte productos según tu zona\n\n¿Qué necesitas?';
  
  agregarMsgAI(texto, [
    { label: '🛒 Pedir productos bajos', accion: 'pedir_bajos' },
    { label: '📊 Recomendaciones', accion: 'recomendaciones' },
  ]);
}

// ============================================================
// TUALITO CHAT - Enviar mensaje (texto o voz)
// ============================================================
function enviarTexto() {
  const input = document.getElementById('chat-input');
  const texto = input.value.trim();
  if (!texto) return;
  input.value = '';
  procesarMensaje(texto);
}

function procesarMensaje(texto) {
  agregarMsgUsuario(texto);
  
  // Intentar con backend primero
  fetch('/api/tuali-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: texto, mensaje: texto, contexto_pantalla: currentPage, estado: aiState, carrito_temp: aiCarritoTemp })
  })
  .then(r => r.json())
  .then(data => {
    const resp = data.response || data.respuesta;
    if (resp) {
      agregarMsgAI(resp);
      // Si el backend indica que agregó productos
      if (data.productos_agregados) {
        data.productos_agregados.forEach(p => addToCart(p));
      }
      if (data.estado) aiState = data.estado;
    } else {
      respuestaLocal(texto);
    }
  })
  .catch(() => {
    // Backend no disponible: respuesta local inteligente
    respuestaLocal(texto);
  });
}

// ============================================================
// RESPUESTA LOCAL (funciona sin backend)
// ============================================================
function respuestaLocal(texto) {
  const msg = texto.toLowerCase();

  // Estado: esperando confirmación de pedido
  if (aiState === 'esperando_confirmacion') {
    if (msg.match(/s[ií]|dale|ok|confirma|acepto|va|sale|arre/)) {
      aiCarritoTemp.forEach(nombre => addToCart(nombre));
      const total = aiCarritoTemp.length;
      aiCarritoTemp = [];
      aiState = 'idle';
      agregarMsgAI(`✅ ¡Listo! Agregué ${total} producto(s) a tu carrito. Tu pedido está preparado.`, [
        { label: '📦 Ver carrito', accion: 'ver_carrito' },
        { label: '🛒 Pedir más', accion: 'pedir_mas' },
      ]);
      return;
    }
    if (msg.match(/no|cancel|espera|todav/)) {
      aiCarritoTemp = [];
      aiState = 'idle';
      agregarMsgAI('Entendido, cancelé el pedido. ¿En qué más te puedo ayudar?');
      return;
    }
  }

  // Estado: esperando si quiere más productos
  if (aiState === 'esperando_mas') {
    if (msg.match(/no|ya|eso es todo|nada m[aá]s|solo eso|listo/)) {
      aiState = 'esperando_confirmacion';
      const lista = aiCarritoTemp.map(n => `• ${n}`).join('\n');
      const total = aiCarritoTemp.reduce((s, n) => {
        const p = products.find(x => x.name === n);
        return s + (p ? p.price : 150);
      }, 0);
      agregarMsgAI(`Tu pedido quedaría así:\n\n${lista}\n\n💰 Total estimado: $${total.toLocaleString()}\n\n¿Confirmo el pedido?`, [
        { label: '✅ Sí, confirmar', accion: 'confirmar_pedido' },
        { label: '❌ Cancelar', accion: 'cancelar_pedido' },
      ]);
      return;
    }
    // Si dice más productos, intentar encontrarlos
    const encontrados = buscarProductos(msg);
    if (encontrados.length > 0) {
      encontrados.forEach(p => aiCarritoTemp.push(p.name));
      const lista = encontrados.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
      agregarMsgAI(`Agregué:\n${lista}\n\n¿Necesitas algo más o ya hago el pedido?`, [
        { label: '✅ Ya es todo', accion: 'ya_es_todo' },
        { label: '➕ Quiero más', accion: 'quiero_mas' },
      ]);
      return;
    }
  }

  // Detectar intención de pedir
  if (msg.match(/pedir|quiero|necesito|ocupo|dame|ponme|manda|encarga|trae|surte|echale/)) {
    const encontrados = buscarProductos(msg);
    if (encontrados.length > 0) {
      aiCarritoTemp = encontrados.map(p => p.name);
      aiState = 'esperando_mas';
      const lista = encontrados.map(p => `${p.emoji} ${p.name} - $${p.price}`).join('\n');
      agregarMsgAI(`Entendido, pongo en tu carrito:\n\n${lista}\n\n¿Vas a querer algo más o ya hago el pedido?`, [
        { label: '✅ Ya es todo', accion: 'ya_es_todo' },
        { label: '➕ Quiero más', accion: 'quiero_mas' },
      ]);
      return;
    }
    aiState = 'esperando_mas';
    aiCarritoTemp = [];
    agregarMsgAI('¿Qué productos necesitas? Tengo refrescos, aguas, jugos, snacks y energéticas.');
    return;
  }

  // Recomendaciones
  if (msg.match(/recomiend|sugier|que se vende|zona|consejo/)) {
    agregarMsgAI(`📍 Recomendaciones para tu zona (${tiendaInfo.zona}):\n\n🏫 **Kinder cercano** → Jugos Del Valle se venden bien a la hora de salida\n🏫 **Primaria** → Snacks Bokados y Ciel 500ml para el recreo\n🌳 **Parque** → Powerade y agua para los que hacen ejercicio\n\n¿Quieres que agregue alguno de estos a tu pedido?`, [
      { label: '🧃 Jugos', accion: 'pedir_jugos' },
      { label: '🍪 Snacks', accion: 'pedir_snacks' },
      { label: '💧 Aguas', accion: 'pedir_aguas' },
    ]);
    return;
  }

  // Pedir productos bajos
  if (msg.match(/bajo|terminar|acabar|stock|inventario|falta/)) {
    hacerPedidoBajos();
    return;
  }

  // Saludos
  if (msg.match(/hola|buenos|buenas|hey|que tal/)) {
    agregarMsgAI('¡Hola! ¿En qué te puedo ayudar? Puedo hacerte pedidos, recomendarte productos o revisar tu inventario.');
    return;
  }

  // Gracias
  if (msg.match(/gracias|thanks/)) {
    agregarMsgAI('¡De nada! Aquí estoy cuando me necesites. 👍');
    return;
  }

  // Default
  agregarMsgAI('¿En qué te ayudo? Puedo:\n• Hacer pedidos (dime qué necesitas)\n• Recomendarte productos según tu zona\n• Revisar qué productos te faltan', [
    { label: '🛒 Hacer pedido', accion: 'hacer_pedido' },
    { label: '📊 Recomendaciones', accion: 'recomendaciones' },
  ]);
}

// ============================================================
// BUSCAR PRODUCTOS EN TEXTO
// ============================================================
function buscarProductos(texto) {
  const encontrados = [];
  const mapa = {
    'coca': 1, 'coca cola': 1, 'coca-cola': 1,
    'fanta': 4, 'sprite': 5, 'fresca': 6,
    'ciel': 7, 'agua': 7, 'topo chico': 24, 'topo': 24,
    'del valle': 11, 'jugo': 11, 'jugos': 11,
    'fuze': 14, 'te': 14,
    'bokados': 15, 'papas': 15, 'chicharron': 16, 'cacahuate': 17, 'palomitas': 18,
    'monster': 19, 'powerade': 21,
    'mundet': 23, 'sidral': 23,
    'coca zero': 3, 'zero': 3,
    'lata': 22,
  };
  
  const msg = texto.toLowerCase();
  Object.entries(mapa).forEach(([key, id]) => {
    if (msg.includes(key) && !encontrados.find(p => p.id === id)) {
      const prod = products.find(p => p.id === id);
      if (prod) encontrados.push(prod);
    }
  });
  return encontrados;
}

// ============================================================
// ACCIONES RÁPIDAS (botones del chat)
// ============================================================
function ejecutarAccion(accion) {
  switch(accion) {
    case 'pedir_bajos': hacerPedidoBajos(); break;
    case 'recomendaciones': procesarMensaje('Dame recomendaciones'); break;
    case 'confirmar_pedido': procesarMensaje('Sí, confirmar'); break;
    case 'cancelar_pedido': procesarMensaje('No, cancelar'); break;
    case 'ya_es_todo': procesarMensaje('Ya es todo'); break;
    case 'quiero_mas': agregarMsgAI('¿Qué más necesitas?'); aiState = 'esperando_mas'; break;
    case 'hacer_pedido': agregarMsgAI('¿Qué productos necesitas?'); aiState = 'esperando_mas'; aiCarritoTemp = []; break;
    case 'ver_carrito': cerrarChat(); navigateTo('carrito'); break;
    case 'pedir_mas': agregarMsgAI('¿Qué más te hace falta?'); aiState = 'esperando_mas'; aiCarritoTemp = []; break;
    case 'pedir_jugos':
      aiCarritoTemp = ['Del Valle Durazno 1L', 'Del Valle Manzana 1L', 'Del Valle Naranja 500ml'];
      aiState = 'esperando_confirmacion';
      agregarMsgAI('Te pongo los jugos:\n• Del Valle Durazno 1L\n• Del Valle Manzana 1L\n• Del Valle Naranja 500ml\n\n¿Confirmo?', [
        { label: '✅ Confirmar', accion: 'confirmar_pedido' },
        { label: '❌ No', accion: 'cancelar_pedido' },
      ]);
      break;
    case 'pedir_snacks':
      aiCarritoTemp = ['Bokados Papas Clasicas', 'Bokados Cacahuates', 'Bokados Palomitas'];
      aiState = 'esperando_confirmacion';
      agregarMsgAI('Te pongo snacks:\n• Bokados Papas\n• Bokados Cacahuates\n• Bokados Palomitas\n\n¿Confirmo?', [
        { label: '✅ Confirmar', accion: 'confirmar_pedido' },
        { label: '❌ No', accion: 'cancelar_pedido' },
      ]);
      break;
    case 'pedir_aguas':
      aiCarritoTemp = ['Ciel 500ml', 'Ciel 1L', 'Powerade 600ml'];
      aiState = 'esperando_confirmacion';
      agregarMsgAI('Te pongo aguas:\n• Ciel 500ml\n• Ciel 1L\n• Powerade 600ml\n\n¿Confirmo?', [
        { label: '✅ Confirmar', accion: 'confirmar_pedido' },
        { label: '❌ No', accion: 'cancelar_pedido' },
      ]);
      break;
  }
}

function hacerPedidoBajos() {
  aiCarritoTemp = [...tiendaInfo.productosBajos];
  aiState = 'esperando_confirmacion';
  const lista = aiCarritoTemp.map(n => `• ${n}`).join('\n');
  agregarMsgAI(`Estos productos están por terminarse:\n\n${lista}\n\n¿Hago el pedido de reabastecimiento?`, [
    { label: '✅ Sí, pedir', accion: 'confirmar_pedido' },
    { label: '❌ No por ahora', accion: 'cancelar_pedido' },
  ]);
}

// ============================================================
// RENDERIZAR MENSAJES EN EL CHAT
// ============================================================
function agregarMsgUsuario(texto) {
  const container = document.getElementById('chat-mensajes');
  const div = document.createElement('div');
  div.className = 'msg msg-user';
  div.textContent = texto;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function agregarMsgAI(texto, acciones = []) {
  const container = document.getElementById('chat-mensajes');
  const div = document.createElement('div');
  div.className = 'msg msg-ai';
  div.innerHTML = texto.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  
  if (acciones.length > 0) {
    const accionesDiv = document.createElement('div');
    accionesDiv.className = 'msg-acciones';
    acciones.forEach(a => {
      const btn = document.createElement('button');
      btn.className = 'msg-accion-btn';
      btn.textContent = a.label;
      btn.onclick = () => { accionesDiv.remove(); ejecutarAccion(a.accion); };
      accionesDiv.appendChild(btn);
    });
    div.appendChild(accionesDiv);
  }
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ============================================================
// MICRÓFONO (estilo ChatGPT)
// ============================================================
let micActivo = false;
let recognition = null;

function toggleMic() {
  const btn = document.getElementById('chat-btn-mic');
  
  if (!recognition) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { agregarMsgAI('Tu navegador no soporta reconocimiento de voz. Usa Chrome.'); return; }
    
    recognition = new SR();
    recognition.lang = 'es-MX';
    recognition.interimResults = true;
    recognition.continuous = true;
    
    recognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const texto = e.results[i][0].transcript.trim();
          if (texto) procesarMensaje(texto);
        }
      }
    };
    recognition.onend = () => {
      if (micActivo) {
        setTimeout(() => { try { recognition.start(); } catch(e){} }, 200);
      } else {
        btn.classList.remove('grabando');
      }
    };
    recognition.onerror = (e) => {
      console.log('Mic error:', e.error);
      if (e.error === 'not-allowed') {
        micActivo = false;
        btn.classList.remove('grabando');
        agregarMsgAI('Permite el acceso al micrófono. Haz clic en el candado de la barra de Chrome y activa "Micrófono".');
      }
    };
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => { stream.getTracks().forEach(t => t.stop()); })
        .catch(() => { agregarMsgAI('Permite el acceso al micrófono en tu navegador.'); });
    }
  }
  
  if (!micActivo) {
    micActivo = true;
    btn.classList.add('grabando');
    try { recognition.start(); } catch(e) {
      recognition.stop();
      setTimeout(() => { try { recognition.start(); } catch(e2){} }, 300);
    }
  } else {
    micActivo = false;
    btn.classList.remove('grabando');
    recognition.stop();
  }
}

// ============================================================
// NAVEGACIÓN DE LA APP
// ============================================================
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const navItems = document.querySelectorAll('.nav-item');
  const idx = ['home', 'catalogo', 'pedidos', 'recompensas', 'perfil'].indexOf(page);
  if (idx >= 0 && navItems[idx]) navItems[idx].classList.add('active');

  const bottomNav = document.getElementById('bottom-nav');
  const tualitoBtn = document.getElementById('tualito-boton');

  if (page === 'login') {
    bottomNav.style.display = 'none';
    if (tualitoBtn) tualitoBtn.style.display = 'none';
  } else if (page === 'carrito') {
    bottomNav.style.display = 'none';
    if (tualitoBtn) tualitoBtn.style.display = 'flex';
  } else {
    bottomNav.style.display = 'flex';
    if (tualitoBtn) tualitoBtn.style.display = 'flex';
  }

  if (page === 'catalogo') renderProducts();
  if (page === 'carrito') renderCart();
  currentPage = page;
}

function goBack() { navigateTo('catalogo'); }
function doLogin() { showToast('Bienvenido a Tuali'); setTimeout(() => navigateTo('home'), 500); }
function logout() { navigateTo('login'); cart = []; updateCartBadge(); }

// ===== PRODUCTOS =====
function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = getFilteredProducts().map(p => `
    <div class="product-card">
      ${p.promo ? `<div class="product-promo-badge">${p.promo}</div>` : ''}
      <div class="product-card-img">${p.emoji}</div>
      <div class="product-card-name">${p.name}</div>
      <div class="product-card-unit">${p.unit}</div>
      <div class="product-card-price">$${p.price}</div>
      <div class="qty-control">
        <button class="qty-btn" onclick="updateProductQty(${p.id},-1)">−</button>
        <span class="qty-value" id="qty-${p.id}">${getCartQty(p.id)}</span>
        <button class="qty-btn" onclick="updateProductQty(${p.id},1)">+</button>
      </div>
    </div>`).join('');
}

function getFilteredProducts() {
  let f = products;
  if (currentCategory !== 'todos') f = f.filter(p => p.category === currentCategory);
  const s = document.getElementById('search-input')?.value?.toLowerCase() || '';
  if (s) f = f.filter(p => p.name.toLowerCase().includes(s) || p.category.includes(s));
  return f;
}

function filterByCategory(cat, el) {
  currentCategory = cat;
  document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderProducts();
}
function filterProducts() { renderProducts(); }

// ===== CARRITO =====
function getCartQty(id) { const i = cart.find(x => x.id === id); return i ? i.qty : 0; }

function updateProductQty(id, delta) {
  const item = cart.find(x => x.id === id);
  if (item) { item.qty += delta; if (item.qty <= 0) cart = cart.filter(x => x.id !== id); }
  else if (delta > 0) { const p = products.find(x => x.id === id); if (p) cart.push({...p, qty: 1}); }
  const el = document.getElementById(`qty-${id}`);
  if (el) el.textContent = getCartQty(id);
  updateCartBadge();
}

function addToCart(name) {
  const p = products.find(x => name.includes(x.name));
  if (p) { updateProductQty(p.id, 1); }
  else { cart.push({ id: Date.now(), name, price: 150, qty: 1, emoji: '📦' }); updateCartBadge(); }
}

function removeFromCart(id) { cart = cart.filter(x => x.id !== id); renderCart(); updateCartBadge(); }

function updateCartBadge() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const b = document.getElementById('cart-badge-header');
  if (b) { b.textContent = total; b.style.display = total > 0 ? 'flex' : 'none'; }
}

function renderCart() {
  const items = document.getElementById('cart-items');
  const empty = document.getElementById('cart-empty');
  const summary = document.getElementById('cart-summary');
  if (!items) return;
  if (cart.length === 0) { items.innerHTML = ''; empty.style.display = 'block'; summary.style.display = 'none'; return; }
  empty.style.display = 'none'; summary.style.display = 'block';
  items.innerHTML = cart.map(i => `<div class="cart-item"><div class="cart-item-img">${i.emoji||'📦'}</div><div class="cart-item-info"><div class="cart-item-name">${i.name}</div><div class="cart-item-price">$${i.price} x ${i.qty}</div></div><div class="qty-control"><button class="qty-btn" onclick="updateCartItemQty(${i.id},-1)">−</button><span class="qty-value">${i.qty}</span><button class="qty-btn" onclick="updateCartItemQty(${i.id},1)">+</button></div><div class="cart-item-remove" onclick="removeFromCart(${i.id})"><i class="fas fa-trash"></i></div></div>`).join('');
  const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const disc = Math.round(sub * 0.05);
  document.getElementById('cart-subtotal').textContent = `$${sub.toLocaleString()}`;
  document.getElementById('cart-discount').textContent = `-$${disc.toLocaleString()}`;
  document.getElementById('cart-total').textContent = `$${(sub - disc).toLocaleString()}`;
}

function updateCartItemQty(id, delta) {
  const i = cart.find(x => x.id === id);
  if (i) { i.qty += delta; if (i.qty <= 0) cart = cart.filter(x => x.id !== id); }
  renderCart(); updateCartBadge();
}

function confirmOrder() {
  if (!cart.length) return;
  showToast('¡Pedido confirmado!');
  cart = []; updateCartBadge();
  setTimeout(() => navigateTo('pedidos'), 1500);
}

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-code')?.addEventListener('keypress', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('login-phone')?.addEventListener('keypress', e => { if (e.key === 'Enter') document.getElementById('login-code').focus(); });
});
