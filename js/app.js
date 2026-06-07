/* ============================================
   TUALI - Arca Continental
   App Logic + Ciclo de Vida del Micrófono
   ============================================ */

// ===== PRODUCTOS =====
const products = [
  { id: 1, name: 'Coca-Cola 600ml', category: 'refrescos', price: 189, unit: 'Pack x24', emoji: '🥤', promo: '-20%' },
  { id: 2, name: 'Coca-Cola 2L', category: 'refrescos', price: 245, unit: 'Pack x8', emoji: '🥤', promo: null },
  { id: 3, name: 'Coca-Cola Zero 600ml', category: 'refrescos', price: 195, unit: 'Pack x24', emoji: '🥤', promo: null },
  { id: 4, name: 'Fanta Naranja 600ml', category: 'refrescos', price: 175, unit: 'Pack x24', emoji: '🍊', promo: '-10%' },
  { id: 5, name: 'Sprite 600ml', category: 'refrescos', price: 175, unit: 'Pack x24', emoji: '🍋', promo: null },
  { id: 6, name: 'Fresca 600ml', category: 'refrescos', price: 170, unit: 'Pack x24', emoji: '🫧', promo: null },
  { id: 7, name: 'Ciel 1L', category: 'aguas', price: 96, unit: 'Pack x12', emoji: '💧', promo: null },
  { id: 8, name: 'Ciel 1.5L', category: 'aguas', price: 108, unit: 'Pack x12', emoji: '💧', promo: '-15%' },
  { id: 9, name: 'Ciel 500ml', category: 'aguas', price: 72, unit: 'Pack x24', emoji: '💧', promo: null },
  { id: 10, name: 'Ciel Mineralizada', category: 'aguas', price: 115, unit: 'Pack x12', emoji: '💧', promo: null },
  { id: 11, name: 'Del Valle Durazno 1L', category: 'jugos', price: 145, unit: 'Pack x6', emoji: '🧃', promo: '2x1' },
  { id: 12, name: 'Del Valle Manzana 1L', category: 'jugos', price: 145, unit: 'Pack x6', emoji: '🧃', promo: null },
  { id: 13, name: 'Del Valle Naranja 500ml', category: 'jugos', price: 89, unit: 'Pack x12', emoji: '🧃', promo: null },
  { id: 14, name: 'Fuze Tea Limon 600ml', category: 'jugos', price: 165, unit: 'Pack x12', emoji: '🍵', promo: null },
  { id: 15, name: 'Bokados Papas Clasicas', category: 'snacks', price: 85, unit: 'Display x12', emoji: '🍪', promo: '-25%' },
  { id: 16, name: 'Bokados Chicharron', category: 'snacks', price: 92, unit: 'Display x12', emoji: '🍪', promo: null },
  { id: 17, name: 'Bokados Cacahuates', category: 'snacks', price: 78, unit: 'Display x15', emoji: '🥜', promo: null },
  { id: 18, name: 'Bokados Palomitas', category: 'snacks', price: 65, unit: 'Display x12', emoji: '🍿', promo: null },
  { id: 19, name: 'Monster Energy', category: 'energeticas', price: 320, unit: 'Pack x12', emoji: '⚡', promo: null },
  { id: 20, name: 'Monster Ultra', category: 'energeticas', price: 335, unit: 'Pack x12', emoji: '⚡', promo: '-10%' },
  { id: 21, name: 'Powerade 600ml', category: 'energeticas', price: 198, unit: 'Pack x12', emoji: '🏃', promo: null },
  { id: 22, name: 'Coca-Cola 355ml Lata', category: 'refrescos', price: 168, unit: 'Pack x24', emoji: '🥫', promo: null },
  { id: 23, name: 'Sidral Mundet 600ml', category: 'refrescos', price: 180, unit: 'Pack x24', emoji: '🍎', promo: null },
  { id: 24, name: 'Topo Chico 600ml', category: 'aguas', price: 142, unit: 'Pack x12', emoji: '🫧', promo: 'Nuevo' },
];

// ===== ESTADO GLOBAL =====
let cart = [];
let currentPage = 'login';
let currentCategory = 'todos';

// ============================================================
// INICIALIZACIÓN DEL RECONOCIMIENTO DE VOZ Y MASCOTA
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    const mascota = document.getElementById("tuali-mascota-global");
    const bocadillo = document.getElementById("tuali-bocadillo");

    if (!mascota) return;

    // Inicialización del reconocimiento de voz nativo
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SpeechRecognition) {
        console.error("Entorno no compatible con SpeechRecognition.");
        return;
    }

    const receptorVoz = new SpeechRecognition();
    receptorVoz.lang = 'es-MX';
    receptorVoz.interimResults = false;
    receptorVoz.continuous = false; // Manejo manual para evitar desincronización de hardware

    let escuchaActiva = false;

    // Solicitud explícita y obligatoria de permisos de hardware al iniciar
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => console.log("Acceso al micrófono gestionado correctamente."))
        .catch(() => console.error("Permisos de audio denegados por el navegador."));

    // Ciclo de vida del micrófono
    receptorVoz.onstart = () => {
        mascota.classList.add("grabando-active");
        if (bocadillo) {
            bocadillo.style.display = "block";
            bocadillo.innerText = "Le escucho con atención de manera continua...";
        }
    };

    receptorVoz.onerror = (event) => {
        console.error("Incidencia en el hardware de audio: ", event.error);
    };

    receptorVoz.onend = () => {
        mascota.classList.remove("grabando-active");
        // REINICIO AUTOMÁTICO: Garantiza que el micrófono no se apague tras la primera frase
        if (escuchaActiva) {
            try {
                receptorVoz.start();
            } catch (e) {
                console.log("Reintento de conexión de audio en curso...");
            }
        }
    };

    receptorVoz.onresult = (event) => {
        const transcripcion = event.results[0][0].transcript;
        console.log("Entrada de voz procesada: ", transcripcion);

        // Envío directo al backend sin restricciones de formato para el usuario
        fetch('/api/tuali-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: transcripcion,
                mensaje: transcripcion,
                contexto_pantalla: document.body.dataset.screen || "inicio"
            })
        })
        .then(response => response.json())
        .then(data => {
            const respuesta = data.response || data.respuesta || "Solicitud procesada.";
            if (bocadillo) {
                bocadillo.style.display = "block";
                bocadillo.innerText = respuesta;
            }
            // Síntesis de voz para adultos mayores
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(respuesta.replace(/\*\*/g,''));
                utterance.lang = 'es-MX';
                utterance.rate = 0.9;
                window.speechSynthesis.speak(utterance);
            }
        })
        .catch(err => console.error("Error en la comunicación con el servidor:", err));
    };

    // Alternar el estado del micrófono con un solo clic sobre la mascota
    mascota.addEventListener("click", () => {
        if (!escuchaActiva) {
            escuchaActiva = true;
            try { receptorVoz.start(); } catch(e) { /* ya activo */ }
        } else {
            escuchaActiva = false;
            receptorVoz.stop();
            if (bocadillo) bocadillo.style.display = "none";
        }
    });

    // Login listeners
    document.getElementById('login-code')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doLogin();
    });
    document.getElementById('login-phone')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('login-code').focus();
    });
});

// ============================================================
// NAVEGACIÓN
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
    const mascota = document.getElementById('tuali-mascota-global');

    if (page === 'login') {
        bottomNav.style.display = 'none';
        if (mascota) mascota.style.display = 'none';
    } else if (page === 'carrito') {
        bottomNav.style.display = 'none';
        if (mascota) mascota.style.display = 'none';
    } else {
        bottomNav.style.display = 'flex';
        if (mascota) mascota.style.display = 'flex';
    }

    if (page === 'catalogo') renderProducts();
    if (page === 'carrito') renderCart();

    document.body.dataset.screen = page;
    currentPage = page;
}

function goBack() { navigateTo('catalogo'); }

// ===== LOGIN =====
function doLogin() {
    showToast('Bienvenido a Tuali');
    setTimeout(() => navigateTo('home'), 500);
}
function logout() { navigateTo('login'); cart = []; updateCartBadge(); }

// ===== PRODUCTOS =====
function renderProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = getFilteredProducts().map(p => `
        <div class="product-card"><${p.promo ? `<div class="product-promo-badge">${p.promo}</div>` : ''}
            <div class="product-card-img">${p.emoji}</div>
            <div class="product-card-name">${p.name}</div>
            <div class="product-card-unit">${p.unit}</div>
            <div class="product-card-price">$${p.price}</div>
            <div class="qty-control"><button class="qty-btn" onclick="updateProductQty(${p.id},-1)">−</button><span class="qty-value" id="qty-${p.id}">${getCartQty(p.id)}</span><button class="qty-btn" onclick="updateProductQty(${p.id},1)">+</button></div>
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
    else if (delta > 0) { const p = products.find(x => x.id === id); cart.push({...p, qty: 1}); }
    const el = document.getElementById(`qty-${id}`);
    if (el) el.textContent = getCartQty(id);
    updateCartBadge();
}

function addToCart(name) {
    const p = products.find(x => name.includes(x.name));
    if (p) updateProductQty(p.id, 1);
    else cart.push({ id: Date.now(), name, price: 189, qty: 1, emoji: '📦' });
    updateCartBadge();
    showToast('Agregado al carrito');
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
    showToast('Pedido confirmado. Se le notificará cuando salga a ruta.');
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
