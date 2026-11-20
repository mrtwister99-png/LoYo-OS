export const demoProvider = {
  name: "demo",

  async getOrder(orderId) {
    const orders = {
      "2026001": {
        orderId: "2026001",
        state: "expedována",
        carrier: "PPL",
        tracking: "123456789",
        eta: "zítra",
        total: 2390,
        items: ["Tričko Basic černé", "Boty Runner 42"],
      },
      "2026002": {
        orderId: "2026002",
        state: "přijata, čeká na expedici",
        carrier: null,
        tracking: null,
        eta: null,
        total: 890,
        items: ["Mikina Premium"],
      },
      "2026003": {
        orderId: "2026003",
        state: "doručena",
        carrier: "Zásilkovna",
        tracking: "ZA998877",
        eta: "doručeno",
        total: 1290,
        items: ["Tričko Basic bílé"],
      },
    };
    const order = orders[String(orderId || "").trim()];
    if (!order) return { found: false, orderId: String(orderId || "") };
    return { found: true, ...order };
  },

  async getTracking(orderId) {
    const order = await this.getOrder(orderId);
    if (!order.found || !order.tracking) {
      return { found: false, tracking: null, url: null, status: order.found ? "bez tracking čísla" : null };
    }
    const urls = {
      PPL: `https://www.ppl.cz/vyhledani-zasilky?cislo=${order.tracking}`,
      "Zásilkovna": `https://www.zasilkovna.cz/vyhledavani?barcode=${order.tracking}`,
    };
    return {
      found: true,
      carrier: order.carrier,
      tracking: order.tracking,
      lastEvent: order.state,
      url: urls[order.carrier] || null,
    };
  },

  async getProductStock({ query, size }) {
    const products = [
      { name: "Tričko Basic černé", stock: 42, sizes: ["S", "M", "L", "XL"] },
      { name: "Boty Runner 42", stock: 2, sizes: ["42"] },
      { name: "Mikina Premium", stock: 0, sizes: ["S", "M", "L"], restockInDays: 5 },
    ];
    const q = String(query || "").toLowerCase().trim();
    if (!q) return { found: false };
    const tokens = q.split(/\s+/).filter(Boolean);
    const product = products.find((p) => tokens.every((t) => p.name.toLowerCase().includes(t)));
    if (!product) return { found: false };

    const sizeOk = !size || product.sizes.includes(String(size).toUpperCase());
    return {
      found: true,
      name: product.name,
      size: size || null,
      sizeAvailable: sizeOk,
      inStock: product.stock > 0 && sizeOk,
      quantity: product.stock,
      restockInDays: product.stock > 0 ? 0 : product.restockInDays ?? null,
    };
  },

  async createReturn({ orderId, reason, items }) {
    return { created: true, orderId: String(orderId || ""), reason: reason || "vrácení zboží", items: items || [] };
  },

  async sendMessage({ channel, to, template }) {
    return { sent: true, channel: channel || "email", to: to || null, template: template || "generic" };
  },
};
