(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const app = $("#app");
  const BATCH = 48;

  // ---------- storage (fails silently in private mode) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("pu_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("pu_" + k, JSON.stringify(v)); } catch { /* ignore */ } }
  };

  // ---------- state ----------
  const browserLang = (navigator.language || "en").slice(0, 2);
  const S = {
    data: null,
    lang: store.get("lang", LANGS.some(l => l.code === browserLang) ? browserLang : "en"),
    cur: store.get("cur", browserLang === "pl" ? "PLN" : ["de", "fr", "it", "es", "nl", "pt", "el", "ro"].includes(browserLang) ? "EUR" : "USD"),
    rates: Object.assign({}, SITE.rates, store.get("rates", {}).r || {}),
    favs: new Set(store.get("favs", [])),
    group: "all", section: null, sort: "default", q: "",
    list: [], shown: 0, observer: null, mainHash: "#/", typingTimer: null
  };
  const T = () => Object.assign({}, I18N.en, I18N[S.lang] || {});
  const t = (k, vars) => { let s = T()[k] ?? k; if (vars) for (const v in vars) s = s.replace("{" + v + "}", vars[v]); return s; };
  const gname = id => (T().g || {})[id] || I18N.en.g[id] || id;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- icons ----------
  const I = {
    heart: '<svg viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    gem: '<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6M2 9h20"/></svg>',
    agent: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 9h6v6H9z"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/></svg>',
    box: '<svg viewBox="0 0 24 24"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>',
    ticket: '<svg viewBox="0 0 24 24"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
    coins: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    img: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/></svg>'
  };

  // ---------- money ----------
  const fmtCache = {};
  function money(usd, cur = S.cur) {
    if (usd == null) return "–";
    const v = usd * (S.rates[cur] || 1);
    const key = S.lang + cur;
    if (!fmtCache[key]) {
      try { fmtCache[key] = new Intl.NumberFormat(S.lang === "ar" ? "ar-u-nu-latn" : S.lang, { style: "currency", currency: cur, maximumFractionDigits: 2 }); }
      catch { fmtCache[key] = { format: x => cur + " " + x.toFixed(2) }; }
    }
    return fmtCache[key].format(v);
  }
  function stars(r) {
    if (r == null) return "";
    const n = Math.round(r / 2 * 2) / 2; let h = "";
    for (let i = 1; i <= 5; i++) h += n >= i ? "★" : n >= i - .5 ? '<span style="position:relative">★</span>' : '<span class="off">★</span>';
    return `<span class="stars" title="${r}/10">${h}</span>`;
  }
  async function loadRates() {
    const c = store.get("rates", null);
    if (c && Date.now() - c.t < 12 * 3600e3) return;
    try {
      const r = await fetch("https://open.er-api.com/v6/latest/USD");
      const j = await r.json();
      if (j && j.rates) {
        const keep = {}; SITE.currencies.forEach(c => { if (j.rates[c.code]) keep[c.code] = j.rates[c.code]; });
        Object.assign(S.rates, keep); store.set("rates", { t: Date.now(), r: keep });
        if (S.data) refreshPrices();
      }
    } catch { /* offline: use defaults */ }
  }
  function refreshPrices() {
    document.querySelectorAll("[data-usd]").forEach(el => { el.textContent = money(+el.dataset.usd); });
  }

  // ---------- data helpers ----------
  const P = id => S.data.products[id];
  const secOf = p => S.data.sections[p.s];
  const img = k => k ? `img/${k}.webp` : "";
  function productsFor(group, section) {
    const ps = S.data.products;
    if (section != null) return ps.filter(p => p.s === section);
    if (group === "all") return ps;
    return ps.filter(p => S.data.sections[p.s].g === group);
  }
  function applyFilters(arr) {
    let out = arr;
    if (S.q) {
      const toks = S.q.toLowerCase().split(/\s+/).filter(Boolean);
      out = out.filter(p => { const h = (p.n + " " + secOf(p).name + " " + (p.f || "")).toLowerCase(); return toks.every(x => h.includes(x)); });
    }
    const by = {
      asc: (a, b) => (a.p ?? 1e9) - (b.p ?? 1e9),
      desc: (a, b) => (b.p ?? -1) - (a.p ?? -1),
      rating: (a, b) => (b.r ?? -1) - (a.r ?? -1) || (a.p ?? 0) - (b.p ?? 0)
    }[S.sort];
    return by ? [...out].sort(by) : out;
  }

  // ---------- header ----------
  function renderCatBar() {
    const groups = S.data.groups.filter(g => S.data.sections.some(s => s.g === g.id && s.count));
    $("#catBar").innerHTML = `<button data-g="all" class="${S.group === "all" && !S.fav ? "active" : ""}">${esc(t("all"))}</button>` +
      groups.map(g => `<button data-g="${g.id}" class="${S.group === g.id ? "active" : ""}">${esc(gname(g.id))}</button>`).join("");
  }
  $("#catBar").addEventListener("click", e => {
    const b = e.target.closest("button[data-g]"); if (!b) return;
    location.hash = b.dataset.g === "all" ? "#/" : "#/c/" + b.dataset.g;
  });
  function setActiveNav(view) {
    document.querySelectorAll("#mainNav a").forEach(a => a.classList.toggle("active", a.dataset.view === view));
  }
  function updateFavBadge() {
    const b = $("#favCount"); b.textContent = S.favs.size; b.hidden = !S.favs.size;
  }
  function applyStaticI18n() {
    const L = LANGS.find(l => l.code === S.lang) || LANGS[1];
    document.documentElement.lang = S.lang;
    document.documentElement.dir = L.rtl ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  }

  // ---------- views ----------
  function heroHTML() {
    return `<section class="hero">
      <div>
        <p class="typing" id="typing"></p>
        <div class="features">
          <div class="feature"><span class="fi">${I.gem}</span><div><h3>${esc(t("f1t"))}</h3><p>${esc(t("f1d"))}</p></div></div>
          <div class="feature"><span class="fi">${I.agent}</span><div><h3>${esc(t("f2t"))}</h3><p>${esc(t("f2d"))}</p></div></div>
          <div class="feature"><span class="fi">${I.spark}</span><div><h3>${esc(t("f3t"))}</h3><p>${esc(t("f3d"))}</p></div></div>
        </div>
      </div>
      <div class="orbit" aria-hidden="true">
        <div class="core"><img src="assets/logo.png" alt=""></div>
        <span class="spark">✦</span>
        <span class="dot" style="left:-4px;top:110px"></span><span class="dot" style="right:-14px;top:150px;background:#5eead4"></span>
      </div>
    </section>`;
  }
  function startTyping() {
    clearTimeout(S.typingTimer);
    const el = $("#typing"); if (!el) return;
    const phrases = t("typing"); let pi = 0, ci = 0, del = false;
    const tick = () => {
      if (!el.isConnected) return;
      const ph = phrases[pi];
      ci += del ? -1 : 1; el.textContent = ph.slice(0, ci);
      let d = del ? 25 : 55;
      if (!del && ci >= ph.length) { del = true; d = 2200; }
      else if (del && ci <= 0) { del = false; pi = (pi + 1) % phrases.length; d = 400; }
      S.typingTimer = setTimeout(tick, d);
    };
    tick();
  }

  function cardHTML(p, i) {
    const fav = S.favs.has(p.u);
    const pills = (p.r != null ? `<span class="pill">${I.check}${esc(t("verified"))}</span>` : "") + (p.q ? `<span class="pill qc">${esc(t("qc"))}</span>` : "");
    return `<article class="card" style="animation-delay:${(i % BATCH) * 18}ms" data-id="${p.id}">
      <div class="media" data-open="${p.id}">
        <div class="ph">${I.heart}</div>
        ${p.i ? `<img src="${img(p.i)}" alt="${esc(p.n)}" loading="lazy" decoding="async" onload="this.classList.add('loaded')">` : ""}
        <div class="pills">${pills}</div>
      </div>
      <button class="heart ${fav ? "on" : ""}" data-fav="${p.id}" aria-label="${esc(t("favorites"))}">${I.heart}</button>
      <div class="body">
        <h3 class="name" data-open="${p.id}" title="${esc(p.n)}">${esc(p.n)}</h3>
        <div class="meta"><span class="price" data-usd="${p.p ?? ""}">${money(p.p)}</span>${stars(p.r)}</div>
      </div>
      <div class="actions">
        <button class="btn btn-ghost" data-open="${p.id}">${I.eye}${esc(t("details"))}</button>
        <a class="btn btn-light" href="${esc(p.u)}" target="_blank" rel="noopener nofollow">${I.bag}${esc(t("buy"))}</a>
      </div>
    </article>`;
  }

  function renderProducts({ hero = true, title, favs = false } = {}) {
    const base = favs ? S.data.products.filter(p => S.favs.has(p.u)) : productsFor(S.group, S.section);
    S.list = applyFilters(base);
    const groupSecs = (S.group !== "all" && !favs) ? S.data.sections.map((s, i) => ({ ...s, i })).filter(s => s.g === S.group && s.count) : [];
    const heading = title || (S.q ? `“${esc(S.q)}”` : S.group === "all" ? esc(t("allProducts")) : esc(gname(S.group)));
    const nCats = S.group === "all" ? S.data.sections.filter(s => s.count).length : groupSecs.length;
    app.innerHTML = `<div class="wrap">
      ${hero && !S.q ? heroHTML() : '<div style="height:36px"></div>'}
      <div class="list-head" id="list">
        <h1>${heading}</h1>
        <div class="counts">${esc(t("nProducts", { n: S.list.length.toLocaleString(S.lang) }))}${!favs && !S.q && nCats > 1 ? " · " + esc(t("nCategories", { n: nCats })) : ""}</div>
      </div>
      <div class="toolbar">
        <div class="chips">${groupSecs.length > 1 ? `<button class="chip ${S.section == null ? "active" : ""}" data-sec="">${esc(t("all"))}</button>` +
          groupSecs.map(s => `<button class="chip ${S.section === s.i ? "active" : ""}" data-sec="${s.i}">${esc(s.name)}<small>${s.count}</small></button>`).join("") : ""}</div>
        <select class="select" id="sortSel" aria-label="${esc(t("sort"))}">
          ${["default", "asc", "desc", "rating"].map(k => `<option value="${k}" ${S.sort === k ? "selected" : ""}>${esc(t({ default: "sDefault", asc: "sAsc", desc: "sDesc", rating: "sRating" }[k]))}</option>`).join("")}
        </select>
      </div>
      <div class="grid" id="grid"></div>
      ${S.list.length ? "" : `<div class="empty">${favs ? I.heart : I.search}<div>${esc(favs ? t("favEmpty") : t("noResults"))}</div></div>`}
      <div class="sentinel" id="sentinel"></div>
    </div>`;
    S.shown = 0; moreCards();
    if (S.observer) S.observer.disconnect();
    S.observer = new IntersectionObserver(es => { if (es[0].isIntersecting) moreCards(); }, { rootMargin: "1200px" });
    S.observer.observe($("#sentinel"));
    if (hero && !S.q) startTyping();
  }
  function moreCards() {
    if (S.shown >= S.list.length) return;
    const next = S.list.slice(S.shown, S.shown + BATCH);
    $("#grid").insertAdjacentHTML("beforeend", next.map((p, i) => cardHTML(p, S.shown + i)).join(""));
    S.shown += next.length;
  }

  function renderBrowse() {
    const d = S.data;
    const cover = si => { const p = d.products.find(p => p.s === si && p.i); return p ? img(p.i) : ""; };
    const groups = d.groups.filter(g => d.sections.some(s => s.g === g.id && s.count));
    app.innerHTML = `<div class="wrap">
      <div class="page-head"><h1 class="page-title">${esc(t("browseTitle"))}</h1><p>${esc(t("browseSub"))}</p></div>
      ${groups.map(g => {
        const secs = d.sections.map((s, i) => ({ ...s, i })).filter(s => s.g === g.id && s.count);
        return `<h2 class="group-title">${esc(gname(g.id))}</h2><div class="tiles">${secs.map(s => `
          <a class="tile" href="#/c/${g.id}/${s.i}">${cover(s.i) ? `<img src="${cover(s.i)}" alt="" loading="lazy">` : ""}
            <div class="lbl"><b>${esc(s.name)}</b><span>${esc(t("nProducts", { n: s.count }))}</span></div></a>`).join("")}</div>`;
      }).join("")}
    </div>`;
  }

  function renderTools() {
    app.innerHTML = `<div class="wrap">
      <div class="page-head"><h1 class="page-title">${esc(t("toolsTitle"))}</h1><p>${esc(t("toolsSub"))}</p></div>
      <div class="tools">
        <div class="tool wide"><h3><span class="fi">${I.box}</span>${esc(t("howTo"))}</h3>
          <ol class="steps">${t("steps").map(s => `<li>${esc(s)}</li>`).join("")}</ol>
          <div class="done">✓ ${esc(t("stepsDone"))}</div></div>
        <div class="tool"><h3><span class="fi">${I.ticket}</span>${esc(t("coupon"))}</h3><p>${esc(t("couponD"))}</p>
          <a class="btn btn-pink" href="${SITE.register}" target="_blank" rel="noopener">${esc(t("register"))}</a></div>
        <div class="tool"><h3><span class="fi">${I.truck}</span>${esc(t("tracking"))}</h3><p>${esc(t("trackingD"))}</p>
          <form class="field" id="trackForm"><input class="input" id="trackNo" placeholder="LP00…" autocomplete="off"><button class="btn btn-light">${esc(t("track"))}</button></form></div>
        <div class="tool"><h3><span class="fi">${I.coins}</span>${esc(t("converter"))}</h3>
          <div class="field"><input class="input" id="convIn" type="number" min="0" step="any" value="50"><select class="select" id="convFrom">${SITE.currencies.map(c => `<option ${c.code === "USD" ? "selected" : ""}>${c.code}</option>`).join("")}</select></div>
          <div class="field"><div class="conv-out" id="convOut"></div><select class="select" id="convTo" style="margin-left:auto">${SITE.currencies.map(c => `<option ${c.code === S.cur ? "selected" : ""}>${c.code}</option>`).join("")}</select></div></div>
        <div class="tool"><h3><span class="fi">${I.chat}</span>${esc(t("discord"))}</h3><p>${esc(t("discordD"))}</p>
          <a class="btn btn-light" href="${SITE.discord}" target="_blank" rel="noopener">Discord</a></div>
        <div class="tool"><h3><span class="fi">${I.users}</span>${esc(t("social"))}</h3>
          <div class="socials"><a class="btn btn-ghost" href="${SITE.tiktok}" target="_blank" rel="noopener">TikTok</a>
          <a class="btn btn-ghost" href="${SITE.links}">Links</a>
          <a class="btn btn-ghost" href="${SITE.discord}" target="_blank" rel="noopener">Discord</a></div></div>
      </div></div>`;
    const conv = () => {
      const v = parseFloat($("#convIn").value) || 0, f = $("#convFrom").value, to = $("#convTo").value;
      $("#convOut").textContent = money(v / (S.rates[f] || 1), to);
    };
    ["convIn", "convFrom", "convTo"].forEach(id => $("#" + id).addEventListener("input", conv)); conv();
    $("#trackForm").addEventListener("submit", e => {
      e.preventDefault(); const n = $("#trackNo").value.trim();
      window.open(SITE.tracking + encodeURIComponent(n), "_blank", "noopener");
    });
  }

  // ---------- product modal ----------
  function openProduct(id) {
    const p = P(id); if (!p) return;
    const sec = secOf(p); const m = $("#productModal");
    const pics = [p.i && { k: p.i, l: "" }, p.q && { k: p.q, l: "QC" }].filter(Boolean);
    m.innerHTML = `<div class="sheet pd" role="dialog" aria-modal="true" aria-label="${esc(p.n)}">
      <button class="close-x" data-close aria-label="${esc(t("close"))}">${I.x}</button>
      <div class="gallery">
        ${pics.length ? `<img class="main" id="pdMain" src="${img(pics[0].k)}" alt="${esc(p.n)}">` : `<div class="main ph" style="position:relative">${I.img}</div>`}
        ${pics.length > 1 ? `<div class="thumbs">${pics.map((x, i) => `<button class="${i ? "" : "active"}" data-pic="${x.k}"><img src="${img(x.k)}" alt="">${x.l ? `<span>${x.l}</span>` : ""}</button>`).join("")}</div>` : ""}
      </div>
      <div class="info">
        <div class="row"><a class="tag" href="#/c/${sec.g}/${p.s}">${esc(sec.name)}</a>${p.r != null ? `<span class="pill" style="position:static">${I.check}${esc(t("verified"))}</span>` : ""}${p.cw ? `<span class="tag">${esc(p.cw)}</span>` : ""}</div>
        <h2>${esc(p.n)}</h2>
        <div><span class="big-price" data-usd="${p.p ?? ""}">${money(p.p)}</span>${S.cur !== "USD" && p.p != null ? `<span class="usd">≈ ${money(p.p, "USD")}</span>` : ""}</div>
        ${p.r != null ? `<div class="row">${stars(p.r)}<span class="score">${p.r}/10</span><span class="muted">${esc(t("rating"))}</span></div>` : ""}
        ${p.f ? `<blockquote><small>${esc(t("feedback"))}</small>${esc(p.f)}</blockquote>` : ""}
        <p class="muted" style="font-size:12.5px;margin:0">${esc(t("priceNote"))}</p>
        <div class="cta">
          <a class="btn btn-pink" href="${esc(p.u)}" target="_blank" rel="noopener nofollow">${I.bag}${esc(t("buy"))}</a>
          <button class="btn btn-ghost" data-copy="${esc(p.u)}" aria-label="${esc(t("copy"))}" title="${esc(t("copy"))}">${I.link}</button>
          <button class="btn btn-ghost heart-btn ${S.favs.has(p.u) ? "on" : ""}" data-fav="${p.id}" aria-label="${esc(t("favorites"))}">${I.heart}</button>
        </div>
      </div></div>`;
    m.hidden = false; document.body.classList.add("lock");
    paintFav();
  }
  function closeProduct() {
    const m = $("#productModal"); if (m.hidden) return;
    m.hidden = true; m.innerHTML = ""; document.body.classList.remove("lock");
    if (location.hash.startsWith("#/p/")) history.replaceState(null, "", S.mainHash);
  }
  function paintFav() {
    document.querySelectorAll("[data-fav]").forEach(b => {
      const on = S.favs.has(P(+b.dataset.fav).u); b.classList.toggle("on", on);
      const s = b.querySelector("svg"); if (s) s.style.fill = on ? "currentColor" : "none";
      if (b.classList.contains("heart-btn")) b.style.color = on ? "var(--pink)" : "";
    });
    updateFavBadge();
  }

  // ---------- setup modal ----------
  function openSetup() {
    const m = $("#setupModal");
    const draw = () => {
      m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-top"><div class="mini-brand"><img src="assets/logo.png" alt="">Potato Unboxed</div><span class="kicker dot">${esc(t("personalize"))}</span></div>
        <div class="kicker" style="margin-top:18px">${esc(t("welcome"))}</div>
        <h2>${esc(t("setup"))}</h2>
        <div class="setup-cols">
          <div class="setup-box"><div class="bh"><span class="num">01</span><div><span class="kicker">${esc(t("language"))}</span><small>${esc(t("languageQ"))}</small></div></div>
            <div class="opts">${LANGS.map(l => `<button class="opt ${l.code === S.lang ? "active" : ""}" data-lang="${l.code}"><img src="https://flagcdn.com/w40/${l.flag}.png" alt="" loading="lazy" onerror="this.remove()"><span class="t"><span>${l.name}</span></span></button>`).join("")}</div></div>
          <div class="setup-box"><div class="bh"><span class="num">02</span><div><span class="kicker">${esc(t("currency"))}</span><small>${esc(t("currencyQ"))}</small></div></div>
            <div class="opts currency-opts">${SITE.currencies.map(c => `<button class="opt ${c.code === S.cur ? "active" : ""}" data-cur="${c.code}"><span class="cs">${c.sym}</span><span class="t"><span>${c.code}</span><small>${c.name}</small></span></button>`).join("")}</div></div>
        </div>
        <button class="btn btn-pink start" data-start>${esc(t("start"))} →</button>
      </div>`;
    };
    draw(); m.hidden = false; document.body.classList.add("lock");
    m.onclick = e => {
      const l = e.target.closest("[data-lang]"), c = e.target.closest("[data-cur]");
      if (l) { S.lang = l.dataset.lang; store.set("lang", S.lang); applyStaticI18n(); draw(); }
      else if (c) { S.cur = c.dataset.cur; store.set("cur", S.cur); draw(); }
      else if (e.target.closest("[data-start]") || e.target === m) {
        store.set("setupDone", true); m.hidden = true; document.body.classList.remove("lock");
        applyStaticI18n(); renderCatBar(); route();
      }
    };
  }

  // ---------- toast ----------
  let toastT;
  function toast(msg) { const el = $("#toast"); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 1800); }

  // ---------- global events ----------
  document.addEventListener("click", e => {
    const fav = e.target.closest("[data-fav]");
    if (fav) {
      e.preventDefault(); const u = P(+fav.dataset.fav).u;
      S.favs.has(u) ? S.favs.delete(u) : S.favs.add(u);
      store.set("favs", [...S.favs]); paintFav(); return;
    }
    const op = e.target.closest("[data-open]");
    if (op) { location.hash = "#/p/" + op.dataset.open; return; }
    const sec = e.target.closest("[data-sec]");
    if (sec) { location.hash = sec.dataset.sec === "" ? "#/c/" + S.group : `#/c/${S.group}/${sec.dataset.sec}`; return; }
    const pic = e.target.closest("[data-pic]");
    if (pic) { $("#pdMain").src = img(pic.dataset.pic); document.querySelectorAll("[data-pic]").forEach(b => b.classList.toggle("active", b === pic)); return; }
    const cp = e.target.closest("[data-copy]");
    if (cp) { navigator.clipboard?.writeText(cp.dataset.copy).then(() => toast(t("copied")), () => toast(cp.dataset.copy)); return; }
    if (e.target.closest("[data-close]") || e.target.id === "productModal") closeProduct();
  });
  document.addEventListener("change", e => {
    if (e.target.id === "sortSel") { S.sort = e.target.value; route(true); }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeProduct(); closeSearch(); }
    if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
  });
  $("#favBtn").onclick = () => { location.hash = "#/favorites"; };
  $("#settingsBtn").onclick = openSetup;
  function openSearch() { $("#searchBar").hidden = false; const i = $("#searchInput"); i.value = S.q; i.focus(); }
  function closeSearch() {
    if ($("#searchBar").hidden) return;
    $("#searchBar").hidden = true;
    if (S.q) { S.q = ""; route(true); }
  }
  $("#searchBtn").onclick = openSearch;
  $("#searchClose").onclick = closeSearch;
  let qT;
  $("#searchInput").addEventListener("input", e => {
    clearTimeout(qT);
    qT = setTimeout(() => {
      S.q = e.target.value.trim();
      if (!/^#\/(c\/|$)/.test(location.hash || "#/")) { history.replaceState(null, "", "#/"); S.group = "all"; S.section = null; }
      route(true);
    }, 160);
  });

  // ---------- router ----------
  function route(keepScroll) {
    if (!S.data) return;
    const h = location.hash || "#/";
    const parts = h.replace(/^#\/?/, "").split("/");
    if (parts[0] === "p") {
      if (!app.innerHTML) { S.group = "all"; S.section = null; renderProducts(); setActiveNav("products"); renderCatBar(); }
      openProduct(+parts[1]); return;
    }
    closeProduct(); S.mainHash = h;
    clearTimeout(S.typingTimer);
    if (parts[0] === "browse") { S.group = null; setActiveNav("browse"); renderCatBar(); renderBrowse(); }
    else if (parts[0] === "tools") { S.group = null; setActiveNav("tools"); renderCatBar(); renderTools(); }
    else if (parts[0] === "favorites") { S.group = null; setActiveNav(""); renderCatBar(); renderProducts({ hero: false, favs: true, title: esc(t("favorites")) }); }
    else {
      const g = parts[0] === "c" ? parts[1] : "all";
      const prevGroup = S.group;
      S.group = g; S.section = parts[0] === "c" && parts[2] != null && parts[2] !== "" ? +parts[2] : null;
      setActiveNav("products"); renderCatBar();
      renderProducts({ hero: g === "all" });
      if (!keepScroll && (g !== "all" || prevGroup !== "all") && g !== prevGroup) {
        const l = $("#list"); if (l) window.scrollTo({ top: l.offsetTop - 90, behavior: "instant" });
      }
      if (keepScroll === undefined && g === prevGroup) { /* section chip: stay */ }
      return;
    }
    if (!keepScroll) window.scrollTo({ top: 0, behavior: "instant" });
  }
  window.addEventListener("hashchange", () => route());

  // ---------- boot ----------
  $("#discordFab").href = SITE.discord;
  applyStaticI18n(); updateFavBadge();
  app.innerHTML = '<div class="empty" style="padding:160px 20px">…</div>';
  fetch("data/products.json").then(r => r.json()).then(d => {
    S.data = d;
    $("#updatedAt").textContent = d.updated;
    // Favoriten werden über den Link gespeichert – entfernte Produkte fallen raus
    const urls = new Set(d.products.map(p => p.u));
    S.favs = new Set([...S.favs].filter(u => urls.has(u))); updateFavBadge();
    renderCatBar(); app.innerHTML = ""; route();
    if (!store.get("setupDone", false)) openSetup();
  });
  loadRates();
})();
