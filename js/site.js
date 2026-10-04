/* ============================================================
   Web pública: branding desde config, render de servicios/equipo,
   animaciones (GSAP), tarjetas 3D, carrusel 3D y reservas.
   ============================================================ */
(async function () {
  const CFG = window.BARBER_CONFIG;
  const { money, esc, initials, iso } = window.UTIL;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) document.documentElement.classList.add("reduced");

  /* ---------- Branding ---------- */
  document.title = `${CFG.brand.name} ${CFG.brand.suffix} · Reserva online`;
  $$("[data-brand]").forEach((el) => (el.textContent = CFG.brand[el.dataset.brand] ?? ""));
  $$("[data-contact]").forEach((el) => (el.textContent = CFG.contact[el.dataset.contact] ?? ""));
  $$("[data-hours]").forEach((el) => (el.textContent = CFG.hours.label));
  $("#year").textContent = new Date().getFullYear();
  $("#yearsOpen").textContent = Math.max(1, new Date().getFullYear() - CFG.brand.founded) + "+";
  $("#telLink").href = "tel:" + CFG.contact.phone.replace(/\s/g, "");
  $("#mailLink").href = "mailto:" + CFG.contact.email;
  $("#igLink").href = "https://instagram.com/" + CFG.contact.instagram;
  $("#igLink").textContent = "@" + CFG.contact.instagram;
  $("#waFloat").href = `https://wa.me/${CFG.contact.whatsapp}?text=${encodeURIComponent("Hola, quiero información sobre sus servicios")}`;
  $("#mapFrame").src = "https://www.google.com/maps?output=embed&q=" + encodeURIComponent(CFG.contact.mapsQuery);
  if (DB.mode === "demo") document.body.insertAdjacentHTML("beforeend", `<div class="demo-badge">Modo demo · datos de ejemplo</div>`);

  /* ---------- Nav ---------- */
  const nav = $("#nav");
  addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 40), { passive: true });
  $("#burger").onclick = () => document.body.classList.toggle("menu-open");
  $$("#navLinks a").forEach((a) => (a.onclick = () => document.body.classList.remove("menu-open")));

  /* ---------- Datos ---------- */
  let services = [], barbers = [];
  try {
    [services, barbers] = await Promise.all([DB.list("services"), DB.list("barbers")]);
    services = services.filter((s) => s.active).sort((a, b) => a.price - b.price);
    barbers = barbers.filter((b) => b.active);
  } catch (e) { console.error(e); }
  $("#statBarbers").dataset.count = barbers.length || 4;

  /* ---------- Servicios ---------- */
  $("#servicesGrid").innerHTML = services.map((s, i) => `
    <article class="svc reveal" data-id="${s.id}">
      <span class="num">${String(i + 1).padStart(2, "0")}</span>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description || "")}</p>
      <div class="svc-foot">
        <div><span class="svc-price">${money(s.price)}</span><span class="svc-dur">${s.duration_min} min</span></div>
        <button class="svc-btn" aria-label="Reservar ${esc(s.name)}" data-book="${s.id}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </button>
      </div>
    </article>`).join("");

  /* ---------- Equipo ---------- */
  $("#teamGrid").innerHTML = barbers.map((b) => `
    <div class="flip reveal" tabindex="0">
      <div class="flip-inner">
        <div class="flip-face flip-front">
          <div class="portrait">${b.photo_url ? `<img src="${esc(b.photo_url)}" alt="${esc(b.name)}" loading="lazy">` : `<span class="mono">${esc(initials(b.name))}</span>`}</div>
          <div><span>${esc(b.role || "Barbero")}</span><h3>${esc(b.name)}</h3></div>
        </div>
        <div class="flip-face flip-back">
          <h3>${esc(b.name)}</h3>
          <p>${esc(b.bio || "Pasión por el oficio y el detalle.")}</p>
          <button class="btn" data-barber="${b.id}">Reservar con él</button>
        </div>
      </div>
    </div>`).join("");
  $$(".flip").forEach((f) => f.addEventListener("click", (e) => { if (!e.target.closest("[data-barber]")) f.classList.toggle("flipped"); }));

  /* ---------- Testimonios ---------- */
  $("#testiGrid").innerHTML = CFG.testimonials.map((t) => `
    <div class="testi reveal"><div class="stars">${"★".repeat(t.stars)}</div><p>${esc(t.text)}</p><b>— ${esc(t.name)}</b></div>`).join("");

  /* ---------- Galería 3D ---------- */
  const galleryItems = CFG.gallery.length ? CFG.gallery : ["Skin Fade", "Barba Clásica", "Pompadour", "Crop Texturizado", "Afeitado", "Diseño", "Buzz Cut", "Slick Back"].map((title) => ({ title }));
  const ring = $("#galleryRing");
  const count = galleryItems.length;
  const radius = () => (innerWidth < 820 ? 260 : 420);
  ring.innerHTML = galleryItems.map((g, i) => `
    <figure class="g-item" style="--ang:${45 + i * 30}deg">
      ${g.src ? `<img src="${esc(g.src)}" alt="${esc(g.title || "")}" loading="lazy" draggable="false"><figcaption>${esc(g.title || "")}</figcaption>`
              : `<div class="ph"><small>Estilo ${String(i + 1).padStart(2, "0")}</small><b>${esc(g.title)}</b></div>`}
    </figure>`).join("");
  const items = $$(".g-item", ring);
  const place = () => items.forEach((el, i) => (el.style.transform = `rotateY(${(360 / count) * i}deg) translateZ(${radius()}px)`));
  place(); addEventListener("resize", place);
  let rot = 0, vel = reduce ? 0 : 0.12, drag = null;
  const stage = $("#galleryStage");
  stage.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, r: rot }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener("pointermove", (e) => { if (!drag) return; const nr = drag.r + (e.clientX - drag.x) * 0.3; vel = nr - rot; rot = nr; });
  stage.addEventListener("pointerup", () => (drag = null));
  (function spin() {
    if (!drag) { rot += vel; vel += ((reduce ? 0 : 0.12) - vel) * 0.02; }
    ring.style.transform = `translateZ(-${radius()}px) rotateX(-6deg) rotateY(${rot}deg)`;
    requestAnimationFrame(spin);
  })();

  /* ---------- Tilt 3D de tarjetas ---------- */
  function tilt(el, max = 10) {
    if (reduce || matchMedia("(hover: none)").matches) return;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.transform = `rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateZ(0)`;
      el.style.setProperty("--mx", x * 100 + "%"); el.style.setProperty("--my", y * 100 + "%");
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  }
  $$(".svc").forEach((el) => tilt(el));
  const av = $("#aboutVisual");
  if (!reduce) av.addEventListener("pointermove", (e) => {
    const r = av.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    $(".c1", av).style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg)`;
    $(".c2", av).style.transform = `translateZ(60px) rotateY(${x * 22}deg) rotateX(${-y * 22}deg) translate(${x * 20}px, ${y * 20}px)`;
  });

  /* ---------- Animaciones ---------- */
  const counters = () => $$("[data-count]").forEach((el) => {
    const target = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0;
    const o = { v: 0 };
    const fmt = (v) => (dec ? v.toFixed(dec) : Math.round(v).toLocaleString("es-CO")) + (target >= 1000 ? "+" : "");
    if (!window.gsap || reduce) return (el.textContent = fmt(target));
    gsap.to(o, { v: target, duration: 2.2, ease: "power2.out", onUpdate: () => (el.textContent = fmt(o.v)) });
  });

  let started = false;
  function startAnimations() {
    if (started) return;
    started = true;
    $("#preloader").classList.add("done");
    if (!window.gsap || reduce) { $$(".reveal").forEach((el) => (el.style.opacity = 1)); counters(); return; }
    gsap.registerPlugin(ScrollTrigger);
    gsap.from(".hero h1 .line > span", { yPercent: 110, duration: 1.3, ease: "power4.out", stagger: 0.12, delay: 0.1 });
    gsap.from(".hero-anim", { y: 30, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.12, delay: 0.5, onComplete: counters });
    gsap.from(".nav", { y: -80, opacity: 0, duration: 1, ease: "power3.out", delay: 0.3 });
    $$(".reveal").forEach((el) => {
      const siblings = el.parentElement.querySelectorAll(":scope > .reveal");
      const idx = [...siblings].indexOf(el);
      gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: (idx % 4) * 0.1, scrollTrigger: { trigger: el, start: "top 88%" } });
    });
    gsap.to(".big-monogram", { rotateY: 360, ease: "none", scrollTrigger: { trigger: "#experiencia", start: "top bottom", end: "bottom top", scrub: 1 } });
    gsap.to(".marquee-track", { x: -200, ease: "none", scrollTrigger: { trigger: ".marquee", start: "top bottom", end: "bottom top", scrub: 1 } });
  }
  if (document.readyState === "complete") setTimeout(startAnimations, 300);
  else { addEventListener("load", () => setTimeout(startAnimations, 300)); setTimeout(startAnimations, 3500); }

  /* ============================================================
     RESERVAS
     ============================================================ */
  const state = { step: 0, service: null, barber: null, date: null, time: null, name: "", phone: "", email: "", busy: [] };
  const body = $("#stepBody"), msg = $("#formMsg"), prev = $("#prevBtn"), next = $("#nextBtn");
  const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  function upcomingDays(n = 21) {
    const out = []; const d = new Date(); d.setHours(0, 0, 0, 0);
    while (out.length < n) { if (!CFG.hours.closedWeekdays.includes(d.getDay())) out.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return out;
  }
  function slotsFor() {
    const dur = state.service.duration_min, step = CFG.hours.slotMinutes;
    const now = new Date(), isToday = state.date === iso(now);
    const nowMin = now.getHours() * 60 + now.getMinutes() + 30;
    const busy = state.busy.map((b) => [toMin(b.time), toMin(b.time) + (b.dur || step)]);
    const out = [];
    for (let m = CFG.hours.open * 60; m + dur <= CFG.hours.close * 60; m += step) {
      const taken = busy.some(([a, b]) => m < b && m + dur > a);
      out.push({ t: toHHMM(m), ok: !taken && !(isToday && m < nowMin) });
    }
    return out;
  }

  const svc = () => state.service, brb = () => state.barber;
  function render() {
    $$("#steps span").forEach((s, i) => s.classList.toggle("on", i <= state.step));
    msg.textContent = "";
    prev.style.visibility = state.step === 0 || state.step === 4 ? "hidden" : "visible";
    $("#stepNav").style.display = state.step === 4 ? "none" : "flex";
    next.textContent = state.step === 3 ? "Confirmar reserva" : "Continuar";

    if (state.step === 0) {
      body.innerHTML = `<div class="step"><h3>1. Elige tu servicio</h3><div class="opt-grid">${services.map((s) => `
        <button class="opt ${svc()?.id === s.id ? "sel" : ""}" data-s="${s.id}"><b>${esc(s.name)}</b><small>${s.duration_min} min</small><span class="p">${money(s.price)}</span></button>`).join("")}</div></div>`;
      $$("[data-s]", body).forEach((b) => (b.onclick = () => { state.service = services.find((s) => s.id === b.dataset.s); state.time = null; render(); }));
      next.disabled = !svc();
    }
    if (state.step === 1) {
      body.innerHTML = `<div class="step"><h3>2. Elige tu barbero</h3><div class="opt-grid">${barbers.map((b) => `
        <button class="opt ${brb()?.id === b.id ? "sel" : ""}" data-b="${b.id}"><b>${esc(b.name)}</b><small>${esc(b.role || "")}</small></button>`).join("")}</div></div>`;
      $$("[data-b]", body).forEach((b) => (b.onclick = () => { state.barber = barbers.find((x) => x.id === b.dataset.b); state.time = null; render(); }));
      next.disabled = !brb();
    }
    if (state.step === 2) {
      const days = upcomingDays();
      if (!state.date) state.date = iso(days[0]);
      body.innerHTML = `<div class="step"><h3>3. Día y hora</h3>
        <div class="dates">${days.map((d) => `<button class="date-chip ${iso(d) === state.date ? "sel" : ""}" data-d="${iso(d)}"><small>${DAYS[d.getDay()]}</small><b>${d.getDate()}</b><small>${MONTHS[d.getMonth()]}</small></button>`).join("")}</div>
        <div class="slots" id="slots"><span class="muted">Cargando horarios…</span></div></div>`;
      $$("[data-d]", body).forEach((b) => (b.onclick = () => { state.date = b.dataset.d; state.time = null; render(); }));
      next.disabled = !state.time;
      loadSlots();
    }
    if (state.step === 3) {
      body.innerHTML = `<div class="step"><h3>4. Tus datos</h3>
        <div class="field"><label for="fName">Nombre completo</label><input id="fName" autocomplete="name" value="${esc(state.name)}" maxlength="80" required></div>
        <div class="field"><label for="fPhone">Celular / WhatsApp</label><input id="fPhone" type="tel" autocomplete="tel" value="${esc(state.phone)}" maxlength="20" required></div>
        <div class="field"><label for="fEmail">Email (opcional)</label><input id="fEmail" type="email" autocomplete="email" value="${esc(state.email)}"></div>
        <div class="summary">
          <div><span>Servicio</span><b>${esc(svc().name)}</b></div>
          <div><span>Barbero</span><b>${esc(brb().name)}</b></div>
          <div><span>Fecha</span><b>${prettyDate(state.date)} · ${state.time}</b></div>
          <div class="total"><span>Total</span><b>${money(svc().price)}</b></div>
        </div></div>`;
      ["Name", "Phone", "Email"].forEach((k) => ($("#f" + k).oninput = (e) => (state[k.toLowerCase()] = e.target.value)));
      next.disabled = false;
    }
    if (state.step === 4) {
      const wa = `https://wa.me/${CFG.contact.whatsapp}?text=${encodeURIComponent(`Hola, acabo de reservar: ${svc().name} con ${brb().name} el ${prettyDate(state.date)} a las ${state.time}. A nombre de ${state.name}.`)}`;
      body.innerHTML = `<div class="success"><div class="check"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5L20 7"/></svg></div>
        <h3 style="font-family:var(--serif);font-size:1.8rem">¡Reserva recibida!</h3>
        <p class="muted" style="margin:10px 0 24px">${esc(svc().name)} con ${esc(brb().name)}<br>${prettyDate(state.date)} a las ${state.time}</p>
        <a class="btn btn-gold" href="${wa}" target="_blank" rel="noopener">Confirmar por WhatsApp</a>
        <p style="margin-top:18px"><button class="btn btn-ghost" id="againBtn">Hacer otra reserva</button></p></div>`;
      $("#againBtn").onclick = () => { Object.assign(state, { step: 0, service: null, barber: null, date: null, time: null }); render(); };
    }
  }
  const prettyDate = (s) => { const d = new Date(s + "T00:00:00"); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };

  async function loadSlots() {
    const wanted = state.date + state.barber.id;
    try { state.busy = await DB.busySlots(state.barber.id, state.date); } catch (e) { state.busy = []; msg.textContent = "No se pudo cargar la disponibilidad."; }
    if (wanted !== state.date + state.barber.id || state.step !== 2) return;
    const list = slotsFor();
    const box = $("#slots");
    box.innerHTML = list.some((s) => s.ok)
      ? list.map((s) => `<button class="slot ${state.time === s.t ? "sel" : ""}" data-t="${s.t}" ${s.ok ? "" : "disabled"}>${s.t}</button>`).join("")
      : `<span class="muted">No hay horarios disponibles este día. Prueba otra fecha.</span>`;
    $$("[data-t]", box).forEach((b) => (b.onclick = () => { state.time = b.dataset.t; $$(".slot", box).forEach((x) => x.classList.toggle("sel", x === b)); next.disabled = false; }));
  }

  prev.onclick = () => { state.step--; render(); };
  next.onclick = async () => {
    if (state.step < 3) { state.step++; render(); return; }
    const name = state.name.trim(), phone = state.phone.replace(/[^\d+]/g, "");
    if (name.length < 2) return (msg.textContent = "Escribe tu nombre.");
    if (phone.length < 7) return (msg.textContent = "Escribe un celular válido.");
    next.disabled = true; next.textContent = "Enviando…";
    try {
      await DB.createReservation({ client_name: name, client_phone: phone, client_email: state.email.trim() || null, barber_id: state.barber.id, service_id: state.service.id, date: state.date, time: state.time });
      state.step = 4; render();
    } catch (e) {
      msg.textContent = e.message || "No se pudo guardar la reserva.";
      next.disabled = false; next.textContent = "Confirmar reserva";
    }
  };

  document.addEventListener("click", (e) => {
    const s = e.target.closest("[data-book]"), b = e.target.closest("[data-barber]");
    if (s) { state.service = services.find((x) => x.id === s.dataset.book); state.step = 1; state.time = null; }
    else if (b) { state.barber = barbers.find((x) => x.id === b.dataset.barber); state.step = state.service ? 2 : 0; state.time = null; }
    else return;
    render();
    $("#reservar").scrollIntoView({ behavior: "smooth" });
  });
  render();

  /* Acceso oculto al panel: escribe A → D → M en menos de 2 s */
  (function () {
    const SEQ = ["a", "d", "m"];
    let buf = [], timer = null;
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (!SEQ.includes(k)) { buf = []; return; }
      buf.push(k);
      clearTimeout(timer);
      timer = setTimeout(() => { buf = []; }, 2000);
      if (buf.length === SEQ.length) {
        if (buf.every((v, i) => v === SEQ[i])) window.location.href = "admin.html";
        buf = [];
      }
    });
  })();
})();
