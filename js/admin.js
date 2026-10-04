/* ============================================================
   Panel administrador: reservas, finanzas, proyecciones,
   barberos, servicios y ajustes.
   ============================================================ */
(function () {
  const CFG = window.BARBER_CONFIG;
  const { money, esc, initials, iso } = window.UTIL;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Paleta de series validada (daltonismo + contraste) para fondo oscuro
  const C = { s1: "#b08a33", s2: "#3987e5", s3: "#d95926", s4: "#199e70", s5: "#9085e9", s6: "#d55181", ink: "#f3ead8", ink2: "#c3bdb0", muted: "#8d887e", grid: "rgba(255,255,255,0.06)", surface: "#141416" };
  const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const STATUSES = ["pendiente", "confirmada", "completada", "cancelada"];
  const TYPES = { ingreso: "Ingreso extra", gasto: "Gasto fijo", costo: "Costo variable", inversion: "Inversión" };
  const CATS = {
    ingreso: ["Venta de productos", "Propinas", "Alquiler de silla", "Otros"],
    gasto: ["Arriendo", "Servicios públicos", "Nómina", "Marketing", "Software", "Impuestos", "Mantenimiento", "Otros"],
    costo: ["Insumos", "Lavandería", "Productos para venta", "Otros"],
    inversion: ["Equipos", "Mobiliario", "Remodelación", "Capacitación", "Otros"],
  };

  let data = { barbers: [], services: [], reservations: [], transactions: [], settings: {} };
  let view = "dashboard";
  let charts = [];
  const ui = { period: "mes", resWhen: "proximas", resStatus: "todas", resBarber: "", resQuery: "", finType: "todos", finMonth: iso(new Date()).slice(0, 7), projGrowth: 0, projExp: 0, projInvest: 0, projInvestMonth: 1 };

  /* ---------------- Branding + arranque ---------------- */
  $$("[data-brand]").forEach((el) => (el.textContent = CFG.brand[el.dataset.brand] ?? ""));
  document.title = `Admin · ${CFG.brand.name}`;
  $("#modePill").innerHTML = DB.mode === "demo" ? "Modo: <b>Demo</b> (datos locales)" : "Conectado a <b>Supabase</b>";
  if (DB.mode === "demo") $("#demoNote").classList.remove("hidden");

  init();
  async function init() {
    const user = await DB.auth.session().catch(() => null);
    if (user && !user.notAdmin) return enterApp();
    if (user?.notAdmin) { $("#loginErr").textContent = "Este usuario no tiene permisos de administrador."; await DB.auth.signOut(); }
    $("#loginView").classList.remove("hidden");
  }
  $("#loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = $("#loginBtn"); btn.disabled = true; btn.textContent = "Entrando…"; $("#loginErr").textContent = "";
    try {
      await DB.auth.signIn($("#lEmail").value.trim(), $("#lPass").value);
      const u = await DB.auth.session();
      if (!u || u.notAdmin) { await DB.auth.signOut(); throw new Error("Este usuario no tiene permisos de administrador."); }
      $("#loginView").classList.add("hidden"); enterApp();
    } catch (err) { $("#loginErr").textContent = err.message; }
    btn.disabled = false; btn.textContent = "Entrar";
  };
  $("#logoutBtn").onclick = async () => { await DB.auth.signOut(); location.reload(); };
  $("#menuBtn").onclick = () => document.body.classList.toggle("side-open");
  $$(".nav-item[data-view]").forEach((b) => (b.onclick = () => { view = b.dataset.view; document.body.classList.remove("side-open"); render(); }));

  async function enterApp() {
    $("#appView").classList.remove("hidden");
    $("#content").innerHTML = `<div class="empty">Cargando datos…</div>`;
    await reload();
    render();
  }
  async function reload() {
    try {
      const [barbers, services, reservations, transactions, settings] = await Promise.all([
        DB.list("barbers"), DB.list("services"), DB.list("reservations"), DB.list("transactions"), DB.getSettings(),
      ]);
      reservations.forEach((r) => (r.time = String(r.time).slice(0, 5)));
      data = { barbers, services, reservations, transactions, settings };
    } catch (e) { toast("Error cargando datos: " + e.message); }
    const pending = data.reservations.filter((r) => r.status === "pendiente" && r.date >= iso(new Date())).length;
    const badge = $("#pendingBadge");
    badge.textContent = pending; badge.classList.toggle("hidden", !pending);
  }

  /* ---------------- Utilidades ---------------- */
  const barberById = (id) => data.barbers.find((b) => b.id === id);
  const serviceById = (id) => data.services.find((s) => s.id === id);
  const today = () => iso(new Date());
  const pct = (v) => (isFinite(v) ? (v * 100).toFixed(1).replace(".0", "") + "%" : "—");
  const monthKey = (d) => d.slice(0, 7);
  const addMonths = (key, n) => { const [y, m] = key.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return `${MONTHS[m - 1]} ${String(y).slice(2)}`; };
  const lastDay = (key) => { const [y, m] = key.split("-").map(Number); return iso(new Date(y, m, 0)); };
  const shortMoney = (v) => { const a = Math.abs(v); const s = v < 0 ? "-" : ""; return a >= 1e6 ? `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M` : a >= 1e3 ? `${s}$${Math.round(a / 1e3)}k` : `${s}$${Math.round(a)}`; };
  const waLink = (phone) => { let p = String(phone).replace(/\D/g, ""); if (p.length === 10 && p.startsWith("3")) p = "57" + p; return `https://wa.me/${p}`; };

  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
  }

  function periodRange(key) {
    const t = today(), mk = monthKey(t);
    switch (key) {
      case "mes": { const from = mk + "-01", days = +t.slice(8); const pk = addMonths(mk, -1); const pTo = pk + "-" + String(Math.min(days, +lastDay(pk).slice(8))).padStart(2, "0"); return { from, to: t, prev: [pk + "-01", pTo], label: "vs. mismo periodo mes anterior" }; }
      case "mes_ant": { const k = addMonths(mk, -1), pk = addMonths(mk, -2); return { from: k + "-01", to: lastDay(k), prev: [pk + "-01", lastDay(pk)], label: "vs. mes previo" }; }
      case "3m": return { from: addMonths(mk, -2) + "-01", to: t, prev: [addMonths(mk, -5) + "-01", lastDay(addMonths(mk, -3))], label: "vs. 3 meses previos" };
      case "6m": return { from: addMonths(mk, -5) + "-01", to: t, prev: [addMonths(mk, -11) + "-01", lastDay(addMonths(mk, -6))], label: "vs. 6 meses previos" };
      case "anio": { const y = +t.slice(0, 4); return { from: `${y}-01-01`, to: t, prev: [`${y - 1}-01-01`, `${y - 1}${t.slice(4)}`], label: "vs. mismo periodo año anterior" }; }
      default: return { from: "0000-01-01", to: "9999-12-31", prev: null, label: "" };
    }
  }

  // Resumen financiero de un rango de fechas
  function summarize(from, to) {
    const inR = (d) => d >= from && d <= to;
    const res = data.reservations.filter((r) => inR(r.date));
    const done = res.filter((r) => r.status === "completada");
    const cancelled = res.filter((r) => r.status === "cancelada").length;
    const tx = data.transactions.filter((x) => inR(x.date));
    const sum = (arr, f) => arr.reduce((a, x) => a + (+f(x) || 0), 0);
    const serviceRevenue = sum(done, (r) => r.price);
    const otherIncome = sum(tx.filter((x) => x.type === "ingreso"), (x) => x.amount);
    const commissions = sum(done, (r) => r.price * ((barberById(r.barber_id)?.commission_pct ?? 0) / 100));
    const gastos = sum(tx.filter((x) => x.type === "gasto"), (x) => x.amount);
    const costos = sum(tx.filter((x) => x.type === "costo"), (x) => x.amount);
    const inversion = sum(tx.filter((x) => x.type === "inversion"), (x) => x.amount);
    const revenue = serviceRevenue + otherIncome;
    const egresos = commissions + gastos + costos;
    const net = revenue - egresos;
    return { res, done, count: done.length, cancelled, serviceRevenue, otherIncome, revenue, commissions, gastos, costos, inversion, egresos, net, margin: revenue ? net / revenue : NaN, ticket: done.length ? serviceRevenue / done.length : 0, cancelRate: done.length + cancelled ? cancelled / (done.length + cancelled) : 0, tx };
  }
  const monthSummary = (key) => summarize(key + "-01", lastDay(key));

  function delta(cur, prev, invert = false) {
    if (prev == null || !isFinite(prev) || prev === 0) return `<span class="delta">—</span>`;
    const d = (cur - prev) / Math.abs(prev);
    const good = invert ? d < 0 : d > 0;
    return `<span class="delta ${Math.abs(d) < 0.005 ? "" : good ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${pct(Math.abs(d))}</span>`;
  }

  /* ---------------- Chart.js base ---------------- */
  if (window.Chart) {
    Chart.defaults.color = C.ink2;
    Chart.defaults.font.family = "Manrope, system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.legend.display = false;
    Object.assign(Chart.defaults.plugins.tooltip, {
      backgroundColor: "#0f0f11", borderColor: "rgba(212,175,55,.35)", borderWidth: 1, titleColor: C.muted, bodyColor: C.ink,
      padding: 12, cornerRadius: 10, boxPadding: 6, usePointStyle: true, titleFont: { weight: 700, size: 11 }, bodyFont: { size: 12 },
    });
  }
  // Línea vertical al pasar el cursor (crosshair)
  const crosshair = {
    id: "crosshair",
    afterDraw(chart) {
      const a = chart.tooltip?.getActiveElements?.();
      if (!a || !a.length || chart.config.type !== "line") return;
      const x = a[0].element.x, { top, bottom } = chart.chartArea, ctx = chart.ctx;
      ctx.save(); ctx.strokeStyle = "rgba(243,234,216,.25)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.restore();
    },
  };
  // Etiqueta directa al final de cada línea
  const endLabels = {
    id: "endLabels",
    afterDatasetsDraw(chart, _a, opts) {
      if (!opts?.enabled) return;
      const ctx = chart.ctx; ctx.save(); ctx.font = "600 11px Manrope"; ctx.fillStyle = C.ink2; ctx.textBaseline = "middle";
      chart.data.datasets.forEach((ds, i) => {
        if (!ds.endLabel) return;
        const meta = chart.getDatasetMeta(i); if (meta.hidden) return;
        let idx = ds.data.length - 1; while (idx >= 0 && ds.data[idx] == null) idx--;
        const p = meta.data[idx]; if (!p) return;
        ctx.fillText(ds.endLabel, p.x + 8, p.y);
      });
      ctx.restore();
    },
  };
  const moneyAxis = { grid: { color: C.grid, drawTicks: false }, border: { display: false }, ticks: { padding: 8, callback: (v) => shortMoney(v), maxTicksLimit: 6 } };
  const catAxis = { grid: { display: false }, border: { color: C.grid }, ticks: { padding: 6 } };
  const moneyTip = (ctx) => ` ${ctx.dataset.label}: ${money(ctx.parsed.y ?? ctx.parsed.x)}`;
  function mkChart(id, config) {
    const el = document.getElementById(id); if (!el || !window.Chart) return;
    config.plugins = [...(config.plugins || []), crosshair, endLabels];
    charts.push(new Chart(el, config));
  }

  /* ---------------- Render principal ---------------- */
  const TITLES = {
    dashboard: ["Dashboard", "Resumen financiero y operativo"],
    reservas: ["Reservas", "Agenda y estado de las citas"],
    finanzas: ["Finanzas", "Ingresos extra, gastos, costos e inversiones"],
    proyecciones: ["Proyecciones", "Escenarios a 6 meses y punto de equilibrio"],
    barberos: ["Barberos", "Equipo y comisiones"],
    servicios: ["Servicios", "Catálogo y precios"],
    ajustes: ["Ajustes", "Metas y configuración"],
  };
  function render() {
    charts.forEach((c) => c.destroy()); charts = [];
    $$(".nav-item[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    $("#viewTitle").textContent = TITLES[view][0];
    $("#viewSub").textContent = TITLES[view][1];
    $("#topActions").innerHTML = "";
    ({ dashboard, reservas, finanzas, proyecciones, barberos, servicios, ajustes })[view]();
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */
  function dashboard() {
    const P = periodRange(ui.period);
    const cur = summarize(P.from, P.to);
    const prev = P.prev ? summarize(...P.prev) : null;
    $("#topActions").innerHTML = `<div class="seg" id="periodSeg">${[["mes", "Este mes"], ["mes_ant", "Mes anterior"], ["3m", "3 meses"], ["6m", "6 meses"], ["anio", "Este año"], ["todo", "Todo"]].map(([k, l]) => `<button data-p="${k}" class="${ui.period === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
    $$("#periodSeg button").forEach((b) => (b.onclick = () => { ui.period = b.dataset.p; render(); }));

    // Meta del mes
    const mk = monthKey(today());
    const m = monthSummary(mk);
    const dayN = +today().slice(8), daysIn = +lastDay(mk).slice(8);
    const goal = +data.settings.monthly_goal || 0;
    const forecast = (m.revenue / Math.max(1, dayN)) * daysIn;

    // Inversiones / ROI (histórico)
    const invs = data.transactions.filter((t) => t.type === "inversion");
    const totalInv = invs.reduce((a, t) => a + +t.amount, 0);
    const firstInv = invs.map((t) => t.date).sort()[0];
    const sinceInv = firstInv ? summarize(firstInv, today()) : null;
    const recovered = sinceInv ? sinceInv.net : 0;
    const last3 = [1, 2, 3].map((i) => monthSummary(addMonths(mk, -i)).net);
    const avgNet3 = last3.reduce((a, b) => a + b, 0) / 3;
    const remaining = Math.max(0, totalInv - recovered);
    const payback = remaining <= 0 ? "Recuperada ✓" : avgNet3 > 0 ? `${Math.ceil(remaining / avgNet3)} meses aprox.` : "Sin utilidad para recuperar";

    const kpi = (label, value, d, cls = "", swatch = "") => `<div class="card kpi ${cls}"><div class="label">${swatch}${label}</div><div class="value">${value}</div>${d}</div>`;
    $("#content").innerHTML = `
      <div class="grid kpis">
        ${kpi("Ingresos", money(cur.revenue), delta(cur.revenue, prev?.revenue), "hero")}
        ${kpi("Egresos", money(cur.egresos), delta(cur.egresos, prev?.egresos, true))}
        ${kpi("Utilidad neta", money(cur.net), delta(cur.net, prev?.net), "hero")}
        ${kpi("Margen neto", pct(cur.margin), prev ? delta(cur.margin, prev.margin) : "")}
        ${kpi("Servicios realizados", cur.count.toLocaleString("es-CO"), delta(cur.count, prev?.count))}
        ${kpi("Ticket promedio", money(cur.ticket), delta(cur.ticket, prev?.ticket))}
      </div>
      <p class="note" style="margin:-6px 0 16px">${esc(P.label)} · Egresos = comisiones de barberos + gastos fijos + costos variables (las inversiones se muestran aparte).</p>

      <div class="grid cols-2" style="margin-bottom:16px">
        <div class="card">
          <div class="card-h"><div><h3>Ingresos vs. egresos</h3><p>Hasta 12 meses</p></div>
            <div class="legend"><span><i style="background:${C.s1}"></i>Ingresos</span><span><i style="background:${C.s2}"></i>Egresos</span></div></div>
          <div class="chart-box"><canvas id="chMonthly" aria-label="Ingresos y egresos por mes"></canvas></div>
        </div>
        <div class="grid" style="align-content:start">
          <div class="card">
            <div class="card-h"><div><h3>Meta de ${MONTHS[+mk.slice(5) - 1].toLowerCase()}</h3><p>Día ${dayN} de ${daysIn}</p></div><b>${goal ? pct(m.revenue / goal) : "—"}</b></div>
            <div class="progress"><div style="width:${goal ? Math.min(100, (m.revenue / goal) * 100) : 0}%"></div></div>
            <div class="stat-row"><span>Facturado</span><b>${money(m.revenue)}</b></div>
            <div class="stat-row"><span>Meta</span><b>${goal ? money(goal) : "Defínela en Ajustes"}</b></div>
            <div class="stat-row"><span>Cierre estimado al ritmo actual</span><b>${money(forecast)}</b></div>
          </div>
          <div class="card">
            <div class="card-h"><div><h3>Retorno de inversión</h3><p>Desde ${firstInv ? firstInv : "—"}</p></div><b>${totalInv ? pct(recovered / totalInv) : "—"}</b></div>
            <div class="progress"><div style="width:${totalInv ? Math.max(0, Math.min(100, (recovered / totalInv) * 100)) : 0}%"></div></div>
            <div class="stat-row"><span>Total invertido</span><b>${money(totalInv)}</b></div>
            <div class="stat-row"><span>Utilidad acumulada</span><b>${money(recovered)}</b></div>
            <div class="stat-row"><span>ROI</span><b>${totalInv ? pct((recovered - totalInv) / totalInv) : "—"}</b></div>
            <div class="stat-row"><span>Recuperación</span><b>${payback}</b></div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-h"><div><h3>Ingresos por barbero</h3><p>Servicios completados en el periodo</p></div>
          <div class="legend"><span><i class="box" style="background:${C.s1}"></i>Parte barbería</span><span><i class="box" style="background:${C.s2}"></i>Comisión barbero</span></div></div>
        <div class="grid cols-2b">
          <div class="chart-box sm"><canvas id="chBarbers" aria-label="Ingresos por barbero"></canvas></div>
          <div class="table-wrap">${barberTable(cur.done)}</div>
        </div>
      </div>

      <div class="grid cols-2b">
        <div class="card"><div class="card-h"><div><h3>Egresos por categoría</h3><p>Incluye comisiones</p></div></div><div class="chart-box sm"><canvas id="chExpenses" aria-label="Egresos por categoría"></canvas></div></div>
        <div class="card"><div class="card-h"><div><h3>Servicios más vendidos</h3><p>Cantidad en el periodo</p></div></div><div class="chart-box sm"><canvas id="chServices" aria-label="Servicios más vendidos"></canvas></div></div>
      </div>`;

    // 12 meses
    let keys = Array.from({ length: 12 }, (_, i) => addMonths(mk, i - 11));
    let ms = keys.map(monthSummary);
    const firstData = ms.findIndex((x) => x.revenue || x.egresos);
    if (firstData > 0) { keys = keys.slice(firstData); ms = ms.slice(firstData); }
    mkChart("chMonthly", {
      type: "line",
      data: { labels: keys.map(monthLabel), datasets: [
        { label: "Ingresos", data: ms.map((x) => x.revenue), borderColor: C.s1, backgroundColor: "rgba(176,138,51,.10)", fill: true, borderWidth: 2, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: C.surface, pointBackgroundColor: C.s1, endLabel: "Ingresos" },
        { label: "Egresos", data: ms.map((x) => x.egresos), borderColor: C.s2, borderWidth: 2, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: C.surface, pointBackgroundColor: C.s2, endLabel: "Egresos" },
      ] },
      options: { maintainAspectRatio: false, layout: { padding: { right: 62 } }, interaction: { mode: "index", intersect: false }, scales: { y: { ...moneyAxis, beginAtZero: true }, x: catAxis },
        plugins: { endLabels: { enabled: true }, tooltip: { callbacks: { label: moneyTip, footer: (items) => `Utilidad: ${money(items[0].parsed.y - (items[1]?.parsed.y || 0))}` } } } },
    });

    // Barberos
    const byB = barberStats(cur.done);
    mkChart("chBarbers", {
      type: "bar",
      data: { labels: byB.map((b) => b.short), datasets: [
        { label: "Parte barbería", data: byB.map((b) => b.revenue - b.commission), backgroundColor: C.s1, borderColor: C.surface, borderWidth: 2, borderRadius: 4, borderSkipped: false, maxBarThickness: 28 },
        { label: "Comisión barbero", data: byB.map((b) => b.commission), backgroundColor: C.s2, borderColor: C.surface, borderWidth: 2, borderRadius: 4, borderSkipped: false, maxBarThickness: 28 },
      ] },
      options: { indexAxis: "y", maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, scales: { x: { ...moneyAxis, stacked: true }, y: { ...catAxis, stacked: true } },
        plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${money(c.parsed.x)}`, footer: (it) => `Total: ${money(it.reduce((a, x) => a + x.parsed.x, 0))}` } } } },
    });

    // Egresos por categoría
    const cats = {};
    if (cur.commissions) cats["Comisiones"] = cur.commissions;
    cur.tx.filter((t) => t.type === "gasto" || t.type === "costo").forEach((t) => (cats[t.category] = (cats[t.category] || 0) + +t.amount));
    const catArr = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    mkChart("chExpenses", {
      type: "bar",
      data: { labels: catArr.map((c) => c[0]), datasets: [{ label: "Egreso", data: catArr.map((c) => c[1]), backgroundColor: C.s2, borderRadius: 4, borderSkipped: false, maxBarThickness: 22 }] },
      options: { indexAxis: "y", maintainAspectRatio: false, scales: { x: moneyAxis, y: catAxis }, plugins: { tooltip: { callbacks: { label: (c) => ` ${money(c.parsed.x)} · ${pct(c.parsed.x / (cur.egresos || 1))} del total` } } } },
    });

    // Servicios
    const sc = {};
    cur.done.forEach((r) => (sc[r.service_id] = (sc[r.service_id] || 0) + 1));
    const scArr = Object.entries(sc).map(([id, n]) => [serviceById(id)?.name || "—", n]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    mkChart("chServices", {
      type: "bar",
      data: { labels: scArr.map((s) => s[0]), datasets: [{ label: "Servicios", data: scArr.map((s) => s[1]), backgroundColor: C.s1, borderRadius: 4, borderSkipped: false, maxBarThickness: 22 }] },
      options: { indexAxis: "y", maintainAspectRatio: false, scales: { x: { grid: { color: C.grid }, border: { display: false }, ticks: { precision: 0 } }, y: catAxis }, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.parsed.x} servicios` } } } },
    });
  }

  function barberStats(done) {
    return data.barbers.map((b) => {
      const mine = done.filter((r) => r.barber_id === b.id);
      const revenue = mine.reduce((a, r) => a + +r.price, 0);
      const commission = revenue * (b.commission_pct / 100);
      return { ...b, short: b.name.replace(/".*?"\s*/g, ""), n: mine.length, revenue, commission, ticket: mine.length ? revenue / mine.length : 0 };
    }).filter((b) => b.n || b.active).sort((a, b) => b.revenue - a.revenue);
  }
  function barberTable(done) {
    const rows = barberStats(done);
    if (!rows.length) return `<div class="empty">Sin datos</div>`;
    return `<table><thead><tr><th>Barbero</th><th class="num">Servicios</th><th class="num">Producido</th><th class="num">Comisión</th><th class="num">Ticket</th></tr></thead><tbody>
      ${rows.map((b) => `<tr><td><div class="who"><span class="avatar">${b.photo_url ? `<img src="${esc(b.photo_url)}" alt="">` : esc(initials(b.name))}</span><div>${esc(b.short)}<small>${b.commission_pct}% comisión</small></div></div></td>
      <td class="num">${b.n}</td><td class="num">${money(b.revenue)}</td><td class="num">${money(b.commission)}</td><td class="num">${money(b.ticket)}</td></tr>`).join("")}</tbody></table>`;
  }

  /* ============================================================
     RESERVAS
     ============================================================ */
  function reservas() {
    $("#topActions").innerHTML = `<button class="btn btn-gold" id="newRes">+ Nueva reserva</button>`;
    $("#newRes").onclick = () => reservationModal();
    const t = today();
    const base = data.reservations.filter((r) => {
      if (ui.resWhen === "hoy" && r.date !== t) return false;
      if (ui.resWhen === "proximas" && r.date < t) return false;
      if (ui.resWhen === "pasadas" && r.date >= t) return false;
      if (ui.resBarber && r.barber_id !== ui.resBarber) return false;
      if (ui.resQuery) { const q = ui.resQuery.toLowerCase(); if (!(`${r.client_name} ${r.client_phone}`.toLowerCase().includes(q))) return false; }
      return true;
    });
    const counts = Object.fromEntries(STATUSES.map((s) => [s, base.filter((r) => r.status === s).length]));
    const list = base.filter((r) => ui.resStatus === "todas" || r.status === ui.resStatus)
      .sort((a, b) => (ui.resWhen === "pasadas" ? -1 : 1) * (a.date + a.time).localeCompare(b.date + b.time));
    const shown = list.slice(0, 300);

    $("#content").innerHTML = `
      <div class="filters">
        <div class="seg" id="whenSeg">${[["hoy", "Hoy"], ["proximas", "Próximas"], ["pasadas", "Historial"], ["todas", "Todas"]].map(([k, l]) => `<button data-w="${k}" class="${ui.resWhen === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <select class="input" id="fBarber"><option value="">Todos los barberos</option>${data.barbers.map((b) => `<option value="${b.id}" ${ui.resBarber === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select>
        <input class="input" id="fQuery" placeholder="Buscar cliente o teléfono" value="${esc(ui.resQuery)}" style="flex:1;min-width:200px">
      </div>
      <div class="pill-tabs">
        <button class="pill-tab ${ui.resStatus === "todas" ? "on" : ""}" data-st="todas">Todas<b>${base.length}</b></button>
        ${STATUSES.map((s) => `<button class="pill-tab ${ui.resStatus === s ? "on" : ""}" data-st="${s}">${s[0].toUpperCase() + s.slice(1)}<b>${counts[s]}</b></button>`).join("")}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Cliente</th><th>Servicio</th><th>Barbero</th><th class="num">Precio</th><th>Estado</th><th></th></tr></thead>
        <tbody>${shown.length ? shown.map(resRow).join("") : `<tr><td colspan="7" class="empty">No hay reservas con estos filtros</td></tr>`}</tbody>
      </table></div>
      ${list.length > shown.length ? `<p class="note">Mostrando ${shown.length} de ${list.length}. Usa los filtros para acotar.</p>` : ""}`;

    $$("#whenSeg button").forEach((b) => (b.onclick = () => { ui.resWhen = b.dataset.w; render(); }));
    $$("[data-st]").forEach((b) => (b.onclick = () => { ui.resStatus = b.dataset.st; render(); }));
    $("#fBarber").onchange = (e) => { ui.resBarber = e.target.value; render(); };
    let qt; $("#fQuery").oninput = (e) => { clearTimeout(qt); qt = setTimeout(() => { ui.resQuery = e.target.value; render(); const i = $("#fQuery"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    $$("select[data-status]").forEach((s) => (s.onchange = async () => {
      try { await DB.update("reservations", s.dataset.status, { status: s.value }); const r = data.reservations.find((x) => x.id === s.dataset.status); r.status = s.value; s.className = `status st-${s.value}`; toast("Estado actualizado"); await reload(); }
      catch (e) { toast("Error: " + e.message); }
    }));
    $$("[data-edit-res]").forEach((b) => (b.onclick = () => reservationModal(data.reservations.find((r) => r.id === b.dataset.editRes))));
    $$("[data-del-res]").forEach((b) => (b.onclick = async () => {
      if (!confirm("¿Eliminar esta reserva? Esta acción no se puede deshacer.")) return;
      try { await DB.remove("reservations", b.dataset.delRes); await reload(); render(); toast("Reserva eliminada"); } catch (e) { toast("Error: " + e.message); }
    }));
  }
  function resRow(r) {
    const d = new Date(r.date + "T00:00:00");
    const b = barberById(r.barber_id), s = serviceById(r.service_id);
    return `<tr>
      <td style="white-space:nowrap"><b>${["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}</b><br><span style="color:var(--muted)">${esc(r.time)}</span></td>
      <td><b>${esc(r.client_name)}</b><br><a href="${waLink(r.client_phone)}" target="_blank" rel="noopener">${esc(r.client_phone)}</a></td>
      <td>${esc(s?.name || "—")}</td>
      <td>${esc(b?.name.replace(/".*?"\s*/g, "") || "—")}</td>
      <td class="num">${money(r.price)}</td>
      <td><select class="status st-${r.status}" data-status="${r.id}" aria-label="Estado">${STATUSES.map((x) => `<option value="${x}" ${x === r.status ? "selected" : ""}>${x[0].toUpperCase() + x.slice(1)}</option>`).join("")}</select></td>
      <td style="white-space:nowrap"><button class="icon-btn" data-edit-res="${r.id}" title="Editar">✎</button><button class="icon-btn" data-del-res="${r.id}" title="Eliminar">✕</button></td></tr>`;
  }

  /* ---------------- Modal genérico ---------------- */
  function modal(title, fields, values, onSave) {
    const bg = document.createElement("div"); bg.className = "modal-bg";
    const input = (f) => {
      const v = values?.[f.k] ?? f.def ?? "";
      if (f.type === "select") return `<select name="${f.k}" ${f.req ? "required" : ""}>${f.options.map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`).join("")}</select>`;
      if (f.type === "textarea") return `<textarea name="${f.k}" rows="3">${esc(v)}</textarea>`;
      if (f.type === "checkbox") return "";
      return `<input name="${f.k}" type="${f.type || "text"}" value="${esc(v)}" ${f.req ? "required" : ""} ${f.step ? `step="${f.step}"` : ""} ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} ${f.list ? `list="dl-${f.k}"` : ""}>${f.list ? `<datalist id="dl-${f.k}">${f.list.map((o) => `<option value="${esc(o)}">`).join("")}</datalist>` : ""}`;
    };
    bg.innerHTML = `<form class="modal"><h2>${esc(title)}</h2><div class="form-grid">
      ${fields.map((f) => f.type === "checkbox"
        ? `<label class="check-row" style="grid-column:1/-1"><input type="checkbox" name="${f.k}" ${(values?.[f.k] ?? f.def) ? "checked" : ""}> ${esc(f.label)}</label>`
        : `<div class="field" style="${f.full ? "grid-column:1/-1" : ""}"><label>${esc(f.label)}</label>${input(f)}</div>`).join("")}
      </div><div class="err"></div><div class="modal-foot"><button type="button" class="btn btn-line" data-x>Cancelar</button><button class="btn btn-gold">Guardar</button></div></form>`;
    document.body.appendChild(bg);
    const form = $("form", bg);
    const close = () => bg.remove();
    $("[data-x]", bg).onclick = close;
    bg.addEventListener("mousedown", (e) => e.target === bg && close());
    form.onsubmit = async (e) => {
      e.preventDefault();
      const out = {};
      fields.forEach((f) => {
        const el = form.elements[f.k];
        out[f.k] = f.type === "checkbox" ? el.checked : f.type === "number" ? (el.value === "" ? null : +el.value) : el.value.trim() || null;
      });
      const btn = $(".btn-gold", form); btn.disabled = true;
      try { await onSave(out); close(); } catch (err) { $(".err", form).textContent = err.message; btn.disabled = false; }
    };
    return bg;
  }

  function reservationModal(r) {
    const bs = data.barbers.map((b) => [b.id, b.name]), ss = data.services.map((s) => [s.id, `${s.name} · ${money(s.price)}`]);
    const bg = modal(r ? "Editar reserva" : "Nueva reserva", [
      { k: "client_name", label: "Cliente", req: true, full: true },
      { k: "client_phone", label: "Teléfono", req: true },
      { k: "status", label: "Estado", type: "select", options: STATUSES.map((s) => [s, s[0].toUpperCase() + s.slice(1)]), def: "confirmada" },
      { k: "service_id", label: "Servicio", type: "select", options: ss, req: true },
      { k: "barber_id", label: "Barbero", type: "select", options: bs, req: true },
      { k: "date", label: "Fecha", type: "date", req: true, def: today() },
      { k: "time", label: "Hora", type: "time", req: true, step: 1800, def: "10:00" },
      { k: "price", label: "Precio cobrado", type: "number", min: 0, step: 1000 },
      { k: "notes", label: "Notas", type: "textarea", full: true },
    ], r, async (v) => {
      if (v.price == null) v.price = serviceById(v.service_id)?.price ?? 0;
      v.time = v.time.slice(0, 5);
      if (r) await DB.update("reservations", r.id, v); else await DB.insert("reservations", v);
      await reload(); render(); toast(r ? "Reserva actualizada" : "Reserva creada");
    });
    if (!r) { const f = $("form", bg); const sync = () => (f.elements.price.value = serviceById(f.elements.service_id.value)?.price ?? ""); f.elements.service_id.onchange = sync; sync(); }
  }

  /* ============================================================
     FINANZAS
     ============================================================ */
  function finanzas() {
    $("#topActions").innerHTML = `<button class="btn btn-gold" id="newTx">+ Nuevo movimiento</button>`;
    $("#newTx").onclick = () => txModal();
    const mk = ui.finMonth;
    const s = monthSummary(mk);
    const list = s.tx.filter((t) => ui.finType === "todos" || t.type === ui.finType).sort((a, b) => b.date.localeCompare(a.date));
    const card = (label, v, sub) => `<div class="card kpi"><div class="label">${label}</div><div class="value">${money(v)}</div><span class="delta">${sub}</span></div>`;
    const liq = barberStats(s.done);

    $("#content").innerHTML = `
      <div class="filters">
        <input type="month" class="input" id="fMonth" value="${mk}">
        <div class="seg" id="typeSeg">${[["todos", "Todos"], ...Object.entries(TYPES)].map(([k, l]) => `<button data-t="${k}" class="${ui.finType === k ? "on" : ""}">${l}</button>`).join("")}</div>
      </div>
      <div class="grid kpis">
        ${card("Ingresos por servicios", s.serviceRevenue, `${s.count} servicios completados`)}
        ${card("Ingresos extra", s.otherIncome, "Productos, propinas, otros")}
        ${card("Comisiones barberos", s.commissions, "Según % de cada barbero")}
        ${card("Gastos fijos", s.gastos, "Arriendo, nómina, servicios…")}
        ${card("Costos variables", s.costos, "Insumos y consumibles")}
        ${card("Inversiones", s.inversion, "No afectan la utilidad operativa")}
        <div class="card kpi hero"><div class="label">Utilidad neta del mes</div><div class="value">${money(s.net)}</div><span class="delta">Margen ${pct(s.margin)}</span></div>
      </div>
      <div class="grid cols-2">
        <div class="card"><div class="card-h"><div><h3>Movimientos</h3><p>${monthLabel(mk)}</p></div></div>
          <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th class="num">Monto</th><th></th></tr></thead><tbody>
          ${list.length ? list.map((t) => `<tr><td style="white-space:nowrap">${t.date}</td><td><span class="type-tag">${TYPES[t.type]}</span></td><td>${esc(t.category)}</td><td>${esc(t.description || "")}${t.barber_id ? ` <small style="color:var(--muted)">· ${esc(barberById(t.barber_id)?.name || "")}</small>` : ""}</td><td class="num">${money(t.amount)}</td>
            <td style="white-space:nowrap"><button class="icon-btn" data-edit-tx="${t.id}" title="Editar">✎</button><button class="icon-btn" data-del-tx="${t.id}" title="Eliminar">✕</button></td></tr>`).join("") : `<tr><td colspan="6" class="empty">Sin movimientos este mes</td></tr>`}
          </tbody></table></div></div>
        <div class="card"><div class="card-h"><div><h3>Liquidación de barberos</h3><p>Comisiones a pagar · ${monthLabel(mk)}</p></div></div>
          <div class="table-wrap"><table><thead><tr><th>Barbero</th><th class="num">Producido</th><th class="num">A pagar</th></tr></thead><tbody>
          ${liq.map((b) => `<tr><td>${esc(b.short)}<br><small style="color:var(--muted)">${b.n} serv. · ${b.commission_pct}%</small></td><td class="num">${money(b.revenue)}</td><td class="num"><b>${money(b.commission)}</b></td></tr>`).join("")}
          <tr><td><b>Total</b></td><td class="num">${money(s.serviceRevenue)}</td><td class="num"><b>${money(s.commissions)}</b></td></tr>
          </tbody></table></div></div>
      </div>`;
    $("#fMonth").onchange = (e) => { if (e.target.value) { ui.finMonth = e.target.value; render(); } };
    $$("#typeSeg button").forEach((b) => (b.onclick = () => { ui.finType = b.dataset.t; render(); }));
    $$("[data-edit-tx]").forEach((b) => (b.onclick = () => txModal(data.transactions.find((t) => t.id === b.dataset.editTx))));
    $$("[data-del-tx]").forEach((b) => (b.onclick = async () => {
      if (!confirm("¿Eliminar este movimiento?")) return;
      try { await DB.remove("transactions", b.dataset.delTx); await reload(); render(); toast("Movimiento eliminado"); } catch (e) { toast("Error: " + e.message); }
    }));
  }
  function txModal(t) {
    const type = t?.type || (ui.finType !== "todos" ? ui.finType : "gasto");
    const bg = modal(t ? "Editar movimiento" : "Nuevo movimiento", [
      { k: "type", label: "Tipo", type: "select", options: Object.entries(TYPES), def: type, req: true },
      { k: "date", label: "Fecha", type: "date", def: today(), req: true },
      { k: "category", label: "Categoría", list: [...new Set(Object.values(CATS).flat())], req: true, def: CATS[type][0] },
      { k: "amount", label: "Monto (COP)", type: "number", min: 0, step: 100, req: true },
      { k: "description", label: "Descripción", full: true },
      { k: "barber_id", label: "Barbero relacionado (opcional)", type: "select", options: [["", "— Ninguno —"], ...data.barbers.map((b) => [b.id, b.name])], full: true },
    ], t, async (v) => {
      if (t) await DB.update("transactions", t.id, v); else await DB.insert("transactions", v);
      ui.finMonth = v.date.slice(0, 7);
      await reload(); render(); toast("Movimiento guardado");
    });
    const f = $("form", bg);
    f.elements.type.onchange = () => { $("#dl-category", bg).innerHTML = CATS[f.elements.type.value].map((c) => `<option value="${c}">`).join(""); if (!t) f.elements.category.value = CATS[f.elements.type.value][0]; };
    f.elements.type.onchange();
    if (t) f.elements.category.value = t.category;
  }

  /* ============================================================
     PROYECCIONES
     ============================================================ */
  function proyecciones() {
    const mk = monthKey(today());
    const histKeys = Array.from({ length: 6 }, (_, i) => addMonths(mk, i - 6)); // 6 meses completos
    const hist = histKeys.map(monthSummary);
    const n = hist.length;
    // Regresión lineal sobre ingresos
    const xs = hist.map((_, i) => i), ys = hist.map((h) => h.revenue);
    const xm = xs.reduce((a, b) => a + b, 0) / n, ym = ys.reduce((a, b) => a + b, 0) / n;
    const slope = xs.reduce((a, x, i) => a + (x - xm) * (ys[i] - ym), 0) / (xs.reduce((a, x) => a + (x - xm) ** 2, 0) || 1);
    const intercept = ym - slope * xm;
    const totRev = ys.reduce((a, b) => a + b, 0);
    const varRatio = totRev ? hist.reduce((a, h) => a + h.commissions + h.costos, 0) / totRev : 0;
    const fixed = hist.slice(-3).reduce((a, h) => a + h.gastos, 0) / 3;
    const trendPct = ym ? slope / ym : 0;

    // Punto de equilibrio
    const svcCount = hist.reduce((a, h) => a + h.count, 0) / n;
    const svcRev = hist.reduce((a, h) => a + h.serviceRevenue, 0);
    const ticket = svcCount ? svcRev / (svcCount * n) : 0;
    const otherPerMonth = hist.reduce((a, h) => a + h.otherIncome, 0) / n;
    const contribution = ticket * (1 - varRatio);
    const breakEven = contribution > 0 ? Math.ceil(Math.max(0, fixed - otherPerMonth * (1 - varRatio)) / contribution) : 0;

    function project() {
      const g = ui.projGrowth / 100, e = ui.projExp / 100;
      let cash = 0;
      return Array.from({ length: 6 }, (_, i) => {
        const key = addMonths(mk, i);
        const base = Math.max(0, intercept + slope * (n + i));
        const revenue = base * Math.pow(1 + g, i + 1);
        const variable = revenue * varRatio;
        const fx = fixed * Math.pow(1 + e, i + 1);
        const net = revenue - variable - fx;
        const inv = i + 1 === +ui.projInvestMonth ? +ui.projInvest || 0 : 0;
        cash += net - inv;
        return { key, revenue, variable, fixed: fx, net, inv, cash };
      });
    }

    $("#content").innerHTML = `
      <div class="grid kpis">
        <div class="card kpi"><div class="label">Tendencia mensual</div><div class="value">${trendPct >= 0 ? "+" : ""}${pct(trendPct)}</div><span class="delta">Crecimiento promedio de ingresos (6 meses)</span></div>
        <div class="card kpi"><div class="label">Gastos fijos / mes</div><div class="value">${money(fixed)}</div><span class="delta">Promedio últimos 3 meses</span></div>
        <div class="card kpi"><div class="label">Costo variable</div><div class="value">${pct(varRatio)}</div><span class="delta">Comisiones + insumos sobre ingresos</span></div>
        <div class="card kpi hero"><div class="label">Punto de equilibrio</div><div class="value">${breakEven.toLocaleString("es-CO")} serv./mes</div><span class="delta">Hoy: ${Math.round(svcCount).toLocaleString("es-CO")} serv./mes · ticket ${money(ticket)}</span></div>
      </div>
      <div class="grid cols-2">
        <div class="card">
          <div class="card-h"><div><h3>Proyección a 6 meses</h3><p>Real (línea continua) vs. proyectado (punteada)</p></div>
            <div class="legend"><span><i style="background:${C.s1}"></i>Ingresos</span><span><i style="background:${C.s2}"></i>Utilidad neta</span><span><i class="dash" style="--c:${C.muted}"></i>Proyectado</span></div></div>
          <div class="chart-box"><canvas id="chProj" aria-label="Proyección de ingresos y utilidad"></canvas></div>
        </div>
        <div class="card">
          <div class="card-h"><div><h3>Escenario</h3><p>Ajusta los supuestos</p></div></div>
          <div class="field"><label>Crecimiento extra de ingresos: <b id="gVal"></b> mensual</label><input type="range" class="range" id="gRange" min="-15" max="20" step="1" value="${ui.projGrowth}"></div>
          <div class="field"><label>Aumento de gastos fijos: <b id="eVal"></b> mensual</label><input type="range" class="range" id="eRange" min="0" max="10" step="0.5" value="${ui.projExp}"></div>
          <div class="form-grid">
            <div class="field"><label>Nueva inversión (COP)</label><input type="number" id="invAmt" min="0" step="100000" value="${ui.projInvest || ""}" placeholder="0"></div>
            <div class="field"><label>En el mes</label><select id="invMonth">${Array.from({ length: 6 }, (_, i) => `<option value="${i + 1}" ${+ui.projInvestMonth === i + 1 ? "selected" : ""}>${monthLabel(addMonths(mk, i))}</option>`).join("")}</select></div>
          </div>
          <div id="projSummary"></div>
          <p class="note">Modelo: tendencia lineal de los últimos 6 meses completos + tu escenario. Es una guía, no una garantía.</p>
        </div>
      </div>
      <div class="card" style="margin-top:16px"><div class="card-h"><div><h3>Detalle proyectado</h3></div></div><div class="table-wrap" id="projTable"></div></div>`;

    const draw = () => {
      charts.forEach((c) => c.destroy()); charts = [];
      $("#gVal").textContent = (ui.projGrowth > 0 ? "+" : "") + ui.projGrowth + "%";
      $("#eVal").textContent = "+" + ui.projExp + "%";
      const p = project();
      const labels = [...histKeys.map(monthLabel), ...p.map((x) => monthLabel(x.key))];
      const pad = (arr, before) => [...Array(before).fill(null), ...arr];
      const lastH = hist[n - 1];
      const revH = hist.map((h) => h.revenue), netH = hist.map((h) => h.net);
      const common = { borderWidth: 2, tension: 0.3, pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: C.surface, spanGaps: false };
      mkChart("chProj", {
        type: "line",
        data: { labels, datasets: [
          { ...common, label: "Ingresos", data: [...revH, ...Array(6).fill(null)], borderColor: C.s1, pointBackgroundColor: C.s1 },
          { ...common, label: "Ingresos proyectados", data: pad([lastH.revenue, ...p.map((x) => x.revenue)], n - 1), borderColor: C.s1, borderDash: [6, 5], pointBackgroundColor: C.s1, endLabel: "Ingresos" },
          { ...common, label: "Utilidad neta", data: [...netH, ...Array(6).fill(null)], borderColor: C.s2, pointBackgroundColor: C.s2 },
          { ...common, label: "Utilidad proyectada", data: pad([lastH.net, ...p.map((x) => x.net)], n - 1), borderColor: C.s2, borderDash: [6, 5], pointBackgroundColor: C.s2, endLabel: "Utilidad" },
        ] },
        options: { maintainAspectRatio: false, layout: { padding: { right: 62 } }, interaction: { mode: "index", intersect: false }, scales: { y: moneyAxis, x: catAxis },
          plugins: { endLabels: { enabled: true }, tooltip: { filter: (it, i, all) => it.parsed.y != null && !(it.dataIndex === n - 1 && /proyect/.test(it.dataset.label)), callbacks: { label: moneyTip } } } },
      });
      const tot = p.reduce((a, x) => ({ revenue: a.revenue + x.revenue, net: a.net + x.net }), { revenue: 0, net: 0 });
      $("#projSummary").innerHTML = `
        <div class="stat-row"><span>Ingresos proyectados (6 m)</span><b>${money(tot.revenue)}</b></div>
        <div class="stat-row"><span>Utilidad proyectada (6 m)</span><b>${money(tot.net)}</b></div>
        <div class="stat-row"><span>Flujo de caja acumulado${ui.projInvest ? " (con inversión)" : ""}</span><b>${money(p[5].cash)}</b></div>
        ${ui.projInvest ? `<div class="stat-row"><span>Recuperación de la inversión</span><b>${tot.net > 0 ? Math.ceil(ui.projInvest / (tot.net / 6)) + " meses aprox." : "No se recupera en este escenario"}</b></div>` : ""}`;
      $("#projTable").innerHTML = `<table><thead><tr><th>Mes</th><th class="num">Ingresos</th><th class="num">Costos variables</th><th class="num">Gastos fijos</th><th class="num">Utilidad neta</th><th class="num">Inversión</th><th class="num">Caja acumulada</th></tr></thead><tbody>
        ${p.map((x) => `<tr><td>${monthLabel(x.key)}</td><td class="num">${money(x.revenue)}</td><td class="num">${money(x.variable)}</td><td class="num">${money(x.fixed)}</td><td class="num"><b>${money(x.net)}</b></td><td class="num">${x.inv ? money(x.inv) : "—"}</td><td class="num">${money(x.cash)}</td></tr>`).join("")}</tbody></table>`;
    };
    $("#gRange").oninput = (e) => { ui.projGrowth = +e.target.value; draw(); };
    $("#eRange").oninput = (e) => { ui.projExp = +e.target.value; draw(); };
    $("#invAmt").oninput = (e) => { ui.projInvest = +e.target.value || 0; draw(); };
    $("#invMonth").onchange = (e) => { ui.projInvestMonth = +e.target.value; draw(); };
    draw();
  }

  /* ============================================================
     BARBEROS
     ============================================================ */
  function barberos() {
    $("#topActions").innerHTML = `<button class="btn btn-gold" id="newB">+ Nuevo barbero</button>`;
    $("#newB").onclick = () => barberModal();
    const mk = monthKey(today());
    const stats = barberStats(monthSummary(mk).done);
    $("#content").innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Barbero</th><th>Rol</th><th class="num">Comisión</th><th class="num">Servicios (mes)</th><th class="num">Producido (mes)</th><th>Estado</th><th></th></tr></thead>
      <tbody>${data.barbers.map((b) => { const s = stats.find((x) => x.id === b.id) || { n: 0, revenue: 0 }; return `<tr>
        <td><div class="who"><span class="avatar">${b.photo_url ? `<img src="${esc(b.photo_url)}" alt="">` : esc(initials(b.name))}</span><b>${esc(b.name)}</b></div></td>
        <td>${esc(b.role || "")}</td><td class="num">${b.commission_pct}%</td><td class="num">${s.n}</td><td class="num">${money(s.revenue)}</td>
        <td>${b.active ? `<span class="status st-completada">Activo</span>` : `<span class="status st-cancelada">Inactivo</span>`}</td>
        <td style="white-space:nowrap"><button class="icon-btn" data-edit-b="${b.id}" title="Editar">✎</button><button class="icon-btn" data-del-b="${b.id}" title="Eliminar">✕</button></td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">Aún no hay barberos</td></tr>`}</tbody></table></div>
      <p class="note">Los barberos inactivos no aparecen en la web ni en las reservas online, pero su historial se conserva.</p>`;
    $$("[data-edit-b]").forEach((b) => (b.onclick = () => barberModal(barberById(b.dataset.editB))));
    $$("[data-del-b]").forEach((b) => (b.onclick = () => removeWithHistory("barbers", b.dataset.delB, data.reservations.some((r) => r.barber_id === b.dataset.delB))));
  }
  function barberModal(b) {
    modal(b ? "Editar barbero" : "Nuevo barbero", [
      { k: "name", label: "Nombre", req: true, full: true },
      { k: "role", label: "Rol / especialidad", def: "Barbero" },
      { k: "commission_pct", label: "Comisión (%)", type: "number", min: 0, max: 100, step: 0.5, def: 50, req: true },
      { k: "photo_url", label: "URL de foto (opcional)", full: true },
      { k: "bio", label: "Biografía corta", type: "textarea", full: true },
      { k: "active", label: "Activo (visible en la web)", type: "checkbox", def: true },
    ], b, async (v) => {
      if (b) await DB.update("barbers", b.id, v); else await DB.insert("barbers", v);
      await reload(); render(); toast("Barbero guardado");
    });
  }
  async function removeWithHistory(table, id, hasHistory) {
    if (hasHistory) {
      if (!confirm("Tiene reservas en el historial. Para no perder las finanzas se marcará como INACTIVO en lugar de eliminarse. ¿Continuar?")) return;
      await DB.update(table, id, { active: false });
    } else {
      if (!confirm("¿Eliminar definitivamente?")) return;
      await DB.remove(table, id);
    }
    await reload(); render(); toast("Listo");
  }

  /* ============================================================
     SERVICIOS
     ============================================================ */
  function servicios() {
    $("#topActions").innerHTML = `<button class="btn btn-gold" id="newS">+ Nuevo servicio</button>`;
    $("#newS").onclick = () => serviceModal();
    const done = data.reservations.filter((r) => r.status === "completada");
    $("#content").innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Servicio</th><th class="num">Precio</th><th class="num">Duración</th><th class="num">Vendidos (total)</th><th>Estado</th><th></th></tr></thead>
      <tbody>${[...data.services].sort((a, b) => a.price - b.price).map((s) => `<tr>
        <td><b>${esc(s.name)}</b><br><small style="color:var(--muted)">${esc(s.description || "")}</small></td>
        <td class="num">${money(s.price)}</td><td class="num">${s.duration_min} min</td><td class="num">${done.filter((r) => r.service_id === s.id).length.toLocaleString("es-CO")}</td>
        <td>${s.active ? `<span class="status st-completada">Activo</span>` : `<span class="status st-cancelada">Inactivo</span>`}</td>
        <td style="white-space:nowrap"><button class="icon-btn" data-edit-s="${s.id}" title="Editar">✎</button><button class="icon-btn" data-del-s="${s.id}" title="Eliminar">✕</button></td></tr>`).join("") || `<tr><td colspan="6" class="empty">Aún no hay servicios</td></tr>`}</tbody></table></div>
      <p class="note">Cambiar un precio no altera las reservas ya registradas.</p>`;
    $$("[data-edit-s]").forEach((b) => (b.onclick = () => serviceModal(serviceById(b.dataset.editS))));
    $$("[data-del-s]").forEach((b) => (b.onclick = () => removeWithHistory("services", b.dataset.delS, data.reservations.some((r) => r.service_id === b.dataset.delS))));
  }
  function serviceModal(s) {
    modal(s ? "Editar servicio" : "Nuevo servicio", [
      { k: "name", label: "Nombre", req: true, full: true },
      { k: "price", label: "Precio (COP)", type: "number", min: 0, step: 1000, req: true },
      { k: "duration_min", label: "Duración (min)", type: "number", min: 5, step: 5, def: 30, req: true },
      { k: "description", label: "Descripción", type: "textarea", full: true },
      { k: "active", label: "Activo (visible en la web)", type: "checkbox", def: true },
    ], s, async (v) => {
      if (s) await DB.update("services", s.id, v); else await DB.insert("services", v);
      await reload(); render(); toast("Servicio guardado");
    });
  }

  /* ============================================================
     AJUSTES
     ============================================================ */
  function ajustes() {
    $("#content").innerHTML = `<div class="grid cols-2b">
      <form class="card" id="setForm"><div class="card-h"><div><h3>Metas</h3><p>Se usa en el dashboard</p></div></div>
        <div class="field"><label>Meta de facturación mensual (COP)</label><input name="monthly_goal" type="number" min="0" step="100000" value="${+data.settings.monthly_goal || ""}"></div>
        <button class="btn btn-gold">Guardar</button></form>
      <div class="card"><div class="card-h"><div><h3>Conexión</h3></div></div>
        <div class="stat-row"><span>Modo</span><b>${DB.mode === "demo" ? "Demo (navegador)" : "Supabase"}</b></div>
        <div class="stat-row"><span>Barberos</span><b>${data.barbers.length}</b></div>
        <div class="stat-row"><span>Servicios</span><b>${data.services.length}</b></div>
        <div class="stat-row"><span>Reservas registradas</span><b>${data.reservations.length.toLocaleString("es-CO")}</b></div>
        <div class="stat-row"><span>Movimientos</span><b>${data.transactions.length.toLocaleString("es-CO")}</b></div>
        <p class="note">Nombre, contacto, horario y colores de la web se cambian en <code>config.js</code>.</p>
        ${DB.mode === "demo" ? `<button class="btn btn-danger" id="resetDemo" style="margin-top:14px">Restablecer datos de ejemplo</button>` : ""}
      </div></div>`;
    $("#setForm").onsubmit = async (e) => {
      e.preventDefault();
      try { await DB.saveSettings({ monthly_goal: +e.target.monthly_goal.value || 0 }); await reload(); toast("Ajustes guardados"); } catch (err) { toast("Error: " + err.message); }
    };
    const rd = $("#resetDemo");
    if (rd) rd.onclick = async () => { if (!confirm("Se borrarán los cambios hechos en la demo.")) return; DB.reset(); await reload(); render(); toast("Demo restablecida"); };
  }
})();
