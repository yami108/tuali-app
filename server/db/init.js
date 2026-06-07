/**
 * Inicialización de Base de Datos SQLite
 */

const path = require('path');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'tuali.db');

let db;

function getDB() {
  if (!db) {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function initDB() {
  const db = getDB();

  db.exec(`
    -- Productos del catálogo
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      unit TEXT,
      emoji TEXT,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      promo TEXT
    );

    -- Historial de ventas (para predicción)
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      quantity INTEGER,
      total REAL,
      date TEXT DEFAULT (datetime('now')),
      day_of_week INTEGER,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Pedidos realizados
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE,
      status TEXT DEFAULT 'pending',
      total REAL,
      items TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      estimated_delivery TEXT,
      delivered_at TEXT
    );

    -- Entregas y auditoría
    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      driver_name TEXT,
      expected_items TEXT,
      received_items TEXT,
      status TEXT DEFAULT 'pending',
      discrepancy TEXT,
      photo_url TEXT,
      notes TEXT,
      scheduled_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    -- Datos del clima
    CREATE TABLE IF NOT EXISTS weather (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      temp_max REAL,
      temp_min REAL,
      condition TEXT,
      humidity INTEGER,
      description TEXT,
      icon TEXT,
      fetched_at TEXT DEFAULT (datetime('now'))
    );

    -- Alertas de inventario
    CREATE TABLE IF NOT EXISTS inventory_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      current_stock INTEGER,
      predicted_demand INTEGER,
      urgency TEXT,
      message TEXT,
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Configuración de la tienda
    CREATE TABLE IF NOT EXISTS store_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Índices para rendimiento
    CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON inventory_alerts(resolved);
  `);

  console.log('[DB] Base de datos inicializada correctamente');
}

module.exports = { initDB, getDB };
