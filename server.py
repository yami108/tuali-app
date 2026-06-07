"""
TUALI AI - Backend Server
Arca Continental - Asistente Inteligente para Tenderos
Flask + SQLite + Gemini API + OpenWeatherMap
"""

import os
import json
import sqlite3
import datetime
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# ===== CARGA DE VARIABLES DE ENTORNO CON DOTENV =====
try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print("✅ Archivo .env cargado correctamente.")
    else:
        print("⚠️  No se encontró archivo .env. Creando plantilla...")
        with open(env_path, 'w') as f:
            f.write("# TUALI AI - Variables de Entorno\n")
            f.write("# Reemplace estos valores con sus credenciales reales\n\n")
            f.write("GEMINI_API_KEY=TU_API_KEY_DE_GOOGLE_AI_STUDIO\n")
            f.write("OPENWEATHER_API_KEY=TU_API_KEY_DE_OPENWEATHERMAP\n")
        print("📄 Archivo .env creado. Configure sus API Keys antes de reiniciar.")
except ImportError:
    print("⚠️  python-dotenv no instalado. Ejecute: pip install python-dotenv")

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# ===== CONFIGURATION =====
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '')
PORT = int(os.environ.get("PORT", 5000))
DB_PATH = os.path.join(os.path.dirname(__file__), 'tuali.db')

# Validación de credenciales al arranque
GEMINI_STATUS = '✅ Activo' if GEMINI_API_KEY and GEMINI_API_KEY != 'TU_API_KEY_DE_GOOGLE_AI_STUDIO' else '❌ Sin API Key'
WEATHER_STATUS = '✅ Activo' if OPENWEATHER_API_KEY and OPENWEATHER_API_KEY != 'TU_API_KEY_DE_OPENWEATHERMAP' else '❌ Sin API Key'

SYSTEM_PROMPT = """Eres Tualito, el asistente virtual formal de Arca Continental. Tu lenguaje debe ser estrictamente institucional, profesional, claro y respetuoso en todo momento.

Reglas obligatorias de comunicación:
- Comunicación estrictamente formal, corporativa e institucional.
- Queda prohibido el uso de modismos mexicanos, expresiones coloquiales, jerga informal o vocabulario de confianza.
- Nunca tutees al usuario ni uses diminutivos informales.
- Trata al usuario de "usted" en todo momento.
- Responde siempre con brevedad, precisión profesional y cortesía institucional.

Reglas de procesamiento inteligente:
- Tu obligación es interpretar de manera autónoma cualquier expresión que el cliente utilice, sin importar qué tan informal o coloquial sea su lenguaje, y procesar la solicitud internamente.
- Nunca instruyas al usuario sobre cómo debe estructurar sus frases o pedidos.
- Cuando identifiques una solicitud de producto, confirma formalmente lo que entendiste y pregunta si requiere algo adicional antes de proceder.
- Cuando el usuario confirme, ejecuta la función registrar_pedido.

Reglas de contexto dinámico:
- PANTALLA ACTIVA: Adapta tu asistencia según la sección en la que se encuentra el usuario. Si está en Inicio, sugiera revisar productos por agotarse. Si está en Catálogo, recomiende productos estacionales. Si está en Carrito, confirme que el pedido esté completo. Si está en Pedidos, ofrezca seguimiento.
- HISTORIAL COMERCIAL: Utiliza la frecuencia de pedidos, productos más vendidos y categorías preferidas del cliente para sugerir abastecimiento oportuno y proactivo.
- CLIMA Y UBICACIÓN: Evalúa las condiciones climáticas actuales de la zona del tendero para recomendar productos de alta demanda estacional (hidratantes en calor, snacks en frío). Presenta estas recomendaciones de forma proactiva pero sin ser invasivo.

Formato de recomendaciones:
- Presenta las recomendaciones como sugerencias profesionales fundamentadas en datos.
- Indica brevemente el motivo de la recomendación (clima, zona, tendencia de ventas).
- Siempre pregunte al usuario si desea proceder con la acción sugerida.
"""

# ===== DATABASE INITIALIZATION =====
def init_db():
    """Inicializa la base de datos SQLite con el esquema corporativo."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS pedidos_tuali (
        id_registro INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id TEXT NOT NULL,
        pais TEXT DEFAULT 'Mexico',
        id_businessun TEXT DEFAULT 'BU-MX-001',
        business_unit TEXT DEFAULT 'Arca Continental Mexico',
        cedis TEXT DEFAULT 'CEDIS CDMX Norte',
        fecha_pedido TEXT,
        fecha_entrega TEXT,
        status_final TEXT DEFAULT 'Pendiente',
        valor_pedido REAL DEFAULT 0,
        subtotal REAL DEFAULT 0,
        total REAL DEFAULT 0,
        confirmado_por_cliente INTEGER DEFAULT 0,
        productos_json TEXT DEFAULT '[]'
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS inventario_tienda (
        producto TEXT PRIMARY KEY,
        stock_actual INTEGER DEFAULT 0,
        ventas_por_dia REAL DEFAULT 0,
        dias_surtido_cedis INTEGER DEFAULT 2
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS entorno_tienda (
        customer_id TEXT PRIMARY KEY,
        direccion_fisica TEXT,
        zonificacion TEXT,
        latitud REAL DEFAULT 19.4326,
        longitud REAL DEFAULT -99.1332
    )''')

    # Insertar datos de ejemplo si las tablas están vacías
    c.execute("SELECT COUNT(*) FROM inventario_tienda")
    if c.fetchone()[0] == 0:
        sample_inventory = [
            ('Coca-Cola 600ml', 24, 8, 2),
            ('Coca-Cola 2L', 12, 3, 2),
            ('Coca-Cola Zero 600ml', 18, 2, 2),
            ('Fanta Naranja 600ml', 20, 4, 2),
            ('Sprite 600ml', 15, 3, 2),
            ('Fresca 600ml', 10, 2, 3),
            ('Ciel 1L', 30, 10, 2),
            ('Ciel 1.5L', 20, 5, 2),
            ('Ciel 500ml', 5, 12, 2),
            ('Ciel Mineralizada', 8, 2, 3),
            ('Del Valle Durazno 1L', 6, 4, 3),
            ('Del Valle Manzana 1L', 8, 3, 3),
            ('Del Valle Naranja 500ml', 10, 5, 2),
            ('Fuze Tea Limon 600ml', 12, 3, 2),
            ('Bokados Papas Clasicas', 15, 6, 3),
            ('Bokados Chicharron', 10, 3, 3),
            ('Bokados Cacahuates', 20, 4, 3),
            ('Bokados Palomitas', 8, 5, 3),
            ('Monster Energy', 6, 2, 3),
            ('Monster Ultra', 4, 1, 3),
            ('Powerade 600ml', 10, 3, 2),
            ('Coca-Cola 355ml Lata', 24, 5, 2),
            ('Sidral Mundet 600ml', 12, 2, 3),
            ('Topo Chico 600ml', 8, 4, 2),
        ]
        c.executemany(
            "INSERT INTO inventario_tienda (producto, stock_actual, ventas_por_dia, dias_surtido_cedis) VALUES (?,?,?,?)",
            sample_inventory
        )

    c.execute("SELECT COUNT(*) FROM entorno_tienda")
    if c.fetchone()[0] == 0:
        c.execute("""INSERT INTO entorno_tienda (customer_id, direccion_fisica, zonificacion, latitud, longitud)
                     VALUES ('AC-MX-48291', 'Av. Insurgentes Sur 1234, Col. Centro, CDMX',
                             'Escuela cercana (Kinder 200m, Primaria 350m), Parque Central 150m, Zona residencial',
                             19.4326, -99.1332)""")

    # Pedidos de ejemplo con uno pendiente de confirmación
    c.execute("SELECT COUNT(*) FROM pedidos_tuali")
    if c.fetchone()[0] == 0:
        sample_orders = [
            ('AC-MX-48291', 'Mexico', 'BU-MX-001', 'Arca Continental Mexico', 'CEDIS CDMX Norte',
             '2024-06-03', '2024-06-05', 'Entregado', 3240, 3085, 3240, 0,
             '[{"nombre":"Coca-Cola 600ml","qty":2},{"nombre":"Ciel 1L","qty":1}]'),
            ('AC-MX-48291', 'Mexico', 'BU-MX-001', 'Arca Continental Mexico', 'CEDIS CDMX Norte',
             '2024-05-27', '2024-05-29', 'Entregado', 4850, 4619, 4850, 1,
             '[{"nombre":"Coca-Cola 2L","qty":1},{"nombre":"Del Valle Durazno 1L","qty":1}]'),
            ('AC-MX-48291', 'Mexico', 'BU-MX-001', 'Arca Continental Mexico', 'CEDIS CDMX Norte',
             '2024-05-20', '2024-05-22', 'Entregado', 2680, 2552, 2680, 1,
             '[{"nombre":"Fanta Naranja 600ml","qty":2}]'),
        ]
        c.executemany(
            """INSERT INTO pedidos_tuali (customer_id, pais, id_businessun, business_unit, cedis,
               fecha_pedido, fecha_entrega, status_final, valor_pedido, subtotal, total,
               confirmado_por_cliente, productos_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            sample_orders
        )

    conn.commit()
    conn.close()


def get_db():
    """Obtiene conexión a la base de datos."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ===== WEATHER SERVICE =====
# Coordenadas por defecto: Durango, México (24.0277, -104.6532)
DURANGO_LAT = 24.0277
DURANGO_LON = -104.6532

def get_weather(lat=None, lon=None):
    """
    Obtiene clima actual de OpenWeatherMap.
    Fallback estructurado con datos climáticos de Durango, México si la API falla.
    """
    lat = lat or DURANGO_LAT
    lon = lon or DURANGO_LON

    if not OPENWEATHER_API_KEY or OPENWEATHER_API_KEY == 'TU_API_KEY_DE_OPENWEATHERMAP':
        # Fallback con datos climáticos estimados de Durango según la época del año
        mes = datetime.datetime.now().month
        if mes in [5, 6, 7, 8]:  # Verano - caluroso
            return {"temp": 34, "description": "cielo despejado", "humidity": 35, "source": "fallback_durango_verano"}
        elif mes in [11, 12, 1, 2]:  # Invierno - frío seco
            return {"temp": 14, "description": "parcialmente nublado", "humidity": 40, "source": "fallback_durango_invierno"}
        else:  # Primavera/Otoño - templado
            return {"temp": 25, "description": "cielo despejado", "humidity": 45, "source": "fallback_durango_templado"}

    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric&lang=es"
        resp = requests.get(url, timeout=5)
        if resp.status_code != 200:
            raise Exception(f"HTTP {resp.status_code}")
        data = resp.json()
        return {
            "temp": round(data['main']['temp']),
            "description": data['weather'][0]['description'],
            "humidity": data['main']['humidity'],
            "source": "openweathermap"
        }
    except Exception as e:
        print(f"⚠️ Error obteniendo clima: {e}. Usando fallback de Durango.")
        mes = datetime.datetime.now().month
        if mes in [5, 6, 7, 8]:
            return {"temp": 34, "description": "cielo despejado", "humidity": 35, "source": "fallback_durango"}
        elif mes in [11, 12, 1, 2]:
            return {"temp": 14, "description": "parcialmente nublado", "humidity": 40, "source": "fallback_durango"}
        else:
            return {"temp": 25, "description": "cielo despejado", "humidity": 45, "source": "fallback_durango"}


# ===== GEMINI AI SERVICE =====
def call_gemini(user_message, context=""):
    """Llama a la API de Gemini 2.5 Flash con function calling y contexto dinámico completo."""
    if not GEMINI_API_KEY:
        return fallback_ai_response(user_message)

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

        # Obtener contexto completo de la tienda
        conn = get_db()
        entorno = conn.execute("SELECT * FROM entorno_tienda WHERE customer_id = 'AC-MX-48291'").fetchone()
        weather = get_weather(entorno['latitud'], entorno['longitud']) if entorno else get_weather()

        # Inventario bajo (desabasto predictivo)
        low_stock = conn.execute("""
            SELECT producto, stock_actual, ventas_por_dia, dias_surtido_cedis,
                   CAST(stock_actual AS REAL) / CASE WHEN ventas_por_dia > 0 THEN ventas_por_dia ELSE 1 END as dias_restantes
            FROM inventario_tienda
            WHERE CAST(stock_actual AS REAL) / CASE WHEN ventas_por_dia > 0 THEN ventas_por_dia ELSE 1 END <= dias_surtido_cedis
        """).fetchall()

        # Historial comercial del cliente
        historial = conn.execute("""
            SELECT productos_json, valor_pedido, fecha_pedido
            FROM pedidos_tuali
            WHERE customer_id = 'AC-MX-48291'
            ORDER BY fecha_pedido DESC LIMIT 5
        """).fetchall()
        conn.close()

        # Construir resumen de historial
        productos_frecuentes = {}
        for pedido in historial:
            try:
                items = json.loads(pedido['productos_json']) if pedido['productos_json'] else []
                for item in items:
                    nombre = item.get('nombre', '')
                    if nombre:
                        productos_frecuentes[nombre] = productos_frecuentes.get(nombre, 0) + 1
            except: pass
        
        top_productos = sorted(productos_frecuentes.items(), key=lambda x: x[1], reverse=True)[:5]
        historial_text = ', '.join([f"{p[0]} ({p[1]} pedidos)" for p in top_productos]) if top_productos else 'Sin historial suficiente'

        # Determinar pantalla activa
        pantalla_activa = context if context else 'inicio'
        pantalla_desc = {
            'inicio': 'Pantalla de Inicio - El usuario ve su dashboard general',
            'home': 'Pantalla de Inicio - El usuario ve su dashboard general',
            'catalogo': 'Catálogo de Productos - El usuario está buscando/seleccionando productos',
            'carrito': 'Carrito de Compras - El usuario está revisando su pedido antes de confirmar',
            'pedidos': 'Mis Pedidos - El usuario revisa el estado de sus entregas',
            'recompensas': 'Programa de Recompensas - El usuario consulta sus puntos',
            'perfil': 'Perfil de la Tienda - El usuario revisa información de su cuenta'
        }.get(pantalla_activa, 'Navegación general')

        context_msg = f"""
CONTEXTO DINÁMICO DE LA CONSULTA:

1. PANTALLA ACTIVA DEL USUARIO:
   - Sección: {pantalla_desc}

2. HISTORIAL COMERCIAL DEL CLIENTE:
   - Cliente: Tienda Don Carlos (AC-MX-48291)
   - Productos más pedidos: {historial_text}
   - Últimos {len(historial)} pedidos registrados en el sistema
   - Frecuencia de compra: Semanal (Lunes y Jueves)

3. VARIABLES DEL ENTORNO:
   - Ubicación: {entorno['zonificacion'] if entorno else 'Col. Centro, CDMX'}
   - Clima actual: {weather['temp']}°C, {weather['description']}, humedad {weather['humidity']}%
   - Zona comercial: Escuela cercana (200m), Primaria (350m), Parque (150m)

4. ESTADO DE INVENTARIO (Desabasto predictivo):
   - Productos críticos: {', '.join([f"{r['producto']} ({r['stock_actual']} unidades, ~{round(r['dias_restantes'],1)} días restantes)" for r in low_stock]) if low_stock else 'Todos los productos en nivel adecuado'}
   - Día de surtido CEDIS: Lunes y Jueves

INSTRUCCIÓN: Utiliza este contexto para generar recomendaciones proactivas, formales y fundamentadas en datos. No menciones explícitamente que estás usando estas variables; simplemente integra la información de manera natural en tu respuesta profesional.
"""

        payload = {
            "system_instruction": {"parts": [{"text": SYSTEM_PROMPT + context_msg}]},
            "contents": [{"parts": [{"text": user_message}]}],
            "tools": [{
                "function_declarations": [{
                    "name": "registrar_pedido",
                    "description": "Registra un nuevo pedido de productos para la tienda",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "productos": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "nombre": {"type": "string", "description": "Nombre del producto"},
                                        "cantidad": {"type": "integer", "description": "Cantidad de packs/displays"}
                                    },
                                    "required": ["nombre", "cantidad"]
                                },
                                "description": "Lista de productos a pedir"
                            }
                        },
                        "required": ["productos"]
                    }
                }]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 1024
            }
        }

        resp = requests.post(url, json=payload, timeout=30)
        result = resp.json()

        # Procesar respuesta
        if 'candidates' in result and len(result['candidates']) > 0:
            candidate = result['candidates'][0]
            parts = candidate.get('content', {}).get('parts', [])

            for part in parts:
                # Si Gemini quiere llamar una función
                if 'functionCall' in part:
                    func_call = part['functionCall']
                    if func_call['name'] == 'registrar_pedido':
                        productos = func_call['args'].get('productos', [])
                        order_result = registrar_pedido_arca(productos)
                        return {
                            "text": order_result['message'],
                            "action": "order_created",
                            "order_id": order_result.get('order_id'),
                            "productos": productos
                        }

                # Texto normal
                if 'text' in part:
                    return {"text": part['text'], "action": None}

        return fallback_ai_response(user_message)

    except Exception as e:
        print(f"Gemini error: {e}")
        return fallback_ai_response(user_message)


def fallback_ai_response(user_message):
    """Respuesta local cuando Gemini no está disponible."""
    msg = user_message.lower().strip()

    # Obtener contexto
    conn = get_db()
    weather = get_weather()

    low_stock = conn.execute("""
        SELECT producto, stock_actual, ventas_por_dia,
               CAST(stock_actual AS REAL) / CASE WHEN ventas_por_dia > 0 THEN ventas_por_dia ELSE 1 END as dias_restantes
        FROM inventario_tienda
        WHERE CAST(stock_actual AS REAL) / CASE WHEN ventas_por_dia > 0 THEN ventas_por_dia ELSE 1 END <= 3
        ORDER BY dias_restantes ASC LIMIT 5
    """).fetchall()
    conn.close()

    if any(w in msg for w in ['hola', 'buenos', 'buenas', 'hey']):
        greeting = f"¡Hola Don Carlos! 👋 Hoy está a {weather['temp']}°C y {weather['description']}."
        if weather['temp'] > 28:
            greeting += " Con este calor, las aguas y refrescos fríos se venden muy bien. 🥤❄️"
        elif weather['temp'] < 18:
            greeting += " Con este fresco, el café y las bebidas calientes son buena opción. ☕"
        greeting += "\n\n¿En qué te puedo ayudar hoy?"
        return {"text": greeting, "action": None}

    if any(w in msg for w in ['recomiend', 'sugier', 'zona', 'que se vende', 'consejo']):
        text = f"📍 **Recomendaciones para tu zona:**\n\n"
        text += f"🌡️ Clima: {weather['temp']}°C, {weather['description']}\n\n"
        if weather['temp'] > 28:
            text += "☀️ **Día caluroso** → Las aguas y refrescos fríos son los más buscados\n"
        text += "🏫 **Kinder cercano (200m)** → Jugos Del Valle se venden mucho a la hora de salida (12pm)\n"
        text += "🏫 **Primaria (350m)** → Snacks Bokados y agua Ciel 500ml para el recreo\n"
        text += "🌳 **Parque Central (150m)** → Powerade y agua para deportistas\n\n"
        if low_stock:
            text += "⚠️ **Ojo:** " + ", ".join([f"{r['producto']} te queda para ~{round(r['dias_restantes'],1)} días" for r in low_stock[:3]])
        return {"text": text, "action": None}

    if any(w in msg for w in ['inventario', 'stock', 'se acab', 'falta', 'queda']):
        if low_stock:
            text = "⚠️ **Productos con bajo inventario:**\n\n"
            for r in low_stock:
                text += f"• {r['producto']}: {r['stock_actual']} unidades (~{round(r['dias_restantes'],1)} días)\n"
            text += f"\n🚚 Próxima entrega CEDIS: Lunes\n\n¿Quieres que haga el pedido de reabastecimiento?"
        else:
            text = "✅ ¡Todo bien! Tu inventario está en niveles normales. 👍"
        return {"text": text, "action": None}

    if any(w in msg for w in ['pedir', 'pedido', 'comprar', 'ordenar', 'quiero', 'necesito', 'ocupo', 'encarga']):
        # Intentar detectar productos
        product_map = {
            'coca': 'Coca-Cola 600ml', 'fanta': 'Fanta Naranja 600ml', 'sprite': 'Sprite 600ml',
            'ciel': 'Ciel 1L', 'agua': 'Ciel 1L', 'topo': 'Topo Chico 600ml',
            'del valle': 'Del Valle Durazno 1L', 'jugo': 'Del Valle Durazno 1L',
            'monster': 'Monster Energy', 'powerade': 'Powerade 600ml',
            'bokados': 'Bokados Papas Clasicas', 'papas': 'Bokados Papas Clasicas',
            'mundet': 'Sidral Mundet 600ml'
        }
        found = []
        for key, product in product_map.items():
            if key in msg and product not in found:
                found.append(product)

        if found:
            productos = [{"nombre": p, "cantidad": 1} for p in found]
            result = registrar_pedido_arca(productos)
            return {
                "text": result['message'],
                "action": "order_created",
                "order_id": result.get('order_id'),
                "productos": productos
            }
        else:
            return {"text": "¡Con gusto! ¿Qué productos necesitas? Puedo ayudarte con refrescos, aguas, jugos, snacks o energéticas.", "action": None}

    if any(w in msg for w in ['sí', 'si', 'confirma', 'dale', 'acepto', 'ok']):
        return {"text": "¡Perfecto! ¿Hay algo más en lo que pueda ayudarte? 😊", "action": None}

    if any(w in msg for w in ['gracias', 'gracia']):
        return {"text": "¡De nada, Don Carlos! 😊 Aquí estoy siempre que me necesites. ¡Que tenga buenas ventas hoy! 💪", "action": None}

    if any(w in msg for w in ['clima', 'tiempo', 'temperatura', 'lluv', 'calor', 'frio']):
        text = f"🌡️ **Clima actual:** {weather['temp']}°C, {weather['description']}, humedad {weather['humidity']}%\n\n"
        if weather['temp'] > 30:
            text += "🔥 Día muy caluroso. ¡Los refrescos fríos y aguas se van a vender mucho!"
        elif weather['temp'] > 25:
            text += "☀️ Buen clima. Las bebidas frías tendrán buena demanda."
        elif weather['temp'] < 18:
            text += "🧥 Está fresco. Las bebidas calientes y snacks pueden ser buena opción."
        else:
            text += "🌤️ Temperatura agradable. Buen día para todo tipo de ventas."
        return {"text": text, "action": None}

    return {"text": "¿En qué te puedo ayudar? Puedo hacer pedidos, recomendarte productos según el clima y tu zona, o revisar tu inventario. También puedes hablarme por voz. 🎙️", "action": None}


def registrar_pedido_arca(productos):
    """Registra un pedido nuevo en la base de datos."""
    conn = get_db()

    # Calcular valor del pedido
    precios = {
        'Coca-Cola 600ml': 189, 'Coca-Cola 2L': 245, 'Coca-Cola Zero 600ml': 195,
        'Fanta Naranja 600ml': 175, 'Sprite 600ml': 175, 'Fresca 600ml': 170,
        'Ciel 1L': 96, 'Ciel 1.5L': 108, 'Ciel 500ml': 72, 'Ciel Mineralizada': 115,
        'Del Valle Durazno 1L': 145, 'Del Valle Manzana 1L': 145, 'Del Valle Naranja 500ml': 89,
        'Fuze Tea Limon 600ml': 165, 'Bokados Papas Clasicas': 85, 'Bokados Chicharron': 92,
        'Bokados Cacahuates': 78, 'Bokados Palomitas': 65, 'Monster Energy': 320,
        'Monster Ultra': 335, 'Powerade 600ml': 198, 'Coca-Cola 355ml Lata': 168,
        'Sidral Mundet 600ml': 180, 'Topo Chico 600ml': 142
    }

    total = 0
    product_list = []
    for item in productos:
        nombre = item['nombre']
        qty = item.get('cantidad', 1)
        precio = precios.get(nombre, 150)
        total += precio * qty
        product_list.append(f"{nombre} x{qty}")

    subtotal = round(total * 0.95, 2)
    fecha_pedido = datetime.datetime.now().strftime('%Y-%m-%d')
    # Próximo lunes o jueves
    today = datetime.datetime.now()
    days_ahead = (0 - today.weekday()) % 7  # Lunes
    if days_ahead == 0:
        days_ahead = 7
    fecha_entrega = (today + datetime.timedelta(days=days_ahead)).strftime('%Y-%m-%d')

    c = conn.cursor()
    c.execute("""INSERT INTO pedidos_tuali (customer_id, pais, id_businessun, business_unit, cedis,
                 fecha_pedido, fecha_entrega, status_final, valor_pedido, subtotal, total,
                 confirmado_por_cliente, productos_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
              ('AC-MX-48291', 'Mexico', 'BU-MX-001', 'Arca Continental Mexico', 'CEDIS CDMX Norte',
               fecha_pedido, fecha_entrega, 'Confirmado', total, subtotal, total, 0,
               json.dumps(productos, ensure_ascii=False)))
    order_id = c.lastrowid
    conn.commit()
    conn.close()

    product_text = "\n".join([f"• {p}" for p in product_list])
    message = f"🎉 **¡Pedido registrado exitosamente!**\n\n📦 Pedido #AC-{order_id}\n{product_text}\n\n💰 Total: ${total:,.0f}\n🚚 Entrega estimada: {fecha_entrega}\n\nTe notificaré cuando salga a ruta. ¿Necesitas algo más?"

    return {"message": message, "order_id": order_id, "total": total}


# ===== API ENDPOINTS =====

@app.route('/')
def serve_index():
    """Servir el index.html."""
    return send_from_directory('.', 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    """Servir archivos estáticos."""
    return send_from_directory('.', path)


@app.route('/api/alertas', methods=['GET'])
def get_alertas():
    """
    GET /api/alertas
    Retorna alertas de desabasto predictivo y entregas pendientes de confirmación.
    Fórmula: Días de Stock = stock_actual / ventas_por_dia
    Si Días de Stock <= dias_surtido_cedis → Alerta de reabastecimiento
    """
    conn = get_db()
    alertas = []

    # 1. Alertas de desabasto predictivo
    low_stock = conn.execute("""
        SELECT producto, stock_actual, ventas_por_dia, dias_surtido_cedis,
               CAST(stock_actual AS REAL) / CASE WHEN ventas_por_dia > 0 THEN ventas_por_dia ELSE 1 END as dias_restantes
        FROM inventario_tienda
        WHERE CAST(stock_actual AS REAL) / CASE WHEN ventas_por_dia > 0 THEN ventas_por_dia ELSE 1 END <= dias_surtido_cedis
        ORDER BY dias_restantes ASC
    """).fetchall()

    for item in low_stock:
        alertas.append({
            "tipo": "desabasto",
            "severidad": "alta" if item['dias_restantes'] <= 1 else "media",
            "producto": item['producto'],
            "stock_actual": item['stock_actual'],
            "dias_restantes": round(item['dias_restantes'], 1),
            "dias_surtido_cedis": item['dias_surtido_cedis'],
            "mensaje": f"⚠️ {item['producto']} se agotará en ~{round(item['dias_restantes'], 1)} días ({item['stock_actual']} unidades restantes)"
        })

    # 2. Alertas de seguridad (entregas no confirmadas)
    entregas_pendientes = conn.execute("""
        SELECT id_registro, fecha_entrega, valor_pedido, productos_json
        FROM pedidos_tuali
        WHERE status_final = 'Entregado' AND confirmado_por_cliente = 0
        ORDER BY fecha_entrega DESC
    """).fetchall()

    for entrega in entregas_pendientes:
        alertas.append({
            "tipo": "confirmacion_entrega",
            "severidad": "alta",
            "id_pedido": entrega['id_registro'],
            "fecha_entrega": entrega['fecha_entrega'],
            "valor": entrega['valor_pedido'],
            "productos": json.loads(entrega['productos_json']) if entrega['productos_json'] else [],
            "mensaje": f"🔔 ¿Recibió el pedido #AC-{entrega['id_registro']}? (${entrega['valor_pedido']:,.0f})"
        })

    # 3. Info del clima para recomendaciones
    weather = get_weather()

    conn.close()

    return jsonify({
        "alertas": alertas,
        "clima": weather,
        "timestamp": datetime.datetime.now().isoformat()
    })


@app.route('/api/tuali-chat', methods=['POST'])
def tuali_chat():
    """
    POST /api/tuali-chat
    Procesa la entrada del usuario con contexto dinámico completo.
    Capas: pantalla activa + historial comercial + clima/ubicación.
    """
    try:
        datos = request.get_json()
        mensaje_usuario = (datos.get('mensaje') or datos.get('message', '')).strip() if datos else ''
        estado = datos.get('estado', 'idle')
        carrito_temp = datos.get('carrito_temp', [])
        contexto_pantalla = datos.get('contexto_pantalla', 'inicio')

        if not mensaje_usuario:
            return jsonify({"response": "No detecté lo que dijiste. ¿Puedes repetirlo?", "respuesta": "No detecté lo que dijiste. ¿Puedes repetirlo?"})

        print(f"[Tualito] Entrada: '{mensaje_usuario}' | Estado: {estado} | Pantalla: {contexto_pantalla}")

        # Intentar Gemini primero si está configurado
        if GEMINI_API_KEY:
            gemini_resp = call_gemini(mensaje_usuario, contexto_pantalla)
            if gemini_resp and gemini_resp.get('text'):
                return jsonify({
                    "response": gemini_resp['text'],
                    "respuesta": gemini_resp['text'],
                    "action": gemini_resp.get('action'),
                    "productos_agregados": gemini_resp.get('productos'),
                    "estado": estado,
                    "timestamp": datetime.datetime.now().isoformat()
                })

        # === FALLBACK LOCAL INTELIGENTE ===
        msg = mensaje_usuario.lower()

        # Estado: esperando confirmación
        if estado == 'esperando_confirmacion':
            if any(w in msg for w in ['sí', 'si', 'dale', 'ok', 'confirma', 'acepto', 'va', 'sale']):
                return jsonify({
                    "response": f"✅ Pedido confirmado. Se agregaron {len(carrito_temp)} productos a tu carrito.",
                    "respuesta": f"✅ Pedido confirmado. Se agregaron {len(carrito_temp)} productos a tu carrito.",
                    "productos_agregados": carrito_temp,
                    "estado": "idle"
                })
            else:
                return jsonify({
                    "response": "Entendido, cancelé el pedido. ¿En qué más te ayudo?",
                    "respuesta": "Entendido, cancelé el pedido. ¿En qué más te ayudo?",
                    "estado": "idle"
                })

        # Estado: esperando más productos
        if estado == 'esperando_mas':
            if any(w in msg for w in ['no', 'ya', 'eso es todo', 'nada más', 'solo eso', 'listo']):
                total = len(carrito_temp)
                return jsonify({
                    "response": f"Tienes {total} producto(s) en el pedido. ¿Confirmo?",
                    "respuesta": f"Tienes {total} producto(s) en el pedido. ¿Confirmo?",
                    "estado": "esperando_confirmacion"
                })

        # Detectar productos en la frase
        product_map = {
            'coca': 'Coca-Cola 600ml', 'fanta': 'Fanta Naranja 600ml', 'sprite': 'Sprite 600ml',
            'ciel': 'Ciel 1L', 'agua': 'Ciel 1L', 'topo': 'Topo Chico 600ml',
            'del valle': 'Del Valle Durazno 1L', 'jugo': 'Del Valle Durazno 1L',
            'monster': 'Monster Energy', 'powerade': 'Powerade 600ml',
            'bokados': 'Bokados Papas Clasicas', 'papas': 'Bokados Papas Clasicas',
            'mundet': 'Sidral Mundet 600ml', 'palomitas': 'Bokados Palomitas',
            'cacahuate': 'Bokados Cacahuates', 'chicharron': 'Bokados Chicharron',
        }

        encontrados = []
        for key, product_name in product_map.items():
            if key in msg and product_name not in encontrados:
                encontrados.append(product_name)

        # Si pidió algo
        if any(w in msg for w in ['pedir', 'quiero', 'necesito', 'dame', 'ponme', 'manda', 'encarga', 'trae', 'surte']):
            if encontrados:
                lista = '\n'.join([f'• {p}' for p in encontrados])
                return jsonify({
                    "response": f"Entendido, te pongo:\n\n{lista}\n\n¿Vas a querer algo más o ya hago el pedido?",
                    "respuesta": f"Entendido, te pongo:\n\n{lista}\n\n¿Vas a querer algo más o ya hago el pedido?",
                    "productos_agregados": None,
                    "estado": "esperando_mas"
                })
            else:
                return jsonify({
                    "response": "¿Qué productos necesitas? Tengo refrescos, aguas, jugos, snacks y energéticas.",
                    "respuesta": "¿Qué productos necesitas? Tengo refrescos, aguas, jugos, snacks y energéticas.",
                    "estado": "esperando_mas"
                })

        # Si menciona productos sin verbo explícito (en estado esperando_mas)
        if encontrados and estado == 'esperando_mas':
            lista = '\n'.join([f'• {p}' for p in encontrados])
            return jsonify({
                "response": f"Agregué:\n{lista}\n\n¿Necesitas algo más o ya confirmo?",
                "respuesta": f"Agregué:\n{lista}\n\n¿Necesitas algo más o ya confirmo?",
                "estado": "esperando_mas"
            })

        # Recomendaciones - formal con contexto de clima y zona
        if any(w in msg for w in ['recomiend', 'sugier', 'zona', 'que se vende']):
            weather = get_weather()
            conn = get_db()
            entorno = conn.execute("SELECT * FROM entorno_tienda WHERE customer_id = 'AC-MX-48291'").fetchone()
            conn.close()

            text = f"Con base en el análisis de su entorno comercial, le presento las siguientes recomendaciones:\n\n"
            text += f"🌡️ Condiciones climáticas: {weather['temp']}°C, {weather['description']}\n\n"
            
            if weather['temp'] > 28:
                text += "📊 Dado el clima cálido actual, se proyecta un incremento en la demanda de productos hidratantes. Le sugiero reforzar su inventario de:\n"
                text += "• Agua Ciel (todas las presentaciones)\n• Coca-Cola 600ml\n• Powerade\n\n"
            elif weather['temp'] < 18:
                text += "📊 Con la temperatura actual, los productos de consumo rápido como snacks presentan mayor rotación. Le sugiero considerar:\n"
                text += "• Bokados (variedad completa)\n• Bebidas de menor volumen\n\n"
            
            text += "📍 Por su ubicación estratégica:\n"
            text += "• Institución educativa cercana (200m): Alta demanda de jugos Del Valle en horario de salida.\n"
            text += "• Escuela primaria (350m): Demanda constante de snacks Bokados y Ciel 500ml.\n"
            text += "• Parque recreativo (150m): Oportunidad en bebidas deportivas (Powerade) y agua.\n\n"
            text += "¿Desea que incorpore alguno de estos productos a su pedido?"
            return jsonify({"response": text, "respuesta": text, "estado": "idle"})

        # Inventario bajo
        if any(w in msg for w in ['inventario', 'stock', 'terminar', 'acabar', 'falta']):
            conn = get_db()
            low = conn.execute("""
                SELECT producto, stock_actual,
                       CAST(stock_actual AS REAL) / CASE WHEN ventas_por_dia > 0 THEN ventas_por_dia ELSE 1 END as dias
                FROM inventario_tienda
                WHERE CAST(stock_actual AS REAL) / CASE WHEN ventas_por_dia > 0 THEN ventas_por_dia ELSE 1 END <= 2
                ORDER BY dias ASC LIMIT 5
            """).fetchall()
            conn.close()

            if low:
                text = "⚠️ Productos por terminarse:\n\n"
                prods = []
                for r in low:
                    text += f"• {r['producto']}: {r['stock_actual']} unidades (~{round(r['dias'],1)} días)\n"
                    prods.append(r['producto'])
                text += "\n¿Hago el pedido de reabastecimiento?"
                return jsonify({"response": text, "respuesta": text, "estado": "esperando_confirmacion"})
            else:
                return jsonify({"response": "✅ Tu inventario está bien por ahora.", "respuesta": "✅ Tu inventario está bien por ahora.", "estado": "idle"})

        # Saludos - con contexto dinámico formal
        if any(w in msg for w in ['hola', 'buenos', 'buenas', 'hey']):
            weather = get_weather()
            saludo = "Bienvenido al servicio de asistencia Tualito de Arca Continental. "
            if contexto_pantalla == 'catalogo':
                saludo += f"Observo que se encuentra revisando el catálogo. Con la temperatura actual de {weather['temp']}°C ({weather['description']}), le sugiero considerar el abastecimiento de bebidas hidratantes y refrescos de alta rotación."
            elif contexto_pantalla == 'carrito':
                saludo += "Noto que está preparando un pedido. Estoy a su disposición para asegurar que su orden esté completa antes de la confirmación."
            elif contexto_pantalla in ['home', 'inicio']:
                saludo += f"La temperatura actual en su zona es de {weather['temp']}°C. Basándome en su historial, le informo que tiene productos próximos a agotarse. ¿Desea que le asista con el reabastecimiento?"
            else:
                saludo += "¿En qué puedo asistirle el día de hoy?"
            return jsonify({
                "response": saludo,
                "respuesta": saludo,
                "estado": "idle"
            })

        # Default
        return jsonify({
            "response": f"Recibí tu mensaje: '{mensaje_usuario}'. ¿Quieres que te ayude a hacer un pedido o ver recomendaciones?",
            "respuesta": f"Recibí tu mensaje: '{mensaje_usuario}'. ¿Quieres que te ayude a hacer un pedido o ver recomendaciones?",
            "estado": estado
        })

    except Exception as e:
        print(f"Error en el servidor: {str(e)}")
        return jsonify({
            "response": "Hubo un error. Intenta de nuevo.",
            "respuesta": "Hubo un error. Intenta de nuevo."
        })


@app.route('/api/confirmar-entrega', methods=['POST'])
def confirmar_entrega():
    """
    POST /api/confirmar-entrega
    Actualiza el estado de confirmación de una entrega.
    Body: { "id_pedido": 123, "confirmacion": 1 }
    confirmacion: 1 = Recibido OK, -1 = Reportar robo/faltante
    """
    data = request.get_json()
    if not data or 'id_pedido' not in data or 'confirmacion' not in data:
        return jsonify({"error": "Se requieren campos 'id_pedido' y 'confirmacion'"}), 400

    id_pedido = data['id_pedido']
    confirmacion = data['confirmacion']  # 1 = OK, -1 = Robo/Faltante

    if confirmacion not in [1, -1]:
        return jsonify({"error": "confirmacion debe ser 1 (OK) o -1 (Incidencia)"}), 400

    conn = get_db()
    c = conn.cursor()

    # Verificar que el pedido existe
    pedido = c.execute("SELECT * FROM pedidos_tuali WHERE id_registro = ?", (id_pedido,)).fetchone()
    if not pedido:
        conn.close()
        return jsonify({"error": f"Pedido #{id_pedido} no encontrado"}), 404

    # Actualizar confirmación
    if confirmacion == -1:
        c.execute("""UPDATE pedidos_tuali
                     SET confirmado_por_cliente = -1, status_final = 'Incidencia_Reportada'
                     WHERE id_registro = ?""", (id_pedido,))
        mensaje = f"🚨 Se reportó la incidencia del pedido #AC-{id_pedido}. Nuestro equipo de seguridad dará seguimiento. Te contactaremos en las próximas 24 horas."
    else:
        c.execute("""UPDATE pedidos_tuali
                     SET confirmado_por_cliente = 1
                     WHERE id_registro = ?""", (id_pedido,))
        mensaje = f"✅ ¡Gracias por confirmar la recepción del pedido #AC-{id_pedido}! +50 puntos Tuali ganados."

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "mensaje": mensaje,
        "id_pedido": id_pedido,
        "confirmacion": confirmacion
    })


@app.route('/api/inventario', methods=['GET'])
def get_inventario():
    """GET /api/inventario - Retorna todo el inventario de la tienda."""
    conn = get_db()
    items = conn.execute("""
        SELECT producto, stock_actual, ventas_por_dia, dias_surtido_cedis,
               CAST(stock_actual AS REAL) / CASE WHEN ventas_por_dia > 0 THEN ventas_por_dia ELSE 1 END as dias_restantes
        FROM inventario_tienda ORDER BY dias_restantes ASC
    """).fetchall()
    conn.close()

    return jsonify({
        "inventario": [dict(item) for item in items]
    })


# ===== MAIN =====
if __name__ == '__main__':
    init_db()
    port = PORT
    print(f"""
    ╔══════════════════════════════════════════╗
    ║   🤖 TUALI AI Server - Arca Continental  ║
    ║   Puerto: {port}                           ║
    ║   Gemini: {GEMINI_STATUS}                  ║
    ║   Clima:  {WEATHER_STATUS}                 ║
    ║   Región: Durango, México (fallback)     ║
    ╚══════════════════════════════════════════╝
    
    Abra http://localhost:{port} en su navegador.
    """)
    app.run(host='0.0.0.0', port=port, debug=True)
