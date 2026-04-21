# Respuesta de Redes — CRM WhatsApp con IA
## Guía de instalación y uso

---

## Requisitos previos
- Node.js v18 o superior → https://nodejs.org
- Una cuenta de Anthropic con API Key → https://console.anthropic.com
- Google Chrome instalado (lo usa whatsapp-web.js internamente)

---

## Paso 1 — Instalar dependencias

Abre la terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
```

Esto instalará: whatsapp-web.js, express, socket.io, @anthropic-ai/sdk y qrcode-terminal.

---

## Paso 2 — Agregar tu API Key de Anthropic

Abre `bot.js` y reemplaza en la línea 9:

```js
const ANTHROPIC_API_KEY = 'TU_API_KEY_AQUI';
```

Por tu key real, que empieza con `sk-ant-...`

---

## Paso 3 — Arrancar el sistema

```bash
npm start
```

Verás en la terminal:
1. Un código QR grande
2. El mensaje: `Panel CRM: http://localhost:3000/panel.html`

---

## Paso 4 — Conectar WhatsApp

1. Abre WhatsApp en tu celular
2. Ve a **Ajustes → Dispositivos vinculados → Vincular dispositivo**
3. Escanea el QR que aparece en la terminal
4. Listo — verás "✅ WhatsApp conectado! Bot activo."

---

## Paso 5 — Abrir el panel CRM

Abre tu navegador y ve a:
```
http://localhost:3000/panel.html
```

Desde ahí podrás:
- Ver todas las conversaciones en tiempo real
- Leer y responder mensajes
- Usar los botones rápidos (catálogo, precios, instrucciones de pago)
- Pedirle a la IA que genere una respuesta con el botón "IA"
- Registrar ventas cerradas

---

## Cómo funciona el flujo automático

```
Cliente escribe → Bot recibe → IA genera respuesta → Bot responde automáticamente
                                                    → Panel CRM actualiza en tiempo real
```

La IA conoce:
- El nombre del negocio: Respuesta de Redes
- El catálogo: Producto 1 (S/300), Producto 2 (S/400), Producto 3 (S/500)
- El método de pago: Yape al 987-654-321
- Ofrece 5% de descuento en compras de 2+ productos

---

## Personalizar el bot

Para cambiar la forma en que responde la IA, edita el `SYSTEM_PROMPT` en `bot.js` (líneas 13-28).
Para cambiar el catálogo o número de Yape, busca esos valores en el mismo SYSTEM_PROMPT.

---

## Problemas comunes

| Problema | Solución |
|---|---|
| QR no aparece | Espera 10-15 segundos, a veces tarda |
| "Session closed" | Vuelve a escanear el QR |
| WhatsApp se desconecta | Ejecuta `npm start` de nuevo |
| Error de Puppeteer | Instala Chrome o Chromium |
| Error de API Key | Verifica que la key empiece con `sk-ant-` |

---

## Próximos pasos sugeridos

1. **Base de datos real** — agregar SQLite o PostgreSQL para persistir conversaciones
2. **Multi-agente** — agregar login por agente con roles
3. **WhatsApp Business API** — migrar a la API oficial de Meta para mayor estabilidad
4. **Dashboard de métricas** — gráficas de ventas por día/semana
5. **Notificaciones** — alerta cuando llega un mensaje nuevo

---

Creado con Claude para Respuesta de Redes.
