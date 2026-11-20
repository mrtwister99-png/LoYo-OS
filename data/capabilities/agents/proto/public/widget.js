(function () {
  if (window.__protoWidgetLoaded) return;
  window.__protoWidgetLoaded = true;

  const script = document.currentScript;
  const apiBase = (function () {
    try {
      return new URL(script.src, location.href).origin;
    } catch (e) {
      return "";
    }
  })();
  const tenantId = (script && script.dataset.tenant) || "demo";
  const storageKey = "proto_session_" + tenantId;

  let sessionId = "";
  try {
    sessionId = localStorage.getItem(storageKey) || "";
    if (!sessionId) {
      sessionId = "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(storageKey, sessionId);
    }
  } catch (e) {
    sessionId = "s_" + Math.random().toString(36).slice(2);
  }

  const host = document.createElement("div");
  host.setAttribute("data-proto", tenantId);
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const css = `
    :host, * { box-sizing: border-box; }
    .wrap { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .launcher { width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
      background: var(--proto-color, #f59e0b); color: #12151b; font-size: 24px;
      box-shadow: 0 8px 24px rgba(0,0,0,.28); display: grid; place-items: center; }
    .launcher:hover { transform: translateY(-1px); }
    .panel { position: absolute; right: 0; bottom: 72px; width: 360px; max-width: calc(100vw - 32px);
      height: 540px; max-height: calc(100vh - 120px); background: #12151b; color: #e8eaf0;
      border: 1px solid #2a2f3a; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;
      box-shadow: 0 24px 60px rgba(0,0,0,.45); }
    .panel[hidden] { display: none; }
    header { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #171a21;
      border-bottom: 1px solid #262a33; }
    header .who { flex: 1; min-width: 0; }
    header b { display: block; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    header small { color: #9aa3b2; font-size: 11px; }
    header .dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; display: inline-block; margin-right: 5px; }
    .close { background: transparent; border: none; color: #9aa3b2; font-size: 16px; cursor: pointer; padding: 4px 6px; }
    .close:hover { color: #fff; }
    .log { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .msg { max-width: 86%; padding: 10px 12px; border-radius: 14px; font-size: 13.5px; line-height: 1.45;
      white-space: pre-wrap; word-break: break-word; }
    .msg.bot { background: #1c212b; border: 1px solid #262c37; align-self: flex-start; border-top-left-radius: 4px; }
    .msg.user { background: var(--proto-color, #f59e0b); color: #12151b; align-self: flex-end; border-top-right-radius: 4px; font-weight: 500; }
    .msg.sys { background: transparent; border: 1px dashed #333a47; color: #9aa3b2; align-self: center; font-size: 12px; }
    .msg a { color: inherit; text-decoration: underline; }
    .typing { display: inline-flex; gap: 4px; align-items: center; }
    .typing i { width: 6px; height: 6px; border-radius: 50%; background: #9aa3b2; opacity: .5;
      animation: proto-blink 1.1s infinite; }
    .typing i:nth-child(2) { animation-delay: .18s; }
    .typing i:nth-child(3) { animation-delay: .36s; }
    @keyframes proto-blink { 0%, 80%, 100% { opacity: .25 } 40% { opacity: 1 } }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 14px 10px; }
    .chip { background: #1c212b; color: #cfd6e2; border: 1px solid #2f3644; border-radius: 999px;
      padding: 6px 10px; font-size: 12px; cursor: pointer; }
    .chip:hover { border-color: var(--proto-color, #f59e0b); color: #fff; }
    form { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #262a33; background: #171a21; }
    textarea { flex: 1; resize: none; border-radius: 10px; border: 1px solid #343a47; background: #0f1115;
      color: #fff; padding: 9px 11px; font: inherit; font-size: 13.5px; max-height: 96px; }
    textarea:focus { outline: none; border-color: var(--proto-color, #f59e0b); }
    form button { width: 40px; border-radius: 10px; border: none; cursor: pointer;
      background: var(--proto-color, #f59e0b); color: #12151b; font-size: 16px; }
    form button:disabled { opacity: .5; cursor: default; }
    footer { padding: 0 12px 8px; font-size: 10.5px; color: #6c7686; text-align: right; background: #171a21; }
    @media (max-width: 480px) {
      .wrap { right: 12px; bottom: 12px; }
      .panel { width: calc(100vw - 24px); height: calc(100vh - 110px); }
    }
  `;

  shadow.innerHTML = '<style>' + css + '</style>' + `
    <div class="wrap">
      <section class="panel" hidden>
        <header>
          <div class="who"><b class="name">Podpora</b><small><span class="dot"></span><span class="status">online</span></small></div>
          <button class="close" type="button" aria-label="Zavřít">✕</button>
        </header>
        <div class="log" role="log" aria-live="polite"></div>
        <div class="chips"></div>
        <form>
          <textarea rows="1" maxlength="900" placeholder="Napište dotaz…" aria-label="Zpráva"></textarea>
          <button type="submit" aria-label="Odeslat">➤</button>
        </form>
        <footer>Powered by <b>Proto</b></footer>
      </section>
      <button class="launcher" type="button" aria-label="Otevřít podporu">💬</button>
    </div>
  `;

  const panel = shadow.querySelector(".panel");
  const log = shadow.querySelector(".log");
  const chips = shadow.querySelector(".chips");
  const form = shadow.querySelector("form");
  const input = shadow.querySelector("textarea");
  const sendBtn = shadow.querySelector('form button');
  const launcher = shadow.querySelector(".launcher");
  const nameEl = shadow.querySelector(".name");

  let busy = false;
  let config = { name: "Podpora", greeting: "Dobrý den, jak vám mohu pomoci?", quickReplies: [], color: "#f59e0b" };

  function esc(text) {
    return String(text || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function linkify(escaped) {
    return escaped.replace(/(https?:\/\/[^\s<]+)/g, function (url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + "</a>";
    });
  }

  function add(role, text) {
    const div = document.createElement("div");
    div.className = "msg " + role;
    div.innerHTML = role === "user" ? esc(text) : linkify(esc(text));
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function addTyping() {
    const div = document.createElement("div");
    div.className = "msg bot";
    div.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function renderChips() {
    chips.innerHTML = "";
    (config.quickReplies || []).forEach(function (label) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = label;
      b.onclick = function () {
        send(label);
      };
      chips.appendChild(b);
    });
  }

  async function send(text) {
    const message = String(text || "").trim();
    if (!message || busy) return;
    busy = true;
    sendBtn.disabled = true;
    input.value = "";
    chips.innerHTML = "";
    add("user", message);
    const typing = addTyping();

    try {
      const res = await fetch(apiBase + "/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: tenantId, sessionId: sessionId, message: message }),
      });
      const data = await res.json().catch(function () { return {}; });
      typing.remove();
      if (!res.ok) {
        add("bot", data.message || "Omlouváme se, spojení se přerušilo. Zkuste to prosím znovu.");
      } else {
        add("bot", data.reply || "Ověřím to a hned se ozvu.");
        if (data.sessionId) {
          sessionId = data.sessionId;
          try { localStorage.setItem(storageKey, sessionId); } catch (e) {}
        }
      }
    } catch (e) {
      typing.remove();
      add("bot", "Omlouváme se, spojení se přerušilo. Zkuste to prosím znovu, nebo napište na e-mail podpory.");
    } finally {
      busy = false;
      sendBtn.disabled = false;
    }
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    send(input.value);
  });

  input.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      send(input.value);
    }
  });

  launcher.addEventListener("click", function () {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    if (willOpen) {
      if (!log.childElementCount) {
        add("bot", config.greeting);
        renderChips();
        add("sys", "Tohle je ukázka podpory. Napište „demo“ pro testovací objednávky.");
      }
      input.focus();
    }
  });

  shadow.querySelector(".close").addEventListener("click", function () {
    panel.hidden = true;
  });

  fetch(apiBase + "/api/config?tenant=" + encodeURIComponent(tenantId))
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      config = Object.assign(config, cfg);
      nameEl.textContent = config.name || "Podpora";
      shadow.host.style.setProperty("--proto-color", config.color || "#f59e0b");
      host.style.setProperty("--proto-color", config.color || "#f59e0b");
      renderChips();
    })
    .catch(function () {});
})();
