import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  HYDROGEN_LINES,
  NEON_LINES,
  SOURCES,
  VISIBLE_MAX,
  VISIBLE_MIN,
  lineOffset,
  wavelengthToRgb,
  type SourceId,
  type SpectralLine,
} from "@/lib/spectrum";

/**
 * ฉาก 3 มิติของกิจกรรม 19.1 — ห้องแล็บมืด โต๊ะทดลอง ชุดสเปกตรัม หลอดแก๊ส ไม้เมตร และเกรตติง
 *
 * หน่วยเป็นเมตร: หลอดอยู่ที่ x = 0, z = 0 · ไม้เมตรวางตามแกน x (ขีด 50 ซม. ตรงหลอด) · เกรตติงอยู่ที่ z = D
 * มุมมอง "lab" หมุนดูรอบโต๊ะได้ · มุมมอง "grating" คือตาที่มองผ่านเกรตติง จึงเห็นเส้นสเปกตรัมบนไม้เมตร
 * (เส้นสเปกตรัมเป็นภาพเสมือน เห็นได้เฉพาะเมื่อมองผ่านเกรตติง — ในมุมห้องแล็บจึงไม่แสดง)
 */

export type View = "lab" | "grating";
export type SceneState = {
  source: SourceId;
  power: boolean;
  distance: number;
  view: View;
  zoom: boolean;
  pointer: number; // ตำแหน่งตัวชี้บนไม้เมตร (เมตรจากหลอด ลบ = ซ้าย)
  roomLight: boolean;
};

const TABLE_Y = 0.75;
const RULER_Y = TABLE_Y + 0.115;
const TUBE_BOTTOM = TABLE_Y + 0.16;
const TUBE_TOP = TABLE_Y + 0.4;
const EYE_Y = TABLE_Y + 0.25;
const RULER_HALF = 0.5;

export function createSpectrumScene(canvas: HTMLCanvasElement, initial: SceneState, onPick: (x: number) => void) {
  const state: SceneState = { ...initial };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true; // ใช้ตัดแถบสเปกตรัมต่อเนื่องให้เห็นเฉพาะช่วงที่ตัวชี้อยู่

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#04060e");
  scene.fog = new THREE.Fog("#04060e", 5, 12);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.02, 30);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 0.6;
  controls.maxDistance = 4.2;
  controls.target.set(0, TABLE_Y + 0.2, 0.45);

  // ---------------------------------------------------------------- แสง
  const ambient = new THREE.AmbientLight("#9db4ff", 1.5);
  const ceiling = new THREE.DirectionalLight("#e6edff", 2.4);
  ceiling.position.set(1.5, 3.2, 2);
  const rim = new THREE.PointLight("#3b6cff", 6, 8);
  rim.position.set(-2.4, 2.2, -1.4);
  const tubeLight = new THREE.PointLight("#ffffff", 0, 3.2, 1.6);
  tubeLight.position.set(0, (TUBE_BOTTOM + TUBE_TOP) / 2, 0.02);
  scene.add(ambient, ceiling, rim, tubeLight);

  // ---------------------------------------------------------------- ห้อง + โต๊ะ
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  const floor = new THREE.Mesh(
    track(new THREE.PlaneGeometry(14, 14)),
    track(new THREE.MeshStandardMaterial({ color: "#141b33", roughness: 0.6, metalness: 0.2 }))
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(14, 56, "#1c3a8a", "#111b3a");
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.5;
  grid.position.y = 0.002;
  scene.add(grid);

  const wood = track(new THREE.MeshStandardMaterial({ color: "#4a5478", roughness: 0.65, metalness: 0.1 }));
  const tableTop = new THREE.Mesh(track(new THREE.BoxGeometry(1.7, 0.04, 2.1)), wood);
  tableTop.position.set(0, TABLE_Y - 0.02, 0.62);
  scene.add(tableTop);
  const edge = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.72, 0.008, 2.12)),
    track(new THREE.MeshBasicMaterial({ color: "#0b6f8c" }))
  );
  edge.position.set(0, TABLE_Y - 0.044, 0.62);
  scene.add(edge);
  const legGeo = track(new THREE.BoxGeometry(0.06, TABLE_Y - 0.04, 0.06));
  for (const [x, z] of [[-0.78, -0.36], [0.78, -0.36], [-0.78, 1.6], [0.78, 1.6]]) {
    const leg = new THREE.Mesh(legGeo, wood);
    leg.position.set(x, (TABLE_Y - 0.04) / 2, z);
    scene.add(leg);
  }

  // ---------------------------------------------------------------- ชุดสเปกตรัม (power supply) + หลอด
  const dark = track(new THREE.MeshStandardMaterial({ color: "#39435f", roughness: 0.5, metalness: 0.35 }));
  const supply = new THREE.Mesh(track(new THREE.BoxGeometry(0.16, 0.5, 0.14)), dark);
  supply.position.set(0, TABLE_Y + 0.25, -0.1);
  scene.add(supply);
  const clampGeo = track(new THREE.BoxGeometry(0.09, 0.03, 0.09));
  for (const y of [TUBE_BOTTOM - 0.02, TUBE_TOP + 0.02]) {
    const clamp = new THREE.Mesh(clampGeo, dark);
    clamp.position.set(0, y, -0.02);
    scene.add(clamp);
  }
  const led = new THREE.Mesh(track(new THREE.SphereGeometry(0.008, 12, 12)), track(new THREE.MeshBasicMaterial({ color: "#1f2a44" })));
  led.position.set(0.05, TABLE_Y + 0.06, -0.028);
  scene.add(led);

  const tubeH = TUBE_TOP - TUBE_BOTTOM;
  const glassMat = track(new THREE.MeshPhysicalMaterial({ color: "#cfe6ff", roughness: 0.05, transmission: 0.9, transparent: true, opacity: 0.35, thickness: 0.01 }));
  const coreMat = track(new THREE.MeshBasicMaterial({ color: "#222", toneMapped: false }));
  const haloMat = track(new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));

  // หลอดแก๊ส: แท่งแก้วเรียว + ลำแก๊สเรืองแสงตรงกลาง
  const gasTube = new THREE.Group();
  gasTube.add(new THREE.Mesh(track(new THREE.CylinderGeometry(0.011, 0.011, tubeH, 20)), glassMat));
  const gasCore = new THREE.Mesh(track(new THREE.CylinderGeometry(0.0035, 0.0035, tubeH * 0.86, 12)), coreMat);
  const gasHalo = new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 0.02, tubeH * 0.9, 16, 1, true)), haloMat);
  gasTube.add(gasCore, gasHalo);
  gasTube.position.y = (TUBE_BOTTOM + TUBE_TOP) / 2;
  scene.add(gasTube);

  // หลอดไส้: กระเปาะแก้ว + ไส้หลอดแนวตั้ง
  const bulb = new THREE.Group();
  const bulbGlass = new THREE.Mesh(track(new THREE.SphereGeometry(0.045, 28, 20)), glassMat);
  bulbGlass.scale.y = 1.25;
  const filament = new THREE.Mesh(track(new THREE.CylinderGeometry(0.003, 0.003, 0.06, 8)), coreMat);
  const bulbHalo = new THREE.Mesh(track(new THREE.SphereGeometry(0.07, 20, 16)), haloMat);
  const bulbBase = new THREE.Mesh(track(new THREE.CylinderGeometry(0.018, 0.02, 0.07, 16)), dark);
  bulbBase.position.y = -0.085;
  bulb.add(bulbGlass, filament, bulbHalo, bulbBase);
  bulb.position.y = (TUBE_BOTTOM + TUBE_TOP) / 2 + 0.02;
  scene.add(bulb);

  // ---------------------------------------------------------------- ไม้เมตร (ลายขีดวาดด้วย canvas)
  const rulerTex = track(makeRulerTexture());
  rulerTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const rulerMat = track(new THREE.MeshBasicMaterial({ map: rulerTex }));
  const ruler = new THREE.Mesh(track(new THREE.BoxGeometry(RULER_HALF * 2, 0.045, 0.008)), [dark, dark, dark, dark, rulerMat, dark]);
  ruler.position.set(0, RULER_Y, 0.03);
  scene.add(ruler);
  const standGeo = track(new THREE.BoxGeometry(0.03, 0.1, 0.05));
  for (const x of [-0.42, 0.42]) {
    const stand = new THREE.Mesh(standGeo, dark);
    stand.position.set(x, TABLE_Y + 0.05, 0.03);
    scene.add(stand);
  }

  // ---------------------------------------------------------------- เกรตติงบนขาตั้ง
  const grating = new THREE.Group();
  const frame = new THREE.Mesh(track(new THREE.BoxGeometry(0.075, 0.075, 0.006)), dark);
  const film = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.052, 0.052)),
    track(new THREE.MeshPhysicalMaterial({ color: "#9fd8ff", iridescence: 1, iridescenceIOR: 1.6, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.55, side: THREE.DoubleSide }))
  );
  film.position.z = 0.0035;
  const film2 = film.clone();
  film2.position.z = -0.0035;
  const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.006, 0.006, EYE_Y - TABLE_Y - 0.03, 10)), dark);
  post.position.y = -(EYE_Y - TABLE_Y - 0.03) / 2 - 0.035;
  const foot = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.05, 0.015, 24)), dark);
  foot.position.y = -(EYE_Y - TABLE_Y) + 0.0075;
  grating.add(frame, film, film2, post, foot);
  grating.position.set(0, EYE_Y, state.distance);
  scene.add(grating);

  // ---------------------------------------------------------------- เส้นบอกระยะ (มุมห้องแล็บ) — สามเหลี่ยมตามใบกิจกรรม
  const guideMat = track(new THREE.LineDashedMaterial({ color: "#39f0a0", dashSize: 0.03, gapSize: 0.02 }));
  const rayMat = track(new THREE.LineDashedMaterial({ color: "#5aa9ff", dashSize: 0.02, gapSize: 0.015 }));
  const guideGeo = track(new THREE.BufferGeometry());
  const rayGeo = track(new THREE.BufferGeometry());
  const guide = new THREE.Line(guideGeo, guideMat);
  const ray = new THREE.Line(rayGeo, rayMat);
  scene.add(guide, ray);

  // ---------------------------------------------------------------- ตัวชี้อ่านตำแหน่งบนไม้เมตร
  const pointer = new THREE.Group();
  const pointerMat = track(new THREE.MeshBasicMaterial({ color: "#58c4d8" }));
  const needle = new THREE.Mesh(track(new THREE.BoxGeometry(0.0006, 0.075, 0.001)), pointerMat);
  needle.position.y = 0.012;
  const cap = new THREE.Mesh(track(new THREE.ConeGeometry(0.004, 0.01, 3)), pointerMat);
  cap.rotation.z = Math.PI;
  cap.position.y = 0.054;
  pointer.add(needle, cap);
  pointer.position.set(state.pointer, RULER_Y, 0.038);
  scene.add(pointer);

  // ---------------------------------------------------------------- เส้นสเปกตรัม (เห็นเมื่อมองผ่านเกรตติง)
  const spectra = new THREE.Group();
  scene.add(spectra);
  const streakTex = track(makeStreakTexture());
  const streakGeo = track(new THREE.PlaneGeometry(1, 1));
  const spectrumMats: THREE.Material[] = [];
  const spectrumGeos: THREE.BufferGeometry[] = [];
  const streakBottom = RULER_Y - 0.03;
  const streakH = TUBE_TOP - streakBottom;

  // สเปกตรัมไม่ได้โชว์ตลอด — เห็นเฉพาะเมื่อเลื่อนตัวชี้ไปถึงตำแหน่งนั้น (นักเรียนต้องกวาดหาเอง)
  const FIND_SIGMA = 0.006; // เส้นเริ่มเรืองเมื่อตัวชี้เข้าใกล้ราว 1 ซม. สว่างสุดเมื่อทับพอดี
  const LAMP_WINDOW = 0.012; // แถบสีต่อเนื่องเห็นช่วงกว้าง ±1.2 ซม. รอบตัวชี้
  const lineMeshes: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; base: THREE.Color; x: number }[] = [];
  const clipLeft = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  const clipRight = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

  function applyProximity() {
    const p = state.pointer;
    clipLeft.constant = -(p - LAMP_WINDOW);
    clipRight.constant = p + LAMP_WINDOW;
    for (const l of lineMeshes) {
      const k = Math.exp(-(((p - l.x) / FIND_SIGMA) ** 2));
      l.mesh.visible = k > 0.02;
      l.mat.color.copy(l.base).multiplyScalar(k);
    }
  }

  function rebuildSpectra() {
    lineMeshes.length = 0;
    spectra.clear();
    spectrumMats.splice(0).forEach((m) => m.dispose());
    spectrumGeos.splice(0).forEach((g) => g.dispose());
    if (!state.power) return;
    const D = state.distance;
    if (state.source === "lamp") {
      // สเปกตรัมต่อเนื่อง: แถบสีรุ้งไล่จากม่วง (ใกล้หลอด) ถึงแดง ทั้งสองข้าง
      const x0 = lineOffset(VISIBLE_MIN, D)!;
      const x1 = lineOffset(VISIBLE_MAX, D)!;
      const seg = 96;
      for (const side of [-1, 1]) {
        const geo = new THREE.PlaneGeometry(x1 - x0, streakH * 0.8, seg, 1);
        const colors: number[] = [];
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = x0 + (pos.getX(i) + (x1 - x0) / 2);
          const nm = (Math.sin(Math.atan2(x, D)) * 1e9 * 0.01) / 5300;
          const [r, g, b] = wavelengthToRgb(nm);
          // จางที่ขอบบน-ล่างเล็กน้อย
          const fade = Math.abs(pos.getY(i)) > streakH * 0.39 ? 0.25 : 1;
          colors.push(r * fade, g * fade, b * fade);
        }
        geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, clippingPlanes: [clipLeft, clipRight] });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(side * (x0 + x1) / 2, streakBottom + streakH * 0.55, 0.0345);
        if (side < 0) mesh.scale.x = -1;
        spectra.add(mesh);
        spectrumMats.push(mat);
        spectrumGeos.push(geo);
      }
      applyProximity();
      return;
    }
    const lines: SpectralLine[] = state.source === "hydrogen" ? HYDROGEN_LINES : NEON_LINES;
    for (const line of lines) {
      const x = lineOffset(line.nm, D);
      if (x === null || x > RULER_HALF + 0.12) continue;
      const [r, g, b] = wavelengthToRgb(line.nm);
      const base = new THREE.Color(r, g, b).multiplyScalar(0.55 + line.strength * 0.9);
      for (const side of [-1, 1]) {
        const mat = new THREE.MeshBasicMaterial({
          map: streakTex,
          color: base.clone(),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        });
        spectrumMats.push(mat);
        const mesh = new THREE.Mesh(streakGeo, mat);
        // กว้างราวเท่าลำแก๊สในหลอด (ภาพของหลอด) — แกนกลางคมอยู่ที่ตำแหน่ง x พอดี
        mesh.scale.set(0.012, streakH, 1);
        mesh.position.set(side * x, streakBottom + streakH / 2, 0.0345);
        spectra.add(mesh);
        lineMeshes.push({ mesh, mat, base, x: side * x });
      }
    }
    applyProximity();
  }

  // ---------------------------------------------------------------- ปรับตามสถานะ
  function applySource() {
    const meta = SOURCES.find((s) => s.id === state.source)!;
    const on = state.power;
    const glow = new THREE.Color(meta.glow);
    gasTube.visible = state.source !== "lamp";
    bulb.visible = state.source === "lamp";
    coreMat.color.copy(on ? glow.clone().multiplyScalar(1.5) : new THREE.Color("#30374d"));
    haloMat.color.copy(on ? glow : new THREE.Color("#000"));
    tubeLight.color.copy(glow);
    tubeLight.intensity = on ? (state.source === "lamp" ? 0.9 : 0.5) : 0;
    (led.material as THREE.MeshBasicMaterial).color.set(on ? "#39f0a0" : "#1f2a44");
    rebuildSpectra();
  }

  function applyRoom() {
    const lit = state.roomLight;
    ambient.intensity = lit ? 1.5 : 0.16;
    ceiling.intensity = lit ? 2.4 : 0.08;
    rim.intensity = lit ? 6 : 2.2;
    // ไม้เมตรต้องอ่านได้แม้ปิดไฟ (ในห้องจริงใช้ไฟฉายส่อง) แต่หรี่ลงให้เส้นสเปกตรัมเด่น
    rulerMat.color.setScalar(lit ? 0.7 : 0.4);
  }

  function applyGeometry() {
    const D = state.distance;
    grating.position.z = D;
    pointer.position.x = state.pointer;
    const y = RULER_Y + 0.05;
    guideGeo.setFromPoints([new THREE.Vector3(0, y, D), new THREE.Vector3(0, y, 0.04), new THREE.Vector3(state.pointer, y, 0.04)]);
    rayGeo.setFromPoints([new THREE.Vector3(0, y, D), new THREE.Vector3(state.pointer, y, 0.04)]);
    guide.computeLineDistances();
    ray.computeLineDistances();
  }

  // ---------------------------------------------------------------- กล้อง
  const goal = { pos: new THREE.Vector3(), look: new THREE.Vector3(), hfov: 50 };
  const look = new THREE.Vector3(0, TABLE_Y + 0.2, 0.45);
  let aspect = 1;
  let snap = true;

  function applyView(resetLab = false) {
    const g = state.view === "grating";
    controls.enabled = !g;
    spectra.visible = g;
    grating.visible = !g; // ตาอยู่ชิดเกรตติง กรอบเกรตติงจึงไม่บังภาพ (แสดงเป็นขอบมืดด้วย CSS แทน)
    guide.visible = ray.visible = !g;
    if (g) {
      goal.pos.set(0, EYE_Y, state.distance);
      if (state.zoom) {
        goal.look.set(state.pointer, RULER_Y + 0.022, 0);
        goal.hfov = THREE.MathUtils.radToDeg(2 * Math.atan(0.075 / Math.hypot(state.distance, state.pointer)));
      } else {
        goal.look.set(0, RULER_Y + 0.06, 0);
        goal.hfov = THREE.MathUtils.radToDeg(2 * Math.atan((RULER_HALF + 0.06) / state.distance));
      }
    } else if (resetLab) {
      goal.pos.set(1.25, 1.55, state.distance + 1.25);
      goal.look.set(0, TABLE_Y + 0.2, state.distance * 0.45);
      goal.hfov = aspect < 1 ? 62 : 46;
      camera.position.copy(goal.pos);
      controls.target.copy(goal.look);
      snap = true;
    } else {
      goal.hfov = aspect < 1 ? 62 : 46;
      snap = true;
    }
  }

  function setFov(hfov: number) {
    const v = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hfov) / 2) / aspect));
    camera.fov = Math.min(v, 110);
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- เอฟเฟกต์เรืองแสง
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.6, 0.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    aspect = w / h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = aspect;
    applyView();
    snap = true;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  // ---------------------------------------------------------------- แตะไม้เมตรเพื่อย้ายตัวชี้ (มุมมองผ่านเกรตติง)
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.03);
  const hit = new THREE.Vector3();
  let dragging = false;
  function pick(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    if (raycaster.ray.intersectPlane(plane, hit)) onPick(Math.max(-RULER_HALF, Math.min(RULER_HALF, Math.round(hit.x * 1000) / 1000)));
  }
  function down(e: PointerEvent) {
    if (state.view !== "grating") return;
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    pick(e);
  }
  function move(e: PointerEvent) {
    if (dragging) pick(e);
  }
  function up() {
    dragging = false;
  }
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);

  // ---------------------------------------------------------------- วนวาด
  let raf = 0;
  const clock = new THREE.Clock();
  function tick() {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (state.view === "grating") {
      const k = snap || reduceMotion ? 1 : 1 - Math.exp(-dt * 7);
      camera.position.lerp(goal.pos, k);
      look.lerp(goal.look, k);
      camera.lookAt(look);
      setFov(camera.userData.hfov = THREE.MathUtils.lerp(camera.userData.hfov ?? goal.hfov, goal.hfov, k));
    } else {
      if (snap) setFov((camera.userData.hfov = goal.hfov));
      controls.update();
      look.copy(controls.target);
    }
    snap = false;
    // หลอดแก๊สสั่นไหวเล็กน้อยเหมือนการคายประจุจริง
    if (state.power && !reduceMotion) {
      const flick = state.source === "lamp" ? 1 : 0.94 + 0.06 * Math.sin(t * 47) * Math.sin(t * 13.3);
      haloMat.opacity = 0.18 * flick;
      tubeLight.intensity = (state.source === "lamp" ? 0.9 : 0.5) * flick;
    }
    composer.render();
  }

  applySource();
  applyRoom();
  applyGeometry();
  resize();
  applyView(true);
  tick();

  return {
    update(next: Partial<SceneState>) {
      const prev = { ...state };
      Object.assign(state, next);
      if (state.source !== prev.source || state.power !== prev.power) applySource();
      else if (state.distance !== prev.distance) rebuildSpectra();
      if (state.roomLight !== prev.roomLight) applyRoom();
      if (state.distance !== prev.distance || state.pointer !== prev.pointer) applyGeometry();
      if (state.pointer !== prev.pointer) applyProximity();
      if (state.view !== prev.view) applyView(true);
      else if (state.view === "grating" && (state.zoom !== prev.zoom || state.distance !== prev.distance || (state.zoom && state.pointer !== prev.pointer))) applyView();
    },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      controls.dispose();
      spectrumMats.forEach((m) => m.dispose());
      spectrumGeos.forEach((g) => g.dispose());
      disposables.forEach((d) => d.dispose());
      composer.dispose();
      renderer.dispose();
    },
  };
}

export type SpectrumScene = ReturnType<typeof createSpectrumScene>;

/** ลายไม้เมตร 0–100 ซม. ขีดละ 1 มม. เลขทุก 1 ซม. (ขีด 50 ตรงกับหลอด) */
function makeRulerTexture() {
  const W = 8192;
  const H = 368;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f1e6c8";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#1b1b22";
  g.textAlign = "center";
  g.font = "600 58px system-ui, sans-serif";
  const mm = W / 1000;
  for (let i = 0; i <= 1000; i++) {
    const x = Math.round(i * mm);
    const len = i % 10 === 0 ? 150 : i % 5 === 0 ? 110 : 70;
    g.fillRect(x - (i % 10 === 0 ? 3 : 2), 0, i % 10 === 0 ? 6 : 4, len);
    if (i % 10 === 0 && i > 0 && i < 1000) g.fillText(String(i / 10), x, 250);
  }
  // ขีดกึ่งกลาง 50 ซม. = ตำแหน่งหลอด
  g.fillStyle = "#d1173d";
  g.fillRect(W / 2 - 5, 0, 10, 190);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** แถบแสงแนวตั้ง: แกนกลางคม ขอบฟุ้ง จางที่ปลายบน-ล่าง */
function makeStreakTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d")!;
  const img = g.createImageData(64, 256);
  for (let y = 0; y < 256; y++) {
    const v = y / 255;
    // ครึ่งล่าง (ช่วงทับไม้เมตร) จางกว่า เพื่อให้อ่านขีดได้
    const vert = Math.min(1, v / 0.06) * Math.min(1, (1 - v) / 0.06) * (v > 0.72 ? 0.45 : 1);
    for (let x = 0; x < 64; x++) {
      const u = (x - 31.5) / 31.5;
      const a = Math.exp(-u * u * 90) + 0.35 * Math.exp(-u * u * 7);
      const i = (y * 64 + x) * 4;
      const val = Math.min(255, 255 * a * vert);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
