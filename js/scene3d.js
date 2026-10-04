/* ============================================================
   Escena 3D del hero (Three.js): poste de barbero de cristal,
   anillos dorados, tijeras flotantes y polvo de oro.
   ============================================================ */
(function () {
  const canvas = document.getElementById("hero3d");
  if (!canvas || !window.THREE) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  /* --- Entorno para reflejos metálicos (estudio hecho a mano) --- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0a0a0a);
  const panel = (color, intensity, pos, scale) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.scale.set(...scale); m.lookAt(0, 0, 0); envScene.add(m);
  };
  panel(0xffffff, 3, [0, 6, 2], [10, 4, 1]);
  panel(0xffd9a0, 2.2, [-6, 1, 3], [3, 8, 1]);
  panel(0xffffff, 1.4, [6, -1, 2], [3, 8, 1]);
  panel(0xc9a24a, 1.5, [0, -5, -4], [12, 3, 1]);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;

  const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.22 });
  const darkGold = new THREE.MeshStandardMaterial({ color: 0x8a6a1f, metalness: 1, roughness: 0.35 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xe8e8ec, metalness: 1, roughness: 0.12 });

  /* --- Poste de barbero --- */
  const pole = new THREE.Group();
  const stripeCanvas = document.createElement("canvas");
  stripeCanvas.width = 256; stripeCanvas.height = 256;
  const g = stripeCanvas.getContext("2d");
  const stripes = ["#0d0d0d", "#d4af37", "#f3ead8", "#d4af37"];
  for (let i = -4; i < 12; i++) {
    g.fillStyle = stripes[((i % 4) + 4) % 4];
    g.beginPath();
    g.moveTo(0, i * 32); g.lineTo(256, i * 32 - 128); g.lineTo(256, i * 32 - 96); g.lineTo(0, i * 32 + 32);
    g.fill();
  }
  const stripeTex = new THREE.CanvasTexture(stripeCanvas);
  stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
  stripeTex.repeat.set(1, 2.2);
  stripeTex.encoding = THREE.sRGBEncoding;

  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.72, 5, 64, 1, true),
    new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.35, metalness: 0.2, emissive: 0x2a1f05, emissiveIntensity: 0.4 })
  );
  pole.add(inner);
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 0.86, 5.1, 64, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.18, clearcoat: 1, side: THREE.DoubleSide })
  );
  pole.add(glass);
  const cap = (y, flip) => {
    const c = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.34, 64), gold); c.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.06, 16, 80), darkGold); ring2.rotation.x = Math.PI / 2; ring2.position.y = flip * 0.2; c.add(ring2);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.8, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), gold);
    dome.position.y = flip * 0.17; dome.scale.y = 0.7; if (flip < 0) dome.rotation.x = Math.PI; c.add(dome);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16), gold); knob.position.y = flip * 0.85; c.add(knob);
    c.position.y = y; return c;
  };
  pole.add(cap(2.72, 1), cap(-2.72, -1));
  scene.add(pole);

  /* --- Anillos orbitales --- */
  const rings = new THREE.Group();
  [[2.6, 0.025, 1.1], [3.3, 0.018, -0.7], [4.1, 0.012, 0.35]].forEach(([r, t, tilt], i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 16, 200), i === 1 ? darkGold : gold);
    m.rotation.set(Math.PI / 2 + tilt * 0.4, tilt, 0);
    m.userData.speed = 0.12 + i * 0.06;
    rings.add(m);
  });
  scene.add(rings);

  /* --- Tijeras flotantes --- */
  function makeBlade() {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.quadraticCurveTo(0.22, 1.2, 0.05, 2.6); s.lineTo(-0.02, 2.6); s.quadraticCurveTo(-0.06, 1.2, -0.12, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
    const blade = new THREE.Mesh(geo, steel);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 12), gold);
    arm.position.set(0.15, -0.4, 0.02); arm.rotation.z = -0.35;
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 12, 48), gold);
    loop.position.set(0.38, -1.05, 0.02);
    const half = new THREE.Group(); half.add(blade, arm, loop); return half;
  }
  const scissors = new THREE.Group();
  const bladeA = makeBlade(), bladeB = makeBlade();
  bladeB.scale.x = -1; bladeB.position.z = 0.06;
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 20), gold); screw.rotation.x = Math.PI / 2; screw.position.z = 0.04;
  scissors.add(bladeA, bladeB, screw);
  scissors.scale.setScalar(0.62);
  scene.add(scissors);

  /* --- Polvo de oro --- */
  const N = 900;
  const pos = new Float32Array(N * 3), seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 26; pos[i * 3 + 1] = (Math.random() - 0.5) * 16; pos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
    seeds[i] = Math.random() * 10;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dot = document.createElement("canvas"); dot.width = dot.height = 64;
  const dg = dot.getContext("2d"); const grd = dg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,230,160,1)"); grd.addColorStop(0.3, "rgba(212,175,55,.6)"); grd.addColorStop(1, "rgba(212,175,55,0)");
  dg.fillStyle = grd; dg.fillRect(0, 0, 64, 64);
  const dust = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.09, map: new THREE.CanvasTexture(dot), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  /* --- Luces --- */
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.PointLight(0xffd58a, 2.2, 40); key.position.set(-5, 4, 8); scene.add(key);
  const rim = new THREE.PointLight(0xffffff, 1.2, 40); rim.position.set(6, -2, 4); scene.add(rim);

  /* --- Layout responsive --- */
  let baseX = 3.2, baseScale = 1;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const mobile = w < 800;
    baseX = mobile ? 0 : 3.4;
    baseScale = mobile ? 0.72 : 1;
    canvas.style.opacity = mobile ? 0.45 : 1;
  }
  window.addEventListener("resize", resize); resize();

  /* --- Interacción --- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", (e) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; });
  let scrollP = 0;
  window.addEventListener("scroll", () => { scrollP = Math.min(1, scrollY / innerHeight); }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  const clock = new THREE.Clock();
  let intro = 0;
  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    const sp = reduce ? 0.15 : 1;
    intro = Math.min(1, intro + dt * 0.6);
    const e = 1 - Math.pow(1 - intro, 3);

    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;

    stripeTex.offset.y -= dt * 0.35 * sp;
    pole.position.set(baseX + mouse.x * 0.6, Math.sin(t * 0.8) * 0.15 * sp + scrollP * 3 + (1 - e) * -6, 0);
    pole.rotation.set(0.08 + mouse.y * 0.25, t * 0.25 * sp + scrollP * 2, -0.12 + mouse.x * 0.15);
    pole.scale.setScalar(baseScale * (0.6 + 0.4 * e));

    rings.position.copy(pole.position);
    rings.scale.setScalar(baseScale * e);
    rings.children.forEach((r, i) => { r.rotation.z += dt * r.userData.speed * sp * (i % 2 ? -1 : 1); r.rotation.x = Math.PI / 2 + Math.sin(t * 0.3 + i) * 0.25 + mouse.y * 0.3; });

    const open = (Math.sin(t * 2.2) * 0.5 + 0.5) * 0.35 * sp + 0.05;
    bladeA.rotation.z = -open; bladeB.rotation.z = open;
    scissors.position.set(baseX + 2.5 + Math.sin(t * 0.5) * 0.3, 1.9 + Math.cos(t * 0.7) * 0.3 + scrollP * 2, 1.2);
    scissors.rotation.set(0.4 + mouse.y * 0.5, t * 0.6 * sp, 0.7 + Math.sin(t * 0.4) * 0.2);
    scissors.scale.setScalar(0.62 * baseScale * e);
    scissors.visible = baseX !== 0;

    const p = pGeo.attributes.position.array;
    for (let i = 0; i < N; i++) { p[i * 3 + 1] += Math.sin(t + seeds[i]) * 0.0025 * sp + 0.002 * sp; if (p[i * 3 + 1] > 8) p[i * 3 + 1] = -8; }
    pGeo.attributes.position.needsUpdate = true;
    dust.rotation.y = mouse.x * 0.2;

    camera.position.x = mouse.x * 0.8; camera.position.y = -mouse.y * 0.5;
    camera.lookAt(baseX * 0.35, 0, 0);
    renderer.render(scene, camera);
  }
  tick();
})();
