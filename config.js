/* ============================================================
   CONFIGURACIÓN POR BARBERÍA
   Esto es lo único que cambias al vender la plantilla a otro cliente.
   ============================================================ */
window.BARBER_CONFIG = {
  // --- Supabase (dejar vacío = MODO DEMO con datos de ejemplo en el navegador) ---
  supabaseUrl: "",       // ej: "https://xxxx.supabase.co"
  supabaseAnonKey: "",   // clave "anon / publishable" del proyecto

  // --- Marca ---
  brand: {
    name: "Imperial",
    suffix: "Barber Club",
    tagline: "El arte del corte clásico, con precisión moderna.",
    logoLetter: "I",
    founded: 2019,
  },

  // --- Contacto ---
  contact: {
    phone: "+57 300 123 4567",
    whatsapp: "573001234567",       // sin + ni espacios
    email: "hola@imperialbarber.co",
    address: "Cra. 13 #85-32, Bogotá, Colombia",
    instagram: "imperialbarber.co",
    mapsQuery: "Cra. 13 #85-32 Bogotá",
  },

  // --- Horario (reservas online) ---
  hours: {
    open: 9,          // 9:00
    close: 20,        // 20:00
    slotMinutes: 30,
    closedWeekdays: [0], // 0 = domingo
    label: "Lun – Sáb · 9:00 a 20:00",
  },

  // --- Moneda ---
  locale: "es-CO",
  currency: "COP",

  // --- Galería: pon URLs de fotos reales del cliente (si está vacío se ven placeholders con estilo) ---
  gallery: [
    // { src: "https://.../foto1.jpg", title: "Fade clásico" },
  ],

  // --- Testimonios ---
  testimonials: [
    { name: "Andrés M.", text: "El mejor fade de Bogotá. Puntuales, limpios y con un ambiente brutal.", stars: 5 },
    { name: "Felipe R.", text: "Reservé en 30 segundos desde el celular. La barba quedó perfecta.", stars: 5 },
    { name: "Juan David C.", text: "Atención de primera. Se nota el detalle en cada corte.", stars: 5 },
  ],
};
