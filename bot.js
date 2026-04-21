const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');



const fs = require('fs');

// Función que lee el prompt actualizado sin reiniciar el servidor
function obtenerPrompt() {
  try {
    const data = fs.readFileSync('config.json', 'utf8');
    return JSON.parse(data).systemPrompt;
  } catch (e) {
    return "Eres el asistente virtual de Webs Rápidas..."; // Prompt por defecto
  }
}



// ─── CONFIG ───────────────────────────────────────────────────────────────────
const OPENROUTER_API_KEY = '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'; // Reemplaza con tu key de openrouter.ai
const PORT = 3000;

const SYSTEM_PROMPT = `Eres el asistente virtual de ventas de "Respuesta de Redes", una empresa de servicios.
Tu nombre es Redes IA. Atiendes por WhatsApp de forma amigable, directa y profesional.

CATÁLOGO DE SERVICIOS:
- Producto 1: S/ 300
- Producto 2: S/ 400
- Producto 3: S/ 500

INSTRUCCIONES:
- Saluda con el nombre del cliente si lo conoces
- Responde siempre en español, de forma breve (máximo 3 líneas, como WhatsApp real)
- Si preguntan por precios, dáselos directamente sin rodeos
- Si el cliente quiere comprar, confirma el pedido y da instrucciones de pago:
  "Para pagar envía el monto por Yape al número 987-654-321 (Respuesta de Redes) y mándame el comprobante."
- Si compran 2 o más productos, ofrece 5% de descuento automáticamente
- Si el cliente tiene dudas o reclamos, sé empático y ofrece soluciones
- No inventes servicios ni precios que no están en el catálogo
- Cierra siempre con entusiasmo y disposición a ayudar`;

// ─── ESTADO EN MEMORIA ────────────────────────────────────────────────────────
const conversaciones = {}; // { numero: { nombre, mensajes:[], estado, ultimaVez } }
const ventas = [];          // { numero, nombre, producto, monto, fecha }

// ─── OPENROUTER ───────────────────────────────────────────────────────────────
async function generarRespuestaIA(numero, textoCliente) {
  if (!conversaciones[numero]) {
    conversaciones[numero] = { nombre: numero, mensajes: [], estado: 'nuevo', ultimaVez: Date.now() };
  }

  const conv = conversaciones[numero];
  conv.mensajes.push({ role: 'user', content: textoCliente });
  conv.ultimaVez = Date.now();

  const historial = conv.mensajes.slice(-20);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://respuestaderedes.com',
      'X-Title': 'Respuesta de Redes CRM',
    },
    body: JSON.stringify({
      model: 'inclusionai/ling-2.6-flash:free',
      messages: [
        { role: 'system', content: obtenerPrompt() },
        ...historial
      ],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const respuesta = data.choices[0].message.content;
  conv.mensajes.push({ role: 'assistant', content: respuesta });

  const textoLower = respuesta.toLowerCase();
  if (
    textoLower.includes('yape') &&
    (textoLower.includes('confirmado') || textoLower.includes('pedido') || textoLower.includes('pago'))
  ) {
    conv.estado = 'en_pago';
  }

  return respuesta;
}

// ─── WHATSAPP CLIENT ──────────────────────────────────────────────────────────
const wClient = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

wClient.on('qr', (qr) => {
  console.log('\n📱 Escanea este QR con tu WhatsApp:\n');
  qrcode.generate(qr, { small: true });
  io.emit('qr', qr);
});

wClient.on('ready', () => {
  console.log('✅ WhatsApp conectado! Bot activo.');
  io.emit('wa_status', 'conectado');
});

wClient.on('disconnected', () => {
  console.log('❌ WhatsApp desconectado.');
  io.emit('wa_status', 'desconectado');
});

wClient.on('message', async (msg) => {
  if (msg.isGroupMsg) return;
  if (msg.from === 'status@broadcast') return;

  const numero = msg.from.replace('@c.us', '').replace('@lid', '');
  const chatIdOriginal = msg.from; // guardamos el from original para responder
  const texto = msg.body;

  console.log(`📩 [${numero}]: ${texto}`);

  if (!conversaciones[numero]) {
    conversaciones[numero] = {
      nombre: msg._data?.notifyName || numero,
      mensajes: [],
      estado: 'nuevo',
      ultimaVez: Date.now(),
      chatId: chatIdOriginal,
    };
  } else {
    conversaciones[numero].nombre = msg._data?.notifyName || conversaciones[numero].nombre;
    conversaciones[numero].chatId = chatIdOriginal;
  }

  // Emitir al panel
  io.emit('nuevo_mensaje', {
    numero,
    nombre: conversaciones[numero].nombre,
    texto,
    de: 'cliente',
    hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
  });

  try {
    // Delay inicial aleatorio (entre 2 y 6 segundos) — simula que un humano leyó el mensaje
    const delayInicial = Math.floor(Math.random() * 4000) + 2000;
    await new Promise(r => setTimeout(r, delayInicial));

    // Generar respuesta con IA
    const respuesta = await generarRespuestaIA(numero, texto);

    // Mostrar "escribiendo..." por un tiempo proporcional al largo de la respuesta
    const chat = await wClient.getChatById(chatIdOriginal);
    await chat.sendStateTyping();
    const tipoEscribiendo = Math.min(Math.floor(respuesta.length * 40), 6000); // ~40ms por caracter, máx 6s
    await new Promise(r => setTimeout(r, tipoEscribiendo));
    await chat.clearState();

    // Enviar respuesta
    await msg.reply(respuesta);
    console.log(`🤖 [IA → ${numero}]: ${respuesta}`);

    // Emitir al panel
    io.emit('nuevo_mensaje', {
      numero,
      nombre: conversaciones[numero].nombre,
      texto: respuesta,
      de: 'ia',
      hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    });
  } catch (err) {
    console.error('Error IA:', err.message);
  }
});

// ─── EXPRESS + SOCKET.IO ──────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API: obtener todas las conversaciones
app.get('/api/conversaciones', (req, res) => {
  const lista = Object.entries(conversaciones).map(([numero, conv]) => ({
    numero,
    nombre: conv.nombre,
    estado: conv.estado,
    ultimaVez: conv.ultimaVez,
    ultimoMsg: conv.mensajes[conv.mensajes.length - 1]?.content || '',
    totalMensajes: conv.mensajes.length,
  }));
  res.json(lista.sort((a, b) => b.ultimaVez - a.ultimaVez));
});

// API: obtener mensajes de una conversación
app.get('/api/conversacion/:numero', (req, res) => {
  const conv = conversaciones[req.params.numero];
  if (!conv) return res.json({ mensajes: [], nombre: req.params.numero });
  res.json({ mensajes: conv.mensajes, nombre: conv.nombre, estado: conv.estado });
});

// API: agente envía mensaje manual
app.post('/api/enviar', async (req, res) => {
  const { numero, texto } = req.body;
  try {
    const conv = conversaciones[numero];
    const chatId = conv?.chatId || numero + '@c.us';
    await wClient.sendMessage(chatId, texto);

    if (!conversaciones[numero]) {
      conversaciones[numero] = { nombre: numero, mensajes: [], estado: 'nuevo', ultimaVez: Date.now() };
    }
    conversaciones[numero].mensajes.push({ role: 'model', parts: [{ text: texto }] });

    io.emit('nuevo_mensaje', {
      numero,
      nombre: conversaciones[numero].nombre,
      texto,
      de: 'agente',
      hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    });

    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// API: botón IA del panel genera y envía respuesta
app.post('/api/ia-responde', async (req, res) => {
  const { numero } = req.body;
  if (!numero || !conversaciones[numero]) return res.json({ ok: false, error: 'Sin conversación' });
  try {
    const conv = conversaciones[numero];
    const lastUser = [...conv.mensajes].reverse().find(m => m.role === 'user');
    if (!lastUser) return res.json({ ok: false, error: 'Sin mensaje del cliente' });
    const textoCliente = lastUser.content;
    const respuesta = await generarRespuestaIA(numero, textoCliente);
    const chatId = conv?.chatId || numero + '@c.us';
    await wClient.sendMessage(chatId, respuesta);
    io.emit('nuevo_mensaje', {
      numero,
      nombre: conv.nombre,
      texto: respuesta,
      de: 'ia',
      hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    });
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// API: registrar venta manualmente
app.post('/api/venta', (req, res) => {
  const { numero, producto, monto } = req.body;
  const nombre = conversaciones[numero]?.nombre || numero;
  const venta = { numero, nombre, producto, monto: parseInt(monto), fecha: new Date().toISOString() };
  ventas.push(venta);
  if (conversaciones[numero]) conversaciones[numero].estado = 'cerrado';
  io.emit('nueva_venta', venta);
  res.json({ ok: true });
});

// API: estadísticas
app.get('/api/stats', (req, res) => {
  const hoy = new Date().toDateString();
  const ventasHoy = ventas.filter(v => new Date(v.fecha).toDateString() === hoy);
  res.json({
    totalConvs: Object.keys(conversaciones).length,
    ventasCerradas: ventas.length,
    ingresosTotal: ventas.reduce((s, v) => s + v.monto, 0),
    ventasHoy: ventasHoy.length,
    ingresosHoy: ventasHoy.reduce((s, v) => s + v.monto, 0),
  });
});

// ─── NUEVAS FUNCIONES PARA EL PANEL ──────────────────────────────────────────

// 1. Eliminar chat
app.delete('/api/eliminar-chat/:numero', (req, res) => {
  const { numero } = req.params;
  if (conversaciones[numero]) {
    delete conversaciones[numero];
    console.log(`✅ Chat ${numero} eliminado del servidor`);
    res.json({ ok: true });
  } else {
    res.status(404).json({ ok: false, error: 'Chat no encontrado' });
  }
});

// 2. Control IA (Activar/Desactivar)
// Nota: Para que esto sea real, necesitamos guardar el estado de la IA
// Agregaremos una propiedad 'iaHabilitada' a cada conversación
app.post('/api/configurar-ia', (req, res) => {
  const { numero, activo } = req.body;
  if (conversaciones[numero]) {
    conversaciones[numero].iaHabilitada = activo;
    console.log(`🤖 IA para ${numero} ahora está: ${activo ? 'ACTIVA' : 'APAGADA'}`);
    res.json({ ok: true });
  } else {
    res.json({ ok: false, error: 'Chat no encontrado' });
  }
});

app.post('/api/set-prompt', (req, res) => {
  const { prompt } = req.body;
  fs.writeFileSync('config.json', JSON.stringify({ systemPrompt: prompt }, null, 2));
  res.json({ ok: true });
});

app.get('/api/get-prompt', (req, res) => {
  res.json({ prompt: obtenerPrompt() });
});


// ─── LÓGICA DE CONTROL (Eliminar, IA y Config Prompt) ──────────────────────────

// 1. Eliminar chat
app.delete('/api/eliminar-chat/:numero', (req, res) => {
  const { numero } = req.params;
  if (conversaciones[numero]) {
    delete conversaciones[numero];
    res.json({ ok: true });
  } else {
    res.status(404).json({ ok: false });
  }
});

// 2. Control IA (Activar/Desactivar)
app.post('/api/configurar-ia', (req, res) => {
  const { numero, activo } = req.body;
  if (conversaciones[numero]) {
    conversaciones[numero].iaHabilitada = activo;
    res.json({ ok: true });
  } else {
    res.json({ ok: false });
  }
});

// 3. Configuración de Prompt (Webs Rápidas)
app.post('/api/set-prompt', (req, res) => {
  const { prompt } = req.body;
  fs.writeFileSync('config.json', JSON.stringify({ systemPrompt: prompt }, null, 2));
  res.json({ ok: true });
});

app.get('/api/get-prompt', (req, res) => {
  res.json({ prompt: obtenerPrompt() });
});

// ─── ARRANQUE ─────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 Panel CRM: http://localhost:${PORT}/panel.html`);
  console.log(`📡 API corriendo en puerto ${PORT}\n`);
});

wClient.initialize();
