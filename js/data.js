/* ============================================================
   Capa de datos: Supabase si está configurado, si no MODO DEMO
   (localStorage con datos de ejemplo). La web y el admin solo
   hablan con window.DB, así que da igual cuál esté activo.
   ============================================================ */
(function () {
  const CFG = window.BARBER_CONFIG;
  const useSupabase = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  const TABLES = ["barbers", "services", "reservations", "transactions"];

  const fmtMoney = new Intl.NumberFormat(CFG.locale, { style: "currency", currency: CFG.currency, maximumFractionDigits: 0 });
  const iso = (d) => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };

  /* ---------------- SUPABASE ---------------- */
  function supabaseStore() {
    const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    const orderBy = { reservations: "date", transactions: "date", barbers: "created_at", services: "price" };
    const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

    return {
      mode: "supabase",
      async list(table) {
        const all = [];
        const page = 1000;
        for (let from = 0; ; from += page) {
          const rows = ok(await sb.from(table).select("*").order(orderBy[table] || "created_at", { ascending: true }).range(from, from + page - 1));
          all.push(...rows);
          if (rows.length < page) break;
        }
        return all;
      },
      async insert(table, row) { return ok(await sb.from(table).insert(row).select().single()); },
      async update(table, id, patch) { return ok(await sb.from(table).update(patch).eq("id", id).select().single()); },
      async remove(table, id) { ok(await sb.from(table).delete().eq("id", id)); },
      async busySlots(barberId, date) {
        const rows = ok(await sb.rpc("get_busy_slots", { p_barber: barberId, p_date: date }));
        return rows.map((r) => ({ time: String(r.slot).slice(0, 5), dur: r.duration_min }));
      },
      // Público: sin .select() porque el visitante no tiene permiso de lectura
      async createReservation(r) {
        const { error } = await sb.from("reservations").insert(r);
        if (error) {
          if (error.code === "23505") throw new Error("Ese horario acaba de ser reservado. Elige otro, por favor.");
          throw new Error(error.message);
        }
      },
      async getSettings() {
        const { data } = await sb.from("settings").select("*").eq("id", 1).maybeSingle();
        return data || { monthly_goal: 15000000 };
      },
      async saveSettings(patch) { return ok(await sb.from("settings").upsert({ id: 1, ...patch, updated_at: new Date().toISOString() }).select().single()); },
      auth: {
        async session() {
          const { data } = await sb.auth.getSession();
          if (!data.session) return null;
          const { data: adm } = await sb.from("admins").select("user_id").eq("user_id", data.session.user.id).maybeSingle();
          return adm ? data.session.user : { ...data.session.user, notAdmin: true };
        },
        async signIn(email, password) {
          const { error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw new Error("Credenciales incorrectas");
        },
        async signOut() { await sb.auth.signOut(); },
      },
    };
  }

  /* ---------------- DEMO (localStorage) ---------------- */
  function demoStore() {
    const KEY = "barberia_demo_v1";
    let mem = null;
    const load = () => {
      if (mem) return mem;
      try { mem = JSON.parse(localStorage.getItem(KEY)); } catch (_) { mem = null; }
      if (!mem || !mem.barbers) { mem = seed(); save(); }
      return mem;
    };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (_) {} };
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
    const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120));

    return {
      mode: "demo",
      async list(table) { return delay(structuredClone(load()[table])); },
      async insert(table, row) {
        const db = load();
        const rec = { id: uid(), created_at: new Date().toISOString(), ...row };
        if (table === "reservations" && rec.price == null) rec.price = db.services.find((s) => s.id === rec.service_id)?.price ?? 0;
        db[table].push(rec); save(); return delay(rec);
      },
      async update(table, id, patch) {
        const db = load(); const i = db[table].findIndex((r) => r.id === id);
        if (i < 0) throw new Error("No encontrado");
        db[table][i] = { ...db[table][i], ...patch }; save(); return delay(db[table][i]);
      },
      async remove(table, id) { const db = load(); db[table] = db[table].filter((r) => r.id !== id); save(); return delay(); },
      async busySlots(barberId, date) {
        const db = load();
        return delay(db.reservations.filter((r) => r.barber_id === barberId && r.date === date && r.status !== "cancelada")
          .map((r) => ({ time: r.time.slice(0, 5), dur: db.services.find((s) => s.id === r.service_id)?.duration_min || 30 })));
      },
      async createReservation(r) {
        const db = load();
        if (db.reservations.some((x) => x.barber_id === r.barber_id && x.date === r.date && x.time === r.time && x.status !== "cancelada"))
          throw new Error("Ese horario acaba de ser reservado. Elige otro, por favor.");
        await this.insert("reservations", { ...r, status: "pendiente", price: db.services.find((s) => s.id === r.service_id)?.price ?? 0 });
      },
      async getSettings() { return delay({ ...load().settings }); },
      async saveSettings(patch) { const db = load(); db.settings = { ...db.settings, ...patch }; save(); return delay(db.settings); },
      reset() { mem = seed(); save(); },
      auth: {
        async session() { return sessionStorage.getItem("demo_admin") ? { email: "demo@barberia.co" } : null; },
        async signIn() { sessionStorage.setItem("demo_admin", "1"); },
        async signOut() { sessionStorage.removeItem("demo_admin"); },
      },
    };
  }

  /* ---------------- Datos de ejemplo ---------------- */
  function seed() {
    let s = 42;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const id = (p, i) => `${p}-${i}`;

    const barbers = [
      { name: 'Carlos "El Maestro" Ruiz', role: "Master Barber", bio: "15 años perfeccionando el corte clásico y el afeitado a navaja.", commission_pct: 50, w: 1.25 },
      { name: "Sebastián Gómez", role: "Fade Specialist", bio: "Degradados impecables y diseños con precisión milimétrica.", commission_pct: 45, w: 1.1 },
      { name: "Mateo Ríos", role: "Beard Artist", bio: "Especialista en barba, toalla caliente y ritual de afeitado.", commission_pct: 45, w: 0.95 },
      { name: "Daniel Herrera", role: "Barbero Junior", bio: "Tendencias urbanas, texturas y cortes modernos.", commission_pct: 40, w: 0.7 },
    ].map((b, i) => ({ id: id("b", i), photo_url: "", active: true, created_at: "2025-01-01T00:00:00Z", ...b }));

    const services = [
      { name: "Corte Clásico", description: "Tijera y máquina, lavado y peinado con producto premium.", price: 35000, duration_min: 30, w: 3 },
      { name: "Fade / Degradado", description: "Skin fade, low, mid o high fade con acabado a navaja.", price: 40000, duration_min: 45, w: 3.5 },
      { name: "Perfilado de Barba", description: "Diseño, perfilado y toalla caliente con aceites.", price: 25000, duration_min: 30, w: 2 },
      { name: "Corte + Barba", description: "El combo completo: corte a elección y barba de lujo.", price: 55000, duration_min: 60, w: 3 },
      { name: "Afeitado Imperial", description: "Afeitado tradicional a navaja con ritual de toallas.", price: 30000, duration_min: 30, w: 1 },
      { name: "Experiencia Imperial", description: "Corte, barba, mascarilla, masaje capilar y bebida.", price: 90000, duration_min: 90, w: 0.8 },
    ].map((x, i) => ({ id: id("s", i), active: true, created_at: "2025-01-01T00:00:00Z", ...x }));

    const firstNames = ["Andrés", "Juan", "Felipe", "Santiago", "Camilo", "Nicolás", "Julián", "Diego", "Alejandro", "Tomás", "David", "Esteban", "Miguel", "Luis", "Samuel", "Óscar"];
    const lastNames = ["Pérez", "García", "Rodríguez", "Martínez", "López", "Torres", "Ramírez", "Castro", "Moreno", "Vargas", "Rojas", "Ortiz"];
    const wPick = (arr) => { const t = arr.reduce((a, x) => a + x.w, 0); let r = rnd() * t; for (const x of arr) { if ((r -= x.w) <= 0) return x; } return arr[0]; };

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today.getFullYear(), today.getMonth() - 9, 1);
    const reservations = [];
    const taken = new Set();
    let n = 0;
    for (let d = new Date(start); d <= new Date(today.getTime() + 10 * 864e5); d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0) continue;
      const monthsIn = (d.getFullYear() - start.getFullYear()) * 12 + d.getMonth() - start.getMonth();
      const future = d > today;
      const base = (future ? 5 : 12) + monthsIn * 1.1 + (d.getDay() === 5 || d.getDay() === 6 ? 7 : 0);
      const count = Math.round(base * (0.8 + rnd() * 0.4));
      for (let k = 0; k < count; k++) {
        const b = wPick(barbers), sv = wPick(services);
        const hh = 9 + Math.floor(rnd() * 11), mm = rnd() < 0.5 ? "00" : "30";
        const time = `${String(hh).padStart(2, "0")}:${mm}`;
        const date = iso(d);
        const key = b.id + date + time;
        if (taken.has(key)) continue;
        taken.add(key);
        let status;
        if (future) status = rnd() < 0.6 ? "confirmada" : "pendiente";
        else if (date === iso(today)) status = hh < new Date().getHours() ? "completada" : pick(["confirmada", "pendiente"]);
        else status = rnd() < 0.9 ? "completada" : "cancelada";
        reservations.push({
          id: id("r", n++), client_name: `${pick(firstNames)} ${pick(lastNames)}`,
          client_phone: `3${Math.floor(100000000 + rnd() * 899999999)}`, client_email: "",
          barber_id: b.id, service_id: sv.id, date, time, price: sv.price, status, notes: "",
          created_at: new Date(d.getTime() - 3 * 864e5).toISOString(),
        });
      }
    }

    const transactions = [];
    let t = 0;
    const tx = (type, category, description, amount, date, barber_id = null) =>
      transactions.push({ id: id("t", t++), type, category, description, amount: Math.round(amount / 1000) * 1000, date, barber_id, created_at: date + "T12:00:00Z" });

    tx("inversion", "Mobiliario", "4 sillas de barbero hidráulicas", 14800000, iso(start));
    tx("inversion", "Remodelación", "Adecuación del local, espejos e iluminación", 9500000, iso(new Date(start.getTime() + 3 * 864e5)));
    tx("inversion", "Equipos", "Máquinas, patilleras y esterilizador UV", 3200000, iso(new Date(start.getTime() + 5 * 864e5)));
    for (let m = 0; m <= 9; m++) {
      const d0 = new Date(start.getFullYear(), start.getMonth() + m, 1);
      if (d0 > today) break;
      const day = (x) => iso(new Date(d0.getFullYear(), d0.getMonth(), Math.min(x, today.getMonth() === d0.getMonth() && today.getFullYear() === d0.getFullYear() ? today.getDate() : 28)));
      tx("gasto", "Arriendo", "Arriendo del local", 3800000, day(1));
      tx("gasto", "Servicios públicos", "Luz, agua e internet", 520000 + rnd() * 160000, day(8));
      tx("gasto", "Nómina", "Recepcionista / aseo", 1750000, day(15));
      tx("gasto", "Marketing", "Pauta Instagram y Google", 350000 + rnd() * 250000, day(10));
      tx("gasto", "Software", "Dominio, hosting y sistema", 90000, day(3));
      tx("costo", "Insumos", "Productos: ceras, aceites, cuchillas", 700000 + m * 60000 + rnd() * 200000, day(5));
      tx("costo", "Lavandería", "Toallas y capas", 180000 + rnd() * 60000, day(20));
      tx("ingreso", "Venta de productos", "Ceras, aceites y shampoo", 450000 + m * 70000 + rnd() * 300000, day(25));
      if (m === 5) tx("inversion", "Equipos", "Lavacabezas y secadores nuevos", 4200000, day(12));
    }

    return {
      barbers: barbers.map(({ w, ...b }) => b),
      services: services.map(({ w, ...x }) => x),
      reservations, transactions,
      settings: { monthly_goal: 18000000 },
    };
  }

  window.DB = useSupabase ? supabaseStore() : demoStore();
  window.UTIL = {
    money: (v) => fmtMoney.format(Math.round(v || 0)),
    iso,
    esc: (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    initials: (name) => String(name).replace(/".*?"/g, "").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
  };
  if (!useSupabase && CFG.supabaseUrl) console.warn("Supabase configurado pero la librería no cargó: usando modo demo.");
})();
