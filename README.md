# 🤖 Tuali AI - Arca Continental

Asistente inteligente para tenderos del canal tradicional, con IA de Google Gemini.

## Funcionalidades

| Módulo | Descripción |
|--------|-------------|
| 🧠 Chat IA (Gemini) | Pedidos por texto/voz, respuestas inteligentes |
| 📊 Desabasto Predictivo | Predice cuándo se acabará cada producto |
| 🌤️ Variables de Clima | Ajusta recomendaciones según temperatura/lluvia |
| 📋 Auditoría de Entregas | Verifica discrepancias al recibir pedidos |
| 🎙️ Comandos de Voz | Pedir productos hablando |
| 📍 Recomendaciones por Zona | Sugiere según lugares cercanos (escuelas, parques) |

## Instalación

```bash
# 1. Clonar
git clone https://github.com/Yami108/tuali-app.git
cd tuali-app

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tu API key de Gemini

# 4. Poblar base de datos con datos de demo
npm run seed

# 5. Iniciar servidor
npm start
# → Servidor en http://localhost:3000
```

## API Keys necesarias

| Servicio | Cómo obtener | Obligatorio |
|----------|-------------|-------------|
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | ✅ Sí |
| OpenWeatherMap | [openweathermap.org/api](https://openweathermap.org/api) | ❌ Opcional |

## Endpoints del API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/ai/chat` | Chat con IA (Gemini + fallback local) |
| GET | `/api/predictive/alerts` | Alertas de desabasto |
| GET | `/api/predictive/recommendations` | Recomendaciones por zona |
| GET | `/api/predictive/suggested-order` | Pedido sugerido automático |
| POST | `/api/delivery/audit` | Registrar auditoría de entrega |
| GET | `/api/delivery/pending` | Próxima entrega pendiente |
| GET | `/api/weather/forecast` | Pronóstico del clima |
| GET | `/api/weather/recommendations` | Recomendaciones por clima |

## Arquitectura

```
tuali-app/
├── index.html              ← App principal (SPA)
├── css/
│   ├── styles.css          ← Diseño global
│   ├── pages.css           ← Estilos por pantalla
│   └── ai-assistant.css    ← Estilos del chat IA
├── js/
│   ├── app.js              ← Lógica de navegación/carrito
│   └── ai-assistant.js     ← Cliente del asistente IA
├── server/
│   ├── index.js            ← Express server
│   ├── db/
│   │   ├── init.js         ← Schema SQLite
│   │   └── seed.js         ← Datos de demo
│   ├── routes/
│   │   ├── ai.js           ← Endpoints de chat
│   │   ├── predictive.js   ← Endpoints predictivos
│   │   ├── delivery.js     ← Endpoints de entregas
│   │   └── weather.js      ← Endpoints de clima
│   └── services/
│       ├── gemini.js       ← Integración Google Gemini
│       ├── predictive.js   ← Lógica de desabasto
│       ├── delivery.js     ← Lógica de auditoría
│       └── weather.js      ← Lógica de clima
├── package.json
├── .env.example
└── .gitignore
```

## Modo Demo (sin backend)

La app funciona en modo estático desde GitHub Pages con respuestas locales (sin Gemini).
Para la experiencia completa con IA real, ejecutar el backend localmente.

🌐 Demo: https://yami108.github.io/tuali-app/
