/**
 * Seed: Datos iniciales para demo
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { initDB, getDB } = require('./init');

initDB();
const db = getDB();

// Productos
const products = [
  { id: 1, name: 'Coca-Cola 600ml', category: 'refrescos', price: 189, unit: 'Pack x24', emoji: '🥤', stock: 3, min_stock: 8, promo: '-20%' },
  { id: 2, name: 'Coca-Cola 2L', category: 'refrescos', price: 245, unit: 'Pack x8', emoji: '🥤', stock: 12, min_stock: 5, promo: null },
  { id: 3, name: 'Coca-Cola Zero 600ml', category: 'refrescos', price: 195, unit: 'Pack x24', emoji: '🥤', stock: 8, min_stock: 5, promo: null },
  { id: 4, name: 'Fanta Naranja 600ml', category: 'refrescos', price: 175, unit: 'Pack x24', emoji: '🍊', stock: 15, min_stock: 6, promo: '-10%' },
  { id: 5, name: 'Sprite 600ml', category: 'refrescos', price: 175, unit: 'Pack x24', emoji: '🍋', stock: 10, min_stock: 5, promo: null },
  { id: 6, name: 'Fresca 600ml', category: 'refrescos', price: 170, unit: 'Pack x24', emoji: '🫧', stock: 7, min_stock: 4, promo: null },
  { id: 7, name: 'Ciel 1L', category: 'aguas', price: 96, unit: 'Pack x12', emoji: '💧', stock: 20, min_stock: 10, promo: null },
  { id: 8, name: 'Ciel 1.5L', category: 'aguas', price: 108, unit: 'Pack x12', emoji: '💧', stock: 2, min_stock: 8, promo: '-15%' },
  { id: 9, name: 'Ciel 500ml', category: 'aguas', price: 72, unit: 'Pack x24', emoji: '💧', stock: 25, min_stock: 12, promo: null },
  { id: 10, name: 'Ciel Mineralizada', category: 'aguas', price: 115, unit: 'Pack x12', emoji: '💧', stock: 6, min_stock: 4, promo: null },
  { id: 11, name: 'Del Valle Durazno 1L', category: 'jugos', price: 145, unit: 'Pack x6', emoji: '🧃', stock: 4, min_stock: 6, promo: '2x1' },
  { id: 12, name: 'Del Valle Manzana 1L', category: 'jugos', price: 145, unit: 'Pack x6', emoji: '🧃', stock: 5, min_stock: 6, promo: null },
  { id: 13, name: 'Del Valle Naranja 500ml', category: 'jugos', price: 89, unit: 'Pack x12', emoji: '🧃', stock: 9, min_stock: 5, promo: null },
  { id: 14, name: 'Fuze Tea Limon 600ml', category: 'jugos', price: 165, unit: 'Pack x12', emoji: '🍵', stock: 7, min_stock: 4, promo: null },
  { id: 15, name: 'Bokados Papas Clasicas', category: 'snacks', price: 85, unit: 'Display x12', emoji: '🍪', stock: 11, min_stock: 6, promo: '-25%' },
  { id: 16, name: 'Bokados Chicharron', category: 'snacks', price: 92, unit: 'Display x12', emoji: '🍪', stock: 8, min_stock: 5, promo: null },
  { id: 17, name: 'Bokados Cacahuates', category: 'snacks', price: 78, unit: 'Display x15', emoji: '🥜', stock: 14, min_stock: 7, promo: null },
  { id: 18, name: 'Bokados Palomitas', category: 'snacks', price: 65, unit: 'Display x12', emoji: '🍿', stock: 6, min_stock: 4, promo: null },
  { id: 19, name: 'Monster Energy', category: 'energeticas', price: 320, unit: 'Pack x12', emoji: '⚡', stock: 5, min_stock: 4, promo: null },
  { id: 20, name: 'Monster Ultra', category: 'energeticas', price: 335, unit: 'Pack x12', emoji: '⚡', stock: 3, min_stock: 4, promo: '-10%' },
  { id: 21, name: 'Powerade 600ml', category: 'energeticas', price: 198, unit: 'Pack x12', emoji: '🏃', stock: 9, min_stock: 5, promo: null },
  { id: 22, name: 'Coca-Cola 355ml Lata', category: 'refrescos', price: 168, unit: 'Pack x24', emoji: '🥫', stock: 10, min_stock: 6, promo: null },
  { id: 23, name: 'Sidral Mundet 600ml', category: 'refrescos', price: 180, unit: 'Pack x24', emoji: '🍎', stock: 7, min_stock: 5, promo: null },
  { id: 24, name: 'Topo Chico 600ml', category: 'aguas', price: 142, unit: 'Pack x12', emoji: '🫧', stock: 8, min_stock: 5, promo: 'Nuevo' },
];

const insertProduct = db.prepare(`
  INSERT OR REPLACE INTO products (id, name, category, price, unit, emoji, stock, min_stock, promo)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((items) => {
  for (const p of items) {
    insertProduct.run(p.id, p.name, p.category, p.price, p.unit, p.emoji, p.stock, p.min_stock, p.promo);
  }
});
insertMany(products);

// Ventas históricas simuladas (últimos 30 días)
const insertSale = db.prepare(`
  INSERT INTO sales (product_id, quantity, total, date, day_of_week) VALUES (?, ?, ?, ?, ?)
`);

const salesTransaction = db.transaction(() => {
  const now = new Date();
  for (let day = 0; day < 30; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().split('T')[0];
    const dow = date.getDay();

    // Simular ventas por producto con variación
    products.forEach(p => {
      let baseQty = Math.floor(Math.random() * 5) + 1;
      // Más ventas de agua en días calurosos (simulado)
      if (p.category === 'aguas' && dow >= 1 && dow <= 5) baseQty += 2;
      // Más jugos cerca del kinder entre semana
      if (p.category === 'jugos' && dow >= 1 && dow <= 5) baseQty += 3;
      // Más snacks en fin de semana
      if (p.category === 'snacks' && (dow === 0 || dow === 6)) baseQty += 2;

      if (Math.random() > 0.3) { // 70% de probabilidad de venta por día
        insertSale.run(p.id, baseQty, baseQty * p.price, dateStr, dow);
      }
    });
  }
});
salesTransaction();

// Pedidos históricos
const insertOrder = db.prepare(`
  INSERT INTO orders (order_number, status, total, items, created_at, estimated_delivery, delivered_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const orders = [
  { num: 'AC-2847', status: 'in_transit', total: 3240, items: JSON.stringify([{id:1,qty:2},{id:7,qty:1},{id:15,qty:1},{id:11,qty:1}]), created: '2024-06-05', delivery: '2024-06-10', delivered: null },
  { num: 'AC-2831', status: 'delivered', total: 4850, items: JSON.stringify([{id:2,qty:2},{id:11,qty:1},{id:15,qty:2}]), created: '2024-05-29', delivery: '2024-06-03', delivered: '2024-06-03' },
  { num: 'AC-2815', status: 'delivered', total: 2680, items: JSON.stringify([{id:4,qty:1},{id:9,qty:2}]), created: '2024-05-22', delivery: '2024-05-27', delivered: '2024-05-27' },
  { num: 'AC-2798', status: 'delivered', total: 5120, items: JSON.stringify([{id:1,qty:3},{id:19,qty:1}]), created: '2024-05-15', delivery: '2024-05-20', delivered: '2024-05-20' },
];

orders.forEach(o => insertOrder.run(o.num, o.status, o.total, o.items, o.created, o.delivery, o.delivered));

// Entregas con auditoría
const insertDelivery = db.prepare(`
  INSERT INTO deliveries (order_id, driver_name, expected_items, received_items, status, discrepancy, scheduled_at, completed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

insertDelivery.run(2, 'Carlos Méndez', JSON.stringify([{id:2,qty:2},{id:11,qty:1},{id:15,qty:2}]), JSON.stringify([{id:2,qty:2},{id:11,qty:1},{id:15,qty:2}]), 'completed', null, '2024-06-03 08:00', '2024-06-03 09:15');
insertDelivery.run(3, 'Luis Ramírez', JSON.stringify([{id:4,qty:1},{id:9,qty:2}]), JSON.stringify([{id:4,qty:1},{id:9,qty:1}]), 'completed', JSON.stringify({missing:[{id:9,qty:1}]}), '2024-05-27 08:00', '2024-05-27 10:30');

// Config de tienda
const insertConfig = db.prepare(`INSERT OR REPLACE INTO store_config (key, value) VALUES (?, ?)`);
insertConfig.run('store_name', 'Tienda Don Carlos');
insertConfig.run('store_zone', 'Col. Centro, CDMX');
insertConfig.run('store_lat', '19.4326');
insertConfig.run('store_lng', '-99.1332');
insertConfig.run('delivery_days', 'Lunes,Jueves');
insertConfig.run('nearby_kinder', 'Kinder Pequeños Genios (200m)');
insertConfig.run('nearby_school', 'Escuela Primaria Benito Juárez (350m)');
insertConfig.run('nearby_park', 'Parque Central (150m)');

console.log('[SEED] ✅ Base de datos poblada con datos de demo');
console.log(`  - ${products.length} productos`);
console.log(`  - ~${30 * products.length * 0.7} registros de ventas (30 días)`);
console.log(`  - ${orders.length} pedidos`);
console.log(`  - 2 entregas con auditoría`);
