/**
 * Napojeni na Shoptet. Zamerne jen kostra - bez klientskych udaju se nema smysl
 * tvarit, ze neco funguje. Kdyz tenant nema SHOPTET_API_TOKEN, kazda metoda
 * vyhodi jasnou chybu a agent to reknе zakaznikovi ("oveřím to a ozvu se") + tiket.
 *
 * Doporucene mapovani:
 *   getOrderStatus  -> GET /api/orders/{code}                (Shoptet API, orders)
 *   getTracking     -> GET /api/orders/{code} (field "shipping") nebo dopravce API
 *   getProductStock -> GET /api/products/code/{code} nebo /api/products (variants)
 *   createReturn    -> POST /api/orders/{code}/returns (nebo interni system)
 *   sendSMSorEmail  -> interni e-mail/SMS brana e-shopu
 */
import { mask } from "../store.js";

const TOKEN = process.env.SHOPTET_API_TOKEN || "";
const BASE = process.env.SHOPTET_API_URL || "https://api.myshoptet.com/api";

function notConfigured(what) {
  return new Error(`Shoptet není nakonfigurovaný pro ${what}. Nastav SHOPTET_API_TOKEN a SHOPTET_API_URL.`);
}

async function request(path, init = {}) {
  if (!TOKEN) throw notConfigured(path);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Shoptet ${res.status} na ${path}`);
  return await res.json();
}

export const shoptetProvider = {
  name: "shoptet",

  async getOrder(orderId) {
    const data = await request(`/orders/${encodeURIComponent(orderId)}`);
    const o = data?.data || {};
    return {
      found: Boolean(o.code),
      orderId: String(o.code || orderId),
      state: o.status?.name || "neznámý stav",
      carrier: o.shipping?.name || null,
      tracking: o.shipping?.tracking_number || null,
      eta: o.shipping?.eta || null,
      total: Number(o.price?.withVat || 0),
      items: (o.items || []).map((i) => i.name).slice(0, 20),
    };
  },

  async getTracking(orderId) {
    const order = await this.getOrder(orderId);
    return {
      found: Boolean(order.tracking),
      carrier: order.carrier,
      tracking: order.tracking,
      lastEvent: order.state,
      url: null,
    };
  },

  async getProductStock({ query, size }) {
    const data = await request(`/products?search=${encodeURIComponent(query || "")}`);
    const product = (data?.data?.products || [])[0];
    if (!product) return { found: false };
    const stock = Number(product.stock || 0);
    return {
      found: true,
      name: product.name,
      size: size || null,
      sizeAvailable: true,
      inStock: stock > 0,
      quantity: stock,
      restockInDays: null,
    };
  },

  async createReturn({ orderId, reason, items }) {
    return await request(`/orders/${encodeURIComponent(orderId)}/returns`, {
      method: "POST",
      body: JSON.stringify({ reason, items }),
    });
  },

  async sendMessage({ channel, to }) {
    // Shoptet tyhle zpravy standardne neposila - napojte svoji e-mail/SMS branu.
    return { sent: false, channel: channel || "email", toMasked: mask(to) };
  },
};
