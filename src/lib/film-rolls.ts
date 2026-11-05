/**
 * Two film rolls running in opposite directions.
 *
 * The DOM keeps what must stay accessible and selectable: buttons, focus order and the amber edge
 * print. One WebGL canvas behind it paints the film itself: the strip, the perforations and every
 * photo. Painting them in a shader is what makes the develop effect possible, because a CSS filter
 * or crossfade between a photo and its negative passes through flat grey at the halfway point.
 * Here each pixel flips at its own moment instead, darkest tones first, as a print comes up in a
 * developing tray.
 */

/** How quickly the film catches up with the wheel, per second. */
const SMOOTHING = 9;
/** Idle drift in px per second, and the seconds without input before it starts. */
const DRIFT_SPEED = 16;
const DRIFT_DELAY = 2.5;
/** Above this speed (viewport heights per second) developed frames fall back to negative. */
const FLING_SPEED = 2.2;
/** How fast frames lose their development at twice the fling speed, per second. */
const UNDEVELOP_RATE = 5;
const DEVELOP_SECONDS = 1.15;
/** Longest random wait before a frame starts developing, so a screenful doesn't flip in unison. */
const DEVELOP_STAGGER = 0.4;
/** Motion blur: starts at this speed (viewport heights per second), then px of blur per px/s. */
const BLUR_START = 0.45;
const BLUR_GAIN = 0.032;
const BLUR_MAX = 150;
/** Sideways gate weave at speed, in px per px/s, capped. */
const WEAVE_GAIN = 0.0005;
const WEAVE_MAX = 2.2;
/** Perforation geometry as fractions of the rebate width. */
const HOLE_WIDTH = 0.42;
const HOLE_LANE = 0.66;
const HOLE_ASPECT = 1.3;
const HOLE_PITCH = 2.1;
const MAX_DPR = 2;
const MAX_TEXTURES = 26;
const MAX_CONCURRENT_LOADS = 3;
/** Fetch textures for frames within this many viewport heights of the screen. */
const PRELOAD_VIEWPORTS = 1.25;
const KEY_STEP = 150;
const PAGE_STEP = 0.8;
const TOUCH_GAIN = 1.25;
const TOUCH_THROW = 0.28;

const VERTEX = `#version 300 es
in vec2 a_corner;
uniform vec4 u_rect;
uniform vec2 u_res;
out vec2 v_uv;
out vec2 v_px;
void main() {
  v_uv = a_corner;
  v_px = a_corner * u_rect.zw;
  vec2 clip = (u_rect.xy + v_px) / u_res * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const SHARED = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_px;
out vec4 o_colour;

/* Signed distance to a rounded box centred on the origin: negative inside. */
float box(vec2 p, vec2 half_size, float radius) {
  vec2 q = abs(p) - half_size + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}
`;

const STRIP_FRAGMENT = `${SHARED}
uniform float u_width;
uniform float u_offset;
uniform float u_pitch;
uniform float u_lane;
uniform vec2 u_hole;
uniform float u_negative;
uniform float u_blur;

const vec3 PAGE = vec3(0.039, 0.031, 0.027);
const vec3 BASE = vec3(0.105, 0.082, 0.060);
const vec3 ORANGE_BASE = vec3(0.46, 0.22, 0.09);

void main() {
  float y = mod(v_px.y + u_offset, u_pitch) - u_pitch * 0.5;
  vec2 half_hole = vec2(u_hole.x, u_hole.y + u_blur) * 0.5;
  float radius = u_hole.x * 0.22;
  float left = box(vec2(v_px.x - u_lane, y), half_hole, radius);
  float right = box(vec2(v_px.x - (u_width - u_lane), y), half_hole, radius);
  float hole = 1.0 - smoothstep(-0.7, 0.7, min(left, right));
  // A blurred hole spreads the same light over a longer streak, so it gets fainter.
  hole *= u_hole.y / (u_hole.y + u_blur);
  o_colour = vec4(mix(mix(BASE, ORANGE_BASE, u_negative), PAGE, hole), 1.0);
}`;

const PHOTO_FRAGMENT = `${SHARED}
uniform sampler2D u_photo;
uniform vec2 u_size;
uniform float u_dpr;
uniform float u_develop;
uniform float u_blur;
uniform float u_weave;
uniform float u_ready;
uniform float u_seed;

/* Colour negative film: shadows are thin and show the orange mask, highlights are dense. */
const vec3 MASK = vec3(0.80, 0.44, 0.20);
const vec3 UNEXPOSED = vec3(0.075, 0.058, 0.045);
const float SOFTNESS = 0.13;
const float GRAIN_IN_THRESHOLD = 0.16;
const float GRAIN = 0.034;

/* Dave Hoskins' hash: no sine, so no banding on mobile GPUs. */
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

/* Motion blur. Offsetting the samples by per-pixel noise turns visible echoes into a soft streak. */
vec3 photo(vec2 uv, float noise) {
  if (u_blur < 0.5) return texture(u_photo, uv).rgb;
  vec3 sum = vec3(0.0);
  float reach = u_blur / u_size.y;
  for (int i = 0; i < 11; i++) {
    float t = (float(i) + noise) / 11.0 * 2.0 - 1.0;
    sum += texture(u_photo, vec2(uv.x, clamp(uv.y + reach * t, 0.0, 1.0))).rgb;
  }
  return sum / 11.0;
}

void main() {
  // Grain belongs to the film, so it travels with the frame and holds still when the film does.
  float grain = hash(floor(v_px * u_dpr / 1.5) + u_seed * 17.0);
  vec3 colour = UNEXPOSED;
  if (u_ready > 0.5) {
    vec3 positive = photo(vec2(v_uv.x + u_weave / u_size.x, v_uv.y), grain);
    vec3 negative = (1.0 - positive) * MASK + vec3(0.02, 0.012, 0.006);
    float luminance = dot(positive, vec3(0.2126, 0.7152, 0.0722));
    // The threshold sweeps from black to white, so dark tones turn positive first.
    float sweep = mix(-SOFTNESS - 0.08, 1.0 + SOFTNESS + 0.08, u_develop);
    float undeveloped = smoothstep(
      sweep - SOFTNESS,
      sweep + SOFTNESS,
      luminance + (grain - 0.5) * GRAIN_IN_THRESHOLD
    );
    colour = mix(positive, negative, undeveloped);
  }
  colour += (grain - 0.5) * GRAIN;
  float edge = box(v_px - u_size * 0.5, u_size * 0.5, 2.0);
  o_colour = vec4(colour, 1.0 - smoothstep(-0.7, 0.7, edge));
}`;

interface Source {
  url: string;
  width: number;
}

interface Frame {
  el: HTMLElement;
  sources: Source[];
  /** Photo rectangle: x relative to the stage, top relative to the track. */
  x: number;
  top: number;
  width: number;
  height: number;
  /** 0 is a negative, 1 is a finished print. */
  develop: number;
  wait: number;
  seed: number;
  texture: WebGLTexture | null;
  isLoading: boolean;
}

interface Roll {
  el: HTMLElement;
  track: HTMLElement;
  frames: Frame[];
  /** +1 runs up the screen on a downward scroll, -1 runs down it. */
  direction: 1 | -1;
  start: number;
  x: number;
  width: number;
  /** Length of one full pass of the film, so positions wrap seamlessly. */
  length: number;
  offset: number;
  pitch: number;
  counter: HTMLElement | null;
  shown: number;
}

type Uniforms = Record<string, WebGLUniformLocation | null>;

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}

function compile(gl: WebGL2RenderingContext, fragment: string, names: string[]) {
  const program = gl.createProgram()!;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader failed to compile');
    }
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, 'a_corner');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'Program failed to link');
  }
  const uniforms: Uniforms = {};
  for (const name of ['u_rect', 'u_res', ...names]) uniforms[name] = gl.getUniformLocation(program, name);
  return { program, uniforms };
}

function parseSources(img: HTMLImageElement): Source[] {
  const srcset = img.getAttribute('srcset');
  if (!srcset) return [{ url: img.currentSrc || img.src, width: img.naturalWidth }];
  return srcset
    .split(',')
    .map((part) => {
      const [url, descriptor] = part.trim().split(/\s+/);
      return { url, width: parseInt(descriptor, 10) || 0 };
    })
    .sort((a, b) => a.width - b.width);
}

/** The widest rendition of a frame's photo, for the lightbox. */
export function largestSource(img: HTMLImageElement): string {
  return parseSources(img).at(-1)!.url;
}

/** True when this browser can run the rolls and the visitor hasn't asked for less motion. */
export function canRunFilm(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return Boolean(document.createElement('canvas').getContext('webgl2'));
}

/**
 * Starts the rolls inside `film`. Returns a teardown for the client router to call on navigation.
 *
 * @param film Root element holding the `.stage`, its canvas and the `.roll` sections.
 * @returns A function that stops the loop and releases listeners and GPU memory.
 */
export function startFilm(film: HTMLElement): () => void {
  const stage = film.querySelector<HTMLElement>('.stage')!;
  const canvas = film.querySelector<HTMLCanvasElement>('canvas')!;
  const loupe = film.querySelector<HTMLElement>('.loupe')!;
  const loupePlace = loupe.querySelector<HTMLElement>('.loupe-place')!;
  const loupeFrame = loupe.querySelector<HTMLElement>('.loupe-frame')!;
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false })!;
  const html = document.documentElement;
  const listeners = new AbortController();
  const { signal } = listeners;

  html.classList.add('film-live');
  film.classList.add('live');

  const rolls: Roll[] = [...film.querySelectorAll<HTMLElement>('.roll')].map((el, i) => {
    const track = el.querySelector<HTMLElement>('.track')!;
    const frames = [...track.querySelectorAll<HTMLElement>('.frame')].map((frameEl, j): Frame => {
      const img = frameEl.querySelector<HTMLImageElement>('img')!;
      const sources = parseSources(img);
      // The canvas shows the photo now, so stop the hidden <img> downloading a second copy.
      img.removeAttribute('srcset');
      img.removeAttribute('src');
      return {
        el: frameEl,
        sources,
        x: 0,
        top: 0,
        width: 0,
        height: 0,
        develop: 0,
        wait: Math.random() * DEVELOP_STAGGER,
        seed: i * 100 + j,
        texture: null,
        isLoading: false,
      };
    });
    // One copy of the whole roll follows the first, and the offset wraps by exactly its length.
    for (const child of [...track.children] as HTMLElement[]) {
      const copy = child.cloneNode(true) as HTMLElement;
      copy.setAttribute('aria-hidden', 'true');
      copy.dataset.copy = '';
      copy.querySelectorAll<HTMLElement>('button').forEach((b) => (b.tabIndex = -1));
      if (copy.matches('button')) copy.tabIndex = -1;
      track.append(copy);
    }
    return {
      el,
      track,
      frames,
      direction: i % 2 ? -1 : 1,
      start: 0,
      x: 0,
      width: 0,
      length: 1,
      offset: 0,
      pitch: 30,
      counter: film.querySelector<HTMLElement>(`[data-counter="${el.dataset.roll}"]`),
      shown: -1,
    };
  });

  let dpr = 1;
  let viewWidth = 1;
  let viewHeight = 1;
  let rebate = 34;
  let target = 0;
  let position = 0;
  let speed = 0;
  let lastTime = performance.now();
  let lastInput = -Infinity;
  let isDirty = true;
  let isHovering = false;
  let mouse: { x: number; y: number } | null = null;
  let loupeX = 0;
  let loupeY = 0;
  let activeLoads = 0;
  let textureCount = 0;
  let raf = 0;
  const uploads: { frame: Frame; image: HTMLImageElement }[] = [];

  function measure() {
    const bounds = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    viewWidth = bounds.width;
    viewHeight = bounds.height;
    canvas.width = Math.round(viewWidth * dpr);
    canvas.height = Math.round(viewHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    rebate = parseFloat(getComputedStyle(film).getPropertyValue('--rebate-px')) || 34;

    for (const roll of rolls) {
      roll.x = roll.el.offsetLeft;
      roll.width = roll.el.offsetWidth;
      const first = roll.track.firstElementChild as HTMLElement;
      const copy = roll.track.querySelector<HTMLElement>('[data-copy]')!;
      roll.length = copy.offsetTop - first.offsetTop;
      // A whole number of perforations per pass, so the wrap never jumps.
      const pitch = rebate * HOLE_WIDTH * HOLE_ASPECT * HOLE_PITCH;
      roll.pitch = roll.length / Math.max(1, Math.round(roll.length / pitch));
      // Roll B opens on its first photo; Roll A opens on the leader with the title on it.
      const leader = roll.track.querySelector<HTMLElement>('.leader');
      roll.start = roll.direction === -1 && leader ? leader.offsetHeight : 0;
      for (const frame of roll.frames) {
        const img = frame.el.querySelector<HTMLElement>('img')!;
        frame.x = roll.x + frame.el.offsetLeft + img.offsetLeft;
        frame.top = frame.el.offsetTop + img.offsetTop;
        frame.width = img.offsetWidth;
        frame.height = img.offsetHeight;
      }
    }
    isDirty = true;
  }

  let quad: WebGLVertexArrayObject | null = null;
  let strip = null as unknown as ReturnType<typeof compile>;
  let photo = null as unknown as ReturnType<typeof compile>;

  function setUpGpu() {
    strip = compile(gl, STRIP_FRAGMENT, [
      'u_width', 'u_offset', 'u_pitch', 'u_lane', 'u_hole', 'u_negative', 'u_blur',
    ]);
    photo = compile(gl, PHOTO_FRAGMENT, [
      'u_photo', 'u_size', 'u_dpr', 'u_develop', 'u_blur', 'u_weave', 'u_ready', 'u_seed',
    ]);
    quad = gl.createVertexArray();
    gl.bindVertexArray(quad);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.039, 0.031, 0.027, 1);
  }

  /** Screen distance from a frame to the viewport, taking the shorter way round the loop. */
  function distanceToView(roll: Roll, frame: Frame): number {
    const y = mod(frame.top - roll.offset, roll.length);
    const above = y + frame.height - roll.length;
    if (above > 0 || y < viewHeight) return 0;
    return Math.min(y - viewHeight, -above);
  }

  function pickSource(frame: Frame): string {
    const need = frame.width * dpr;
    return (frame.sources.find((s) => s.width >= need) ?? frame.sources.at(-1)!).url;
  }

  function requestTextures() {
    if (activeLoads >= MAX_CONCURRENT_LOADS) return;
    const wanted: { frame: Frame; distance: number }[] = [];
    for (const roll of rolls) {
      for (const frame of roll.frames) {
        if (frame.texture || frame.isLoading) continue;
        const distance = distanceToView(roll, frame);
        if (distance < viewHeight * PRELOAD_VIEWPORTS) wanted.push({ frame, distance });
      }
    }
    wanted.sort((a, b) => a.distance - b.distance);
    for (const { frame } of wanted.slice(0, MAX_CONCURRENT_LOADS - activeLoads)) {
      frame.isLoading = true;
      activeLoads += 1;
      const image = new Image();
      image.src = pickSource(frame);
      image
        .decode()
        .then(() => {
          if (!signal.aborted) uploads.push({ frame, image });
        })
        .catch(() => {
          frame.isLoading = false;
        })
        .finally(() => {
          activeLoads -= 1;
        });
    }
  }

  function evictFarthest() {
    let farthest: Frame | null = null;
    let most = 0;
    for (const roll of rolls) {
      for (const frame of roll.frames) {
        if (!frame.texture) continue;
        const distance = distanceToView(roll, frame);
        if (distance > most) {
          most = distance;
          farthest = frame;
        }
      }
    }
    if (!farthest) return;
    gl.deleteTexture(farthest.texture);
    farthest.texture = null;
    textureCount -= 1;
  }

  /** Uploads block the main thread, so at most one per animation frame. */
  function uploadOne() {
    const next = uploads.shift();
    if (!next) return;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, next.image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    next.frame.texture = texture;
    next.frame.isLoading = false;
    textureCount += 1;
    if (textureCount > MAX_TEXTURES) evictFarthest();
    isDirty = true;
  }

  function updateDevelopment(dt: number) {
    const fling = FLING_SPEED * viewHeight;
    for (const roll of rolls) {
      for (const frame of roll.frames) {
        const before = frame.develop;
        if (speed > fling) {
          frame.develop = Math.max(0, frame.develop - dt * UNDEVELOP_RATE * (speed / fling - 1));
          frame.wait = Math.random() * DEVELOP_STAGGER;
        } else if (frame.texture && frame.develop < 1 && distanceToView(roll, frame) === 0) {
          if (frame.wait > 0) frame.wait -= dt;
          else frame.develop = Math.min(1, frame.develop + dt / DEVELOP_SECONDS);
        }
        if (frame.develop !== before) isDirty = true;
      }
    }
  }

  function drawRoll(roll: Roll, blur: number, weave: number) {
    let developSum = 0;
    let developCount = 0;
    for (const frame of roll.frames) {
      if (distanceToView(roll, frame) === 0) {
        developSum += frame.develop;
        developCount += 1;
      }
    }
    const negative = developCount ? 1 - developSum / developCount : 1;
    // The film base fades back faster than the photos, so a settled strip reads dark sooner.
    const baseNegative = negative * negative;

    const holeWidth = rebate * HOLE_WIDTH;
    gl.useProgram(strip.program);
    gl.uniform2f(strip.uniforms.u_res, viewWidth, viewHeight);
    gl.uniform4f(strip.uniforms.u_rect, roll.x, 0, roll.width, viewHeight);
    gl.uniform1f(strip.uniforms.u_width, roll.width);
    gl.uniform1f(strip.uniforms.u_offset, roll.offset);
    gl.uniform1f(strip.uniforms.u_pitch, roll.pitch);
    gl.uniform1f(strip.uniforms.u_lane, rebate * HOLE_LANE);
    gl.uniform2f(strip.uniforms.u_hole, holeWidth, holeWidth * HOLE_ASPECT);
    gl.uniform1f(strip.uniforms.u_negative, baseNegative);
    gl.uniform1f(strip.uniforms.u_blur, blur);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.useProgram(photo.program);
    gl.uniform2f(photo.uniforms.u_res, viewWidth, viewHeight);
    gl.uniform1f(photo.uniforms.u_dpr, dpr);
    gl.uniform1f(photo.uniforms.u_blur, blur);
    gl.uniform1f(photo.uniforms.u_weave, weave);
    for (const frame of roll.frames) {
      // Each frame can be on screen twice around the seam, so test both copies.
      for (const shift of [0, roll.length]) {
        const y = frame.top + shift - roll.offset;
        if (y + frame.height < 0 || y > viewHeight) continue;
        gl.bindTexture(gl.TEXTURE_2D, frame.texture);
        gl.uniform4f(photo.uniforms.u_rect, frame.x, y, frame.width, frame.height);
        gl.uniform2f(photo.uniforms.u_size, frame.width, frame.height);
        gl.uniform1f(photo.uniforms.u_develop, frame.develop);
        gl.uniform1f(photo.uniforms.u_ready, frame.texture ? 1 : 0);
        gl.uniform1f(photo.uniforms.u_seed, frame.seed);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
  }

  function updateCounters() {
    for (const roll of rolls) {
      if (!roll.counter) continue;
      const centre = mod(roll.offset + viewHeight / 2, roll.length);
      let index = 0;
      roll.frames.forEach((frame, i) => {
        if (frame.top <= centre) index = i;
      });
      if (index !== roll.shown) {
        roll.shown = index;
        roll.counter.textContent = `${roll.el.dataset.roll} ${String(index + 1).padStart(2, '0')}/${roll.frames.length}`;
      }
    }
  }

  function updateLoupe(moved: boolean) {
    if (!mouse) return;
    if (moved) {
      const under = document.elementFromPoint(mouse.x, mouse.y);
      const frame = under?.closest<HTMLElement>('.frame');
      isHovering = Boolean(frame) && !html.classList.contains('lightbox-open');
      loupe.classList.toggle('visible', isHovering);
      if (frame) {
        loupePlace.textContent = frame.dataset.place ?? '';
        loupeFrame.textContent = frame.dataset.label ?? '';
      }
    }
    loupeX += (mouse.x - loupeX) * 0.22;
    loupeY += (mouse.y - loupeY) * 0.22;
    loupe.style.transform = `translate3d(${loupeX}px, ${loupeY}px, 0)`;
  }

  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    // rAF stamps the start of the frame, so the first one can predate lastTime: never let dt go negative.
    const dt = Math.max(0, Math.min((now - lastTime) / 1000, 0.05));
    lastTime = now;
    const isIdle = now - lastInput > DRIFT_DELAY * 1000;
    if (isIdle && !isHovering && !html.classList.contains('lightbox-open')) {
      target += DRIFT_SPEED * dt;
    }
    const previous = position;
    position += (target - position) * (1 - Math.exp(-SMOOTHING * dt));
    const moved = Math.abs(position - previous) > 0.01;
    speed += (Math.abs(position - previous) / Math.max(dt, 0.001) - speed) * Math.min(1, dt * 14);

    for (const roll of rolls) {
      roll.offset = mod(roll.start + roll.direction * position, roll.length);
      if (moved) roll.track.style.transform = `translate3d(0, ${-roll.offset}px, 0)`;
    }

    requestTextures();
    uploadOne();
    updateDevelopment(dt);
    updateCounters();
    updateLoupe(moved || pointerMoved);
    pointerMoved = false;

    if (!moved && !isDirty) return;
    isDirty = false;
    const blur = Math.min(BLUR_MAX, Math.max(0, speed - BLUR_START * viewHeight) * BLUR_GAIN);
    const weave = Math.min(WEAVE_MAX, speed * WEAVE_GAIN) * Math.sin(now * 0.041);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (const roll of rolls) drawRoll(roll, blur, weave * roll.direction);
  }

  let pointerMoved = false;
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      if (!mouse) {
        loupeX = e.clientX;
        loupeY = e.clientY;
      }
      mouse = { x: e.clientX, y: e.clientY };
      pointerMoved = true;
    },
    { signal },
  );
  document.documentElement.addEventListener(
    'pointerleave',
    () => {
      isHovering = false;
      mouse = null;
      loupe.classList.remove('visible');
    },
    { signal },
  );

  window.addEventListener(
    'wheel',
    (e) => {
      if (html.classList.contains('lightbox-open')) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? viewHeight : 1;
      // A sideways swipe on a trackpad feeds the film too.
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      target += delta * unit;
      lastInput = performance.now();
    },
    { passive: false, signal },
  );

  window.addEventListener(
    'keydown',
    (e) => {
      if (html.classList.contains('lightbox-open')) return;
      const page = viewHeight * PAGE_STEP;
      const steps: Record<string, number> = {
        ArrowDown: KEY_STEP,
        ArrowUp: -KEY_STEP,
        PageDown: page,
        PageUp: -page,
        ' ': e.shiftKey ? -page : page,
      };
      if (e.key === ' ' && (e.target as Element).closest?.('button, a')) return;
      if (e.key === 'Home') target = 0;
      else if (e.key in steps) target += steps[e.key];
      else return;
      e.preventDefault();
      lastInput = performance.now();
    },
    { signal },
  );

  let touchY: number | null = null;
  let touchTime = 0;
  let touchVelocity = 0;
  stage.addEventListener(
    'touchstart',
    (e) => {
      touchY = e.touches[0].clientY;
      touchTime = e.timeStamp;
      touchVelocity = 0;
      lastInput = performance.now();
    },
    { passive: true, signal },
  );
  stage.addEventListener(
    'touchmove',
    (e) => {
      if (touchY === null) return;
      const y = e.touches[0].clientY;
      const delta = (touchY - y) * TOUCH_GAIN;
      target += delta;
      touchVelocity = (delta / Math.max(e.timeStamp - touchTime, 1)) * 1000;
      touchY = y;
      touchTime = e.timeStamp;
      lastInput = performance.now();
    },
    { passive: true, signal },
  );
  stage.addEventListener(
    'touchend',
    () => {
      target += touchVelocity * TOUCH_THROW;
      touchY = null;
      lastInput = performance.now();
    },
    { passive: true, signal },
  );

  // Tabbing to a frame winds the film until that frame is centred on screen.
  stage.addEventListener(
    'focusin',
    (e) => {
      const el = (e.target as Element).closest<HTMLElement>('.frame');
      if (!el || !el.matches(':focus-visible')) return;
      for (const roll of rolls) {
        const frame = roll.frames.find((f) => f.el === el);
        if (!frame) continue;
        const wanted = frame.top + frame.height / 2 - viewHeight / 2 - roll.start;
        const here = roll.direction * target;
        // The shortest way round the loop, then converted back into scroll position.
        const delta = mod(wanted - here + roll.length / 2, roll.length) - roll.length / 2;
        target += roll.direction * delta;
        lastInput = performance.now();
      }
    },
    { signal },
  );

  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
    },
    { signal },
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      for (const roll of rolls) {
        for (const frame of roll.frames) {
          frame.texture = null;
          frame.isLoading = false;
        }
      }
      textureCount = 0;
      setUpGpu();
      measure();
      lastTime = performance.now();
      raf = requestAnimationFrame(tick);
    },
    { signal },
  );

  const observer = new ResizeObserver(measure);
  observer.observe(stage);

  setUpGpu();
  measure();
  for (const roll of rolls) {
    roll.offset = mod(roll.start, roll.length);
    roll.track.style.transform = `translate3d(0, ${-roll.offset}px, 0)`;
  }
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    listeners.abort();
    observer.disconnect();
    html.classList.remove('film-live');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
