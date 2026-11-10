/* ==========================================================================
   Gautam Varma Datla — interactive site
   WebGL orb (three.js) + loader + navigation + micro-interactions
   ========================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* --------------------------------------------------------------------------
   Shared state the orb reads every frame
   -------------------------------------------------------------------------- */
const state = {
  phase: 'live',
  section: 'home',
  mouse: { x: 0, y: 0 },
  scrollVel: 0,
  pulse: 0,
};

/* --------------------------------------------------------------------------
   Section presets: where the orb sits and what colours it wears
   -------------------------------------------------------------------------- */
const PRESETS = {
  loading:    { x: 0,    y: 0,    s: 1.35, amp: 0.34, dim: 1.0, c: ['#2f46d8', '#7cf3ff', '#ff8ad8'] },
  home:       { x: 1.75, y: 0.05, s: 0.88, amp: 0.24, dim: 1.0, c: ['#4a34d6', '#7cf3ff', '#c4a8ff'] },
  about:      { x: -3.3, y: 0.35, s: 0.62, amp: 0.20, dim: 1.0, c: ['#3f5fe0', '#9fd0ff', '#ff8ad8'] },
  research:   { x: 3.4,  y: -0.3, s: 0.72, amp: 0.30, dim: 1.0, c: ['#7a34d6', '#c4a8ff', '#ff6fd0'] },
  opensource: { x: -3.4, y: -0.25,s: 0.70, amp: 0.26, dim: 1.0, c: ['#0f9c7c', '#3dffb0', '#7cf3ff'] },
  experience: { x: 3.5,  y: 0.35, s: 0.62, amp: 0.22, dim: 1.0, c: ['#d0561c', '#ffc36b', '#ff6b81'] },
  service:    { x: -3.45,y: 0.0,  s: 0.58, amp: 0.20, dim: 1.0, c: ['#2d63d6', '#8fc4ff', '#3dffb0'] },
  contact:    { x: 3.4,  y: -0.1, s: 0.8,  amp: 0.30, dim: 1.0, c: ['#4a34d6', '#7cf3ff', '#ff8ad8'] },
};

/* ==========================================================================
   ORB
   ========================================================================== */
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const ORB_VERT = /* glsl */`
${NOISE}
uniform float uTime;
uniform float uAmp;
uniform float uPulse;
uniform float uShell;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
void main(){
  vec3 p = position;
  float t = uTime * 0.35;
  float n  = snoise(p * 1.4 + vec3(t, t*0.7, -t*0.4));
  float n2 = snoise(p * 3.2 - vec3(t*1.3)) * 0.35;
  float d = (n + n2) * (uAmp + uPulse * 0.35);
  vNoise = n + n2;
  p += normal * (d + uShell);
  vec4 world = modelMatrix * vec4(p, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = cameraPosition - world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const ORB_FRAG = /* glsl */`
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform float uTime;
uniform float uDim;
uniform float uAlpha;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
void main(){
  float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.4);
  vec3 col = mix(uA, uB, smoothstep(-0.8, 0.7, vNoise));
  col = mix(col, uC, fres * 0.9);
  float bands = 0.5 + 0.5 * sin(vNoise * 16.0 + uTime * 1.2);
  col += uB * bands * 0.08;
  col *= (0.8 + fres * 1.3) * uDim;
  gl_FragColor = vec4(col, uAlpha);
}`;

const PTS_VERT = /* glsl */`
uniform float uTime;
uniform float uSize;
uniform float uPx;
attribute float aSeed;
varying float vTw;
void main(){
  vec3 p = position;
  float a = uTime * (0.05 + aSeed * 0.08);
  float c = cos(a), s = sin(a);
  p.xz = mat2(c, -s, s, c) * p.xz;
  p.y += sin(uTime * 0.6 + aSeed * 30.0) * 0.04;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vTw = 0.55 + 0.45 * sin(uTime * 2.0 + aSeed * 50.0);
  gl_PointSize = uSize * uPx * (0.6 + aSeed) * (6.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const PTS_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uOpacity;
varying float vTw;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor, a * vTw * uOpacity);
}`;

async function initOrb() {
  const canvas = $('#orb');
  let THREE;
  try {
    THREE = await import('three');
  } catch (e) {
    console.warn('three.js failed to load, using CSS fallback', e);
    document.body.classList.add('no-webgl');
    return null;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 1.5, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    console.warn('WebGL unavailable, using CSS fallback', e);
    document.body.classList.add('no-webgl');
    return null;
  }
  // Hero renders sharp (capped at 1.5x); behind sections the orb renders at a tiny
  // resolution and gets upscaled, which blurs it for free instead of a CSS blur filter.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let heroRatio = dpr;
  const BG_RATIO = 0.25;
  let bgMode = false;
  renderer.setPixelRatio(heroRatio);
  renderer.setClearColor(0x05060a, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  const root = new THREE.Group();   // moves between sections
  const spin = new THREE.Group();   // rotates with time & mouse
  root.add(spin);
  scene.add(root);

  const P0 = PRESETS.home;
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: P0.amp },
    uPulse: { value: 0 },
    uShell: { value: 0 },
    uDim: { value: 1 },
    uAlpha: { value: 1 },
    uA: { value: new THREE.Color(P0.c[0]) },
    uB: { value: new THREE.Color(P0.c[1]) },
    uC: { value: new THREE.Color(P0.c[2]) },
  };

  // core orb
  const detail = innerWidth < 760 ? 18 : 30;
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, detail),
    new THREE.ShaderMaterial({ vertexShader: ORB_VERT, fragmentShader: ORB_FRAG, uniforms })
  );
  spin.add(core);

  // wireframe shell — shares colours/time but pushed outward
  const shellUniforms = { ...uniforms, uShell: { value: 0.32 }, uAlpha: { value: 0.18 }, uAmp: { value: P0.amp * 0.6 } };
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 6),
    new THREE.ShaderMaterial({
      vertexShader: ORB_VERT, fragmentShader: ORB_FRAG, uniforms: shellUniforms,
      wireframe: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  spin.add(shell);

  // particle halo
  const N = innerWidth < 760 ? 900 : 1800;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = 1.55 + Math.pow(Math.random(), 2.2) * 1.9;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    // flatten into a disc-ish halo for some particles
    const flat = Math.random() < 0.55 ? 0.18 : 1;
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * flat;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    seed[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const pUniforms = {
    uTime: uniforms.uTime, uSize: { value: 2.2 }, uPx: { value: dpr },
    uColor: { value: new THREE.Color(P0.c[1]) }, uOpacity: { value: 0.9 },
  };
  const halo = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    vertexShader: PTS_VERT, fragmentShader: PTS_FRAG, uniforms: pUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.rotation.z = 0.35;
  root.add(halo);

  // orbit rings
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(P0.c[2]), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const rings = [];
  [[2.05, 1.2, 0.3], [2.45, -0.9, 0.9], [1.75, 0.4, -1.2]].forEach(([r, rx, ry], i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0045 + i * 0.001, 6, 256), ringMat);
    m.rotation.set(rx, ry, 0);
    root.add(m);
    rings.push(m);
  });

  // soft glow sprite
  const gc = document.createElement('canvas');
  gc.width = gc.height = 256;
  const g = gc.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const glowMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), color: new THREE.Color(P0.c[1]), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(6.5, 6.5, 1);
  root.add(glow);

  // background starfield (parallax)
  const SN = innerWidth < 760 ? 400 : 900;
  const sp = new Float32Array(SN * 3);
  const ss = new Float32Array(SN);
  for (let i = 0; i < SN; i++) {
    sp[i * 3] = (Math.random() - 0.5) * 40;
    sp[i * 3 + 1] = (Math.random() - 0.5) * 26;
    sp[i * 3 + 2] = -6 - Math.random() * 20;
    ss[i] = Math.random();
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sGeo.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
  const stars = new THREE.Points(sGeo, new THREE.ShaderMaterial({
    vertexShader: PTS_VERT, fragmentShader: PTS_FRAG,
    uniforms: { uTime: { value: 0 }, uSize: { value: 3.2 }, uPx: { value: dpr }, uColor: { value: new THREE.Color('#c9d4ff') }, uOpacity: { value: 0.55 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(stars);

  // sizing
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  // targets
  const tgt = {
    x: P0.x, y: P0.y, s: P0.s, amp: P0.amp, dim: P0.dim,
    a: new THREE.Color(P0.c[0]), b: new THREE.Color(P0.c[1]), c: new THREE.Color(P0.c[2]),
  };
  root.scale.setScalar(0.001); // grows in during loading
  let introScale = 0;

  function setPreset(name) {
    const p = PRESETS[name] || PRESETS.home;
    const mobile = innerWidth < 760;
    const narrow = innerWidth < 1100;
    // half-width of the visible plane at z=0; side sections pin the orb's centre to the screen edge
    const halfW = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * camera.aspect;
    const edge = name !== 'home' && name !== 'loading';
    tgt.x = mobile ? 0 : edge ? Math.sign(p.x) * halfW * 0.97 : halfW * 0.58;
    tgt.y = mobile ? (name === 'home' ? 0.9 : p.y * 0.5) : p.y;
    tgt.s = mobile ? p.s * 0.75 : p.s;
    tgt.amp = p.amp;
    tgt.dim = mobile && state.phase === 'live' ? p.dim * 0.7 : p.dim;
    tgt.a.set(p.c[0]); tgt.b.set(p.c[1]); tgt.c.set(p.c[2]);
  }
  setPreset('home');
  root.position.set(tgt.x, tgt.y, 0);

  const clock = new THREE.Clock();
  let t = 0;
  const speed = reduced ? 0.25 : 1;
  let rotX = 0, rotY = 0;

  // frame pacing: 30fps behind sections, full rate in the hero; adaptive resolution if the hero runs slow
  let lastRender = 0, slowFrames = 0, sampled = 0;
  function setBg(on) {
    if (on === bgMode) return;
    bgMode = on;
    // fine detail (points, wireframe, thin rings) turns blocky when upscaled, so only the smooth core + glow stay
    halo.visible = shell.visible = stars.visible = !on;
    rings.forEach((r) => { r.visible = !on; });
    renderer.setPixelRatio(on ? BG_RATIO : heroRatio);
    resize();
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    if (bgMode && now - lastRender < 32) return;
    const gap = now - lastRender;
    lastRender = now;
    if (!bgMode && heroRatio > 0.75 && lastRender > 2000) {
      sampled++;
      if (gap > 24) slowFrames++;
      if (sampled >= 90) {
        if (slowFrames > 30) { heroRatio = Math.max(0.75, heroRatio - 0.25); renderer.setPixelRatio(heroRatio); resize(); }
        sampled = 0; slowFrames = 0;
      }
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt * speed;
    uniforms.uTime.value = t;
    stars.material.uniforms.uTime.value = t * 0.4;

    // ease toward targets
    const k = 1 - Math.pow(0.0015, dt);       // framerate-independent smoothing
    root.position.x = lerp(root.position.x, tgt.x, k);
    root.position.y = lerp(root.position.y, tgt.y - state.scrollVel * 0.002, k);
    introScale = lerp(introScale, 1, 1 - Math.pow(0.02, dt));
    const sc = lerp(root.scale.x, tgt.s * introScale * (1 + state.pulse * 0.08), k);
    root.scale.setScalar(Math.max(sc, 0.001));

    const vel = Math.min(Math.abs(state.scrollVel) * 0.0035, 0.3);
    uniforms.uAmp.value = lerp(uniforms.uAmp.value, tgt.amp + vel, k);
    shellUniforms.uAmp.value = uniforms.uAmp.value * 0.6;
    uniforms.uDim.value = lerp(uniforms.uDim.value, tgt.dim, k);
    uniforms.uPulse.value = state.pulse;
    state.pulse *= Math.pow(0.08, dt);
    state.scrollVel *= Math.pow(0.02, dt);

    uniforms.uA.value.lerp(tgt.a, k);
    uniforms.uB.value.lerp(tgt.b, k);
    uniforms.uC.value.lerp(tgt.c, k);
    pUniforms.uColor.value.copy(uniforms.uB.value);
    ringMat.color.copy(uniforms.uC.value);
    glowMat.color.copy(uniforms.uB.value);
    glowMat.opacity = 0.45 * uniforms.uDim.value;

    // rotation: time + mouse
    rotY = lerp(rotY, state.mouse.x * 0.6, k * 0.6);
    rotX = lerp(rotX, state.mouse.y * 0.4, k * 0.6);
    spin.rotation.y = t * 0.12 + rotY;
    spin.rotation.x = t * 0.05 + rotX;
    halo.rotation.y = -t * 0.03 + rotY * 0.5;
    rings.forEach((r, i) => { r.rotation.z = t * (0.08 + i * 0.05) * (i % 2 ? -1 : 1); });
    stars.position.x = -state.mouse.x * 0.4;
    stars.position.y = -state.mouse.y * 0.3 + scrollY * 0.0008;

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    go(name) { setPreset(name); setBg(name !== 'home'); },
    pulse(v = 1) { state.pulse = Math.max(state.pulse, v); },
    refresh() { setPreset(state.phase === 'loading' ? 'loading' : state.section); },
  };
}

/* ==========================================================================
   TEXT EFFECTS
   ========================================================================== */
function scramble(el, delay = 0) {
  const final = el.dataset.text;
  const chars = '!<>-_\\/[]{}—=+*^?#01ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (reduced) { el.textContent = final; return; }
  const dur = 1100;
  let start = null;
  el.textContent = final.replace(/\S/g, ' ');
  function step(ts) {
    if (start === null) start = ts;
    const p = clamp((ts - start) / dur, 0, 1);
    let out = '';
    for (let i = 0; i < final.length; i++) {
      const reveal = i / final.length < p;
      out += reveal || final[i] === ' ' ? final[i] : chars[(Math.random() * chars.length) | 0];
    }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(step);
  }
  setTimeout(() => requestAnimationFrame(step), delay);
}

function rotator() {
  const el = $('#rotator');
  const words = ['safer AI agents', 'executable AI governance', 'interpretable models', 'secure MCP tooling', 'agentic workflows'];
  let i = 0;
  setInterval(() => {
    el.classList.add('out');
    setTimeout(() => {
      i = (i + 1) % words.length;
      el.textContent = words[i];
      el.classList.remove('out');
    }, 350);
  }, 2600);
}

/* ==========================================================================
   UI
   ========================================================================== */
function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (el.closest('.hero') ? i * 0.08 : 0) + 's';
    io.observe(el);
  });
}

function initSections(orb) {
  const links = $$('.nav-links a');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const name = e.target.dataset.section;
      if (name === state.section) return;
      state.section = name;
      document.body.classList.toggle('in-section', name !== 'home');
      links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + name));
      if (orb && state.phase === 'live') { orb.go(name); orb.pulse(0.8); }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('[data-section]').forEach((s) => io.observe(s));
}

function initScroll() {
  const nav = $('.nav');
  let last = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    state.scrollVel += y - last;
    last = y;
    nav.classList.toggle('scrolled', y > 40);
  }, { passive: true });
}

function initMouse() {
  addEventListener('pointermove', (e) => {
    state.mouse.x = (e.clientX / innerWidth) * 2 - 1;
    state.mouse.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
}

function initMagnetic() {
  if (!finePointer || reduced) return;
  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * 0.25}px, ${dy * 0.35}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

function initTilt() {
  if (!finePointer || reduced) return;
  $$('.tilt').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg) translateY(-2px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

function initFilters(orb) {
  const chips = $$('.chip');
  const pubs = $$('.pub');
  chips.forEach((c) => c.addEventListener('click', () => {
    chips.forEach((x) => x.classList.toggle('active', x === c));
    const f = c.dataset.filter;
    pubs.forEach((p) => {
      const show = f === 'all' || p.dataset.tags.split(' ').includes(f);
      p.classList.toggle('hide', !show);
    });
    orb && orb.pulse(0.6);
  }));
}

function initTimeline() {
  $$('.tl-head').forEach((b) => b.addEventListener('click', () => {
    const li = b.closest('.tl');
    const open = li.classList.toggle('open');
    b.setAttribute('aria-expanded', open);
  }));
}

function initCounters() {
  const els = $$('[data-count]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const end = +e.target.dataset.count;
      const dur = reduced ? 1 : 1600;
      const t0 = performance.now();
      (function step(now) {
        const p = clamp((now - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        const dec = +(e.target.dataset.decimals || 0);
        e.target.textContent = (e.target.dataset.prefix || '') + (end * eased).toFixed(dec) + (e.target.dataset.suffix || '');
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }, { threshold: 0.5 });
  els.forEach((el) => io.observe(el));
}

function initTerminal() {
  const box = $('#term-lines');
  const lines = [
    ['dim', '# simulated session'],
    ['', 'agent → tools/call  fs.read_config'],
    ['ok', '✓ schema    ✓ arg policy    ✓ provenance'],
    ['', 'scanning server source…'],
    ['bad', '✗ behavior drift: tool now writes outside sandbox'],
    ['bad', '■ BLOCKED  destructive call quarantined'],
  ];
  let started = false;
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting || started) return;
    started = true;
    let i = 0;
    (function next() {
      if (i >= lines.length) {
        box.insertAdjacentHTML('beforeend', '<div><span class="p">$</span> <span class="caret"></span></div>');
        return;
      }
      const [cls, txt] = lines[i++];
      const d = document.createElement('div');
      if (cls) d.className = cls;
      box.appendChild(d);
      let j = 0;
      (function type() {
        d.textContent = txt.slice(0, ++j);
        if (j < txt.length) setTimeout(type, reduced ? 0 : 14);
        else setTimeout(next, reduced ? 0 : 320);
      })();
    })();
  }, { threshold: 0.4 });
  io.observe(box);
}

function initBurger() {
  const b = $('#burger');
  const links = $('#nav-links');
  b.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    b.setAttribute('aria-expanded', open);
  });
  $$('a', links).forEach((a) => a.addEventListener('click', () => {
    links.classList.remove('open');
    b.setAttribute('aria-expanded', 'false');
  }));
}

/* --------------------------------------------------------------------------
   Command palette
   -------------------------------------------------------------------------- */
function initPalette(orb) {
  const pal = $('#palette');
  const input = $('#palette-input');
  const list = $('#palette-list');
  const go = (id) => () => document.getElementById(id).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  const open = (url) => () => window.open(url, '_blank', 'noopener');
  const items = [
    { t: 'Home', k: 'section', run: go('home') },
    { t: 'About', k: 'section', run: go('about') },
    { t: 'Research & publications', k: 'section', run: go('research') },
    { t: 'Open source', k: 'section', run: go('opensource') },
    { t: 'Experience', k: 'section', run: go('experience') },
    { t: 'Service & reviewing', k: 'section', run: go('service') },
    { t: 'Contact', k: 'section', run: go('contact') },
    { t: 'mcpsafetywarden on GitHub', k: 'link', run: open('https://github.com/gautamvarmadatla/mcpsafetywarden') },
    { t: 'Executable Governance paper (arXiv)', k: 'link', run: open('https://arxiv.org/abs/2512.04408') },
    { t: 'Google Scholar', k: 'link', run: open('https://scholar.google.com/citations?user=4hY7vjsAAAAJ&hl=en') },
    { t: 'GitHub profile', k: 'link', run: open('https://github.com/gautamvarmadatla') },
    { t: 'LinkedIn', k: 'link', run: open('https://www.linkedin.com/in/gautam-varma-datla-38580a218/') },
    { t: 'The AI Journal feature', k: 'link', run: open('https://aijourn.com/gautam-varma-datla-is-working-to-make-ai-safer-before-it-gets-more-powerful/') },
    { t: 'Send email', k: 'action', run: () => { location.href = 'mailto:gvd6@njit.edu'; } },
    { t: 'Copy email address', k: 'action', run: () => navigator.clipboard && navigator.clipboard.writeText('gvd6@njit.edu') },
    { t: 'Pulse the orb', k: 'fun', run: () => orb && orb.pulse(2.5) },
  ];
  let filtered = items;
  let sel = 0;

  function render() {
    list.innerHTML = '';
    filtered.forEach((it, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.className = i === sel ? 'sel' : '';
      li.innerHTML = `<span></span><span class="mono">${it.k}</span>`;
      li.firstChild.textContent = it.t;
      li.addEventListener('mouseenter', () => { sel = i; render(); });
      li.addEventListener('click', () => choose(i));
      list.appendChild(li);
    });
    const s = list.children[sel];
    s && s.scrollIntoView({ block: 'nearest' });
  }
  function filter() {
    const q = input.value.trim().toLowerCase();
    filtered = !q ? items : items.filter((it) => {
      // subsequence fuzzy match
      const s = (it.t + ' ' + it.k).toLowerCase();
      let j = 0;
      for (const ch of s) if (ch === q[j]) j++;
      return j === q.length;
    });
    sel = 0;
    render();
  }
  function show() { pal.hidden = false; input.value = ''; filter(); input.focus(); }
  function hide() { pal.hidden = true; }
  function choose(i) { const it = filtered[i]; hide(); it && it.run(); }

  pal.addEventListener('click', (e) => { if (e.target === pal) hide(); });
  input.addEventListener('input', filter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = (sel + 1) % Math.max(filtered.length, 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = (sel - 1 + filtered.length) % Math.max(filtered.length, 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter') { choose(sel); }
    else if (e.key === 'Escape') { hide(); }
  });
  addEventListener('keydown', (e) => {
    const typing = /input|textarea/i.test(document.activeElement.tagName);
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      pal.hidden ? show() : hide();
    }
  });
}

/* ==========================================================================
   BOOT
   ========================================================================== */
(async function boot() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) scrollTo(0, 0);

  const orbPromise = initOrb();
  initMouse();
  const orb = await orbPromise;
  if (orb) orb.pulse(1.6);
  addEventListener('resize', () => orb && orb.refresh());

  $$('.scramble').forEach((el, i) => scramble(el, 200 + i * 250));
  rotator();
  initReveal();
  initSections(orb);
  initScroll();
  initMagnetic();
  initTilt();
  initFilters(orb);
  initTimeline();
  initCounters();
  initTerminal();
  initBurger();
  initPalette(orb);

  if (location.hash) {
    const t = document.querySelector(location.hash);
    t && setTimeout(() => t.scrollIntoView(), 50);
  }
})();
