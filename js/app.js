/* ============================================
   TUALI - Arca Continental
   App Logic + Micrófono + Chat Dedicado
   VERSIÓN LIMPIA - Sin duplicados ni conflictos
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
// INICIALIZACIÓN PRINCIPAL
// ============================================================
document.addEventListener("DOMContentLoaded", () => {

    // ===== REFERENCIAS DEL DOM =====
    const mascota = document.getElementById("tuali-mascota-global");
    const bocadillo = document.getElementById("tuali-bocadillo");
    const contenedorChat = document.getElementById("tuali-chat-container");
    const botonCerrarChat = document.getElementById("btn-cerrar-tuali-chat");
    const botonMicrofonoChat = document.getElementById("btn-tuali-microfono");
    const btnEnviarChat = document.getElementById("btn-tuali-enviar");
    const inputChat = document.getElementById("input-tuali-texto");

    // ===== RECONOCIMIENTO DE VOZ =====
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    let receptorVoz = null;
    let escuchaActiva = false;

    if (SpeechRecognition) {
        receptorVoz = new SpeechRecognition();
        receptorVoz.lang = 'es-MX';
        receptorVoz.interimResults = false;
        receptorVoz.continuous = false;

        // Solicitar permisos al iniciar
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(() => console.log("Acceso al micrófono autorizado."))
                .catch(() => console.error("Permisos de audio denegados."));
        }

        receptorVoz.onstart = () => {
            if (mascota) mascota.classList.add("grabando-active");
            if (botonMicrofonoChat) {
                botonMicrofonoChat.style.backgroundColor = "#28a745";
                botonMicrofonoChat.style.transform = "scale(1.05)";
            }
        };

        receptorVoz.onerror = (event) => {
            console.error("Error de audio:", event.error);
            if (event.error === 'not-allowed') {
                escuchaActiva = false;
                resetMicUI();
            }
        };

        receptorVoz.onend = () => {
            if (mascota) mascota.classList.remove("grabando-active");
            // Reinicio automático si escucha sigue activa
            if (escuchaActiva) {
                setTimeout(() => {
                    try { receptorVoz.start(); } catch(e) { /* retry */ }
                }, 300);
            } else {
                resetMicUI();
            }
        };

        receptorVoz.onresult = (event) => {
            const transcripcion = event.results[0][0].transcript;
            console.log("Voz capturada:", transcripcion);

            // Mostrar en bocadillo que está procesando
            if (bocadillo) {
                bocadillo.style.display = "block";
                bocadillo.innerText = "Procesando...";
            }

            // Enviar al backend
            fetch('/api/tuali-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: transcripcion, mensaje: transcripcion, contexto_pantalla: currentPage })
            })
            .then(res => res.json())
            .then(data => {
                const respuesta = data.response || data.respuesta || "Solicitud procesada.";

                // Mostrar respuesta en bocadillo (solo si el chat NO está abierto)
                if (contenedorChat && contenedorChat.style.display === "flex") {
                    // Chat abierto: insertar burbujas
                    agregarBurbujaChat('usuario', transcripcion);
                    agregarBurbujaChat('ai', respuesta);
                } else if (bocadillo) {
                    // Chat cerrado: mostrar en bocadillo
                    bocadillo.innerText = respuesta;
                    bocadillo.style.display = "block";
                    // Ocultar bocadillo después de 8 segundos
                    setTimeout(() => { bocadillo.style.display = "none"; }, 8000);
                }

                // Voz de respuesta
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance(respuesta.replace(/\*\*/g, ''));
                    u.lang = 'es-MX';
                    u.rate = 0.9;
                    window.speechSynthesis.speak(u);
                }
            })
            .catch(() => {
                if (bocadillo) {
                    bocadillo.innerText = "Error de conexión.";
                    setTimeout(() => { bocadillo.style.display = "none"; }, 3000);
                }
            });
        };
    }

    function resetMicUI() {
        if (botonMicrofonoChat) {
            botonMicrofonoChat.style.backgroundColor = "#e3120b";
            botonMicrofonoChat.style.transform = "scale(1)";
        }
    }

    function iniciarEscucha() {
        if (!receptorVoz) return;
        escuchaActiva = true;
        try { receptorVoz.start(); } catch(e) { /* ya activo */ }
    }

    function detenerEscucha() {
        escuchaActiva = false;
        if (receptorVoz) receptorVoz.stop();
        resetMicUI();
        if (mascota) mascota.classList.remove("grabando-active");
    }

    // ===== EVENTOS DE LA MASCOTA =====
    // Clic simple: NO abre el chat, solo toggle micrófono
    // Doble clic: Abre el chat dedicado (la mascota NO desaparece)
    let clickTimer = null;

    if (mascota) {
        mascota.addEventListener("click", (e) => {
            e.stopPropagation();
            // Esperar para distinguir clic simple de doble clic
            if (clickTimer) return; // Ya hay un timer, es doble clic
            clickTimer = setTimeout(() => {
                clickTimer = null;
                // CLIC SIMPLE: toggle micrófono
                if (!escuchaActiva) {
                    iniciarEscucha();
                } else {
                    detenerEscucha();
                    if (bocadillo) bocadillo.style.display = "none";
                }
            }, 300);
        });

        mascota.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            // Cancelar el timer del clic simple
            if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
            // DOBLE CLIC: Abrir chat dedicado. LA MASCOTA SE MANTIENE VISIBLE.
            detenerEscucha();
            if (bocadillo) bocadillo.style.display = "none";
            if (contenedorChat) contenedorChat.style.display = "flex";
        });
    }

    // ===== BOTÓN CERRAR CHAT =====
    if (botonCerrarChat) {
        botonCerrarChat.addEventListener("click", (e) => {
            e.stopPropagation();
            if (contenedorChat) contenedorChat.style.display = "none";
        });
    }

    // ===== BOTÓN MICRÓFONO DENTRO DEL CHAT =====
    if (botonMicrofonoChat) {
        botonMicrofonoChat.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!escuchaActiva) {
                iniciarEscucha();
            } else {
                detenerEscucha();
            }
        });
    }

    // ===== ENVIAR TEXTO EN EL CHAT =====
    if (btnEnviarChat) {
        btnEnviarChat.addEventListener("click", () => enviarMensajeChat());
    }
    if (inputChat) {
        inputChat.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') enviarMensajeChat();
        });
    }

    // ===== LOGIN =====
    document.getElementById('login-code')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doLogin();
    });
    document.getElementById('login-phone')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('login-code').focus();
    });
});

// ============================================================
// NAVEGACIÓN (la mascota SIEMPRE permanece visible excepto en login)
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
        // Mascota VISIBLE incluso en carrito
        if (mascota) mascota.style.display = 'flex';
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
    showToast('Pedido confirmado.');
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

// ============================================================
// CHAT DEDICADO
// ============================================================
function enviarMensajeChat() {
    const input = document.getElementById('input-tuali-texto');
    if (!input || !input.value.trim()) return;
    const texto = input.value.trim();
    input.value = '';

    agregarBurbujaChat('usuario', texto);

    fetch('/api/tuali-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: texto, mensaje: texto, contexto_pantalla: currentPage })
    })
    .then(res => res.json())
    .then(data => {
        const respuesta = data.response || data.respuesta || "Solicitud registrada.";
        agregarBurbujaChat('ai', respuesta);
    })
    .catch(() => {
        agregarBurbujaChat('ai', 'Error de conexión. Intente nuevamente.');
    });
}

function agregarBurbujaChat(tipo, texto) {
    const contenedor = document.getElementById('tuali-historial-chat');
    if (!contenedor) return;
    const burbuja = document.createElement('div');
    burbuja.style.cssText = tipo === 'ai'
        ? 'background-color:#f1f1f1;padding:10px;border-radius:8px;margin-bottom:10px;max-width:80%;line-height:1.4;'
        : 'background-color:#e3120b;color:white;padding:10px;border-radius:8px;margin-bottom:10px;max-width:80%;margin-left:auto;line-height:1.4;text-align:right;';
    burbuja.innerHTML = tipo === 'ai' ? `<strong>Tualito:</strong> ${texto}` : texto;
    contenedor.appendChild(burbuja);
    contenedor.scrollTop = contenedor.scrollHeight;
}
