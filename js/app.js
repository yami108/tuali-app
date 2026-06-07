/* ============================================
   TUALI - App Logic
   ============================================ */

// ===== DATA =====
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

// ===== STATE =====
let cart = [];
let currentPage = 'login';
let currentCategory = 'todos';

// ===== NAVIGATION =====
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) targetPage.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const navItems = document.querySelectorAll('.nav-item');
  const pageIndex = ['home', 'catalogo', 'pedidos', 'recompensas', 'perfil'].indexOf(page);
  if (pageIndex >= 0 && navItems[pageIndex]) navItems[pageIndex].classList.add('active');

  const bottomNav = document.getElementById('bottom-nav');
  if (page === 'login' || page === 'carrito') {
    bottomNav.style.display = 'none';
  } else {
    bottomNav.style.display = 'flex';
  }

  if (page === 'catalogo') renderProducts();
  if (page === 'carrito') renderCart();
  currentPage = page;
}

function goBack() {
  navigateTo('catalogo');
}

// ===== LOGIN =====
function doLogin() {
  showToast('Bienvenido a Tuali! 🎉');
  setTimeout(() => navigateTo('home'), 500);
}

function logout() {
  navigateTo('login');
  cart = [];
  updateCartBadge();
  showToast('Sesion cerrada');
}

// ===== PRODUCTS =====
function renderProducts() {
  const grid = document.getElementById('products-grid');
  const productsToRender = getFilteredProducts();

  grid.innerHTML = productsToRender.map(product => `
    <div class="product-card" data-category="${product.category}">
      ${product.promo ? `<div class="product-promo-badge">${product.promo}</div>` : ''}
      <div class="product-card-img">${product.emoji}</div>
      <div class="product-card-name">${product.name}</div>
      <div class="product-card-unit">${product.unit}</div>
      <div class="product-card-price">$${product.price}</div>
      <div class="qty-control">
        <button class="qty-btn" onclick="updateProductQty(${product.id}, -1)">−</button>
        <span class="qty-value" id="qty-${product.id}">${getCartQty(product.id)}</span>
        <button class="qty-btn" onclick="updateProductQty(${product.id}, 1)">+</button>
      </div>
    </div>
  `).join('');
}

function getFilteredProducts() {
  let filtered = products;
  if (currentCategory !== 'todos') {
    filtered = filtered.filter(p => p.category === currentCategory);
  }
  const searchTerm = document.getElementById('search-input')?.value?.toLowerCase() || '';
  if (searchTerm) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(searchTerm) ||
      p.category.toLowerCase().includes(searchTerm)
    );
  }
  return filtered;
}

function filterByCategory(category, element) {
  currentCategory = category;
  document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
  if (element) element.classList.add('active');
  renderProducts();
}

function filterProducts() {
  renderProducts();
}

// ===== CART =====
function getCartQty(productId) {
  const item = cart.find(i => i.id === productId);
  return item ? item.qty : 0;
}

function updateProductQty(productId, delta) {
  const existingItem = cart.find(i => i.id === productId);
  if (existingItem) {
    existingItem.qty += delta;
    if (existingItem.qty <= 0) cart = cart.filter(i => i.id !== productId);
  } else if (delta > 0) {
    const product = products.find(p => p.id === productId);
    cart.push({ ...product, qty: 1 });
  }
  const qtyEl = document.getElementById(`qty-${productId}`);
  if (qtyEl) qtyEl.textContent = getCartQty(productId);
  updateCartBadge();
}

function addToCart(productName) {
  const product = products.find(p => productName.includes(p.name));
  if (product) {
    updateProductQty(product.id, 1);
  } else {
    cart.push({ id: Date.now(), name: productName, price: 189, qty: 1, emoji: '📦' });
  }
  updateCartBadge();
  showToast('Agregado al carrito ✓');
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  renderCart();
  updateCartBadge();
}

function updateCartBadge() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById('cart-badge-header');
  if (badge) {
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
  }
}

function renderCart() {
  const cartItemsEl = document.getElementById('cart-items');
  const cartEmptyEl = document.getElementById('cart-empty');
  const cartSummaryEl = document.getElementById('cart-summary');

  if (cart.length === 0) {
    cartItemsEl.innerHTML = '';
    cartEmptyEl.style.display = 'block';
    cartSummaryEl.style.display = 'none';
    return;
  }

  cartEmptyEl.style.display = 'none';
  cartSummaryEl.style.display = 'block';

  cartItemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">${item.emoji || '📦'}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">$${item.price} x ${item.qty}</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="updateCartItemQty(${item.id}, -1)">−</button>
        <span class="qty-value">${item.qty}</span>
        <button class="qty-btn" onclick="updateCartItemQty(${item.id}, 1)">+</button>
      </div>
      <div class="cart-item-remove" onclick="removeFromCart(${item.id})">
        <i class="fas fa-trash"></i>
      </div>
    </div>
  `).join('');

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discount = Math.round(subtotal * 0.05);
  const total = subtotal - discount;

  document.getElementById('cart-subtotal').textContent = `$${subtotal.toLocaleString()}`;
  document.getElementById('cart-discount').textContent = `-$${discount.toLocaleString()}`;
  document.getElementById('cart-total').textContent = `$${total.toLocaleString()}`;
}

function updateCartItemQty(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(i => i.id !== productId);
  }
  renderCart();
  updateCartBadge();
}

function confirmOrder() {
  if (cart.length === 0) return;
  showToast('Pedido confirmado! 🎉 Te notificaremos cuando salga a ruta.');
  cart = [];
  updateCartBadge();
  setTimeout(() => navigateTo('pedidos'), 1500);
}

// ===== TOAST =====
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-code')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('login-phone')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('login-code').focus();
  });
});
