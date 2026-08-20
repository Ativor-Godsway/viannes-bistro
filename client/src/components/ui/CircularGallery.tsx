/**
 * A WebGL ring of photographs you can drag or wheel through.
 *
 * Adapted from React Bits' CircularGallery. Four things are different here, and
 * the first one is not optional:
 *
 * ┌─ 1. EVENTS ARE SCOPED TO THE CONTAINER, NOT `window` ────────────────────┐
 * │ The original attaches wheel / mousedown / mousemove / mouseup /          │
 * │ touchstart / touchmove / touchend to `window`. On the demo page the      │
 * │ gallery IS the page, so nothing gives it away. Dropped into a storefront │
 * │ it means every scroll anywhere — over the hero, the menu, the checkout   │
 * │ link — drives the gallery, and a drag started on a product card spins    │
 * │ it. Every one of those listeners is bound to the container below.        │
 * │                                                                          │
 * │ `mousemove`/`mouseup` are the deliberate exception-shaped case: they are │
 * │ bound to the container too, and a drag that leaves the container is      │
 * │ ended by `mouseleave` rather than followed across the page. Tracking a   │
 * │ pointer across the document is exactly the behaviour being removed.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * 2. The render loop is gated. The original runs requestAnimationFrame forever
 *    whether or not the section is anywhere near the viewport. Here an
 *    IntersectionObserver and `visibilitychange` between them decide whether a
 *    frame is worth drawing, and the loop is genuinely cancelled — not merely
 *    early-returning inside a still-scheduled callback.
 *
 * 3. `destroy()` is complete and idempotent, because React 18 StrictMode mounts
 *    effects twice in development. Everything created in the effect — renderer,
 *    canvas, observers, listeners, textures — is torn down by it.
 *
 * 4. No `fontUrl`. The original injects a Google Fonts <link> at runtime;
 *    Poppins is already loaded by index.html, so that is a second network
 *    request for a stylesheet the document has.
 *
 * Reduced motion and WebGL support are NOT decided here — this component is
 * only mounted when both are satisfied. See MemoriesSection.
 */
import { useEffect, useRef } from 'react';
import { Renderer, Camera, Transform, Plane, Mesh, Program, Texture } from 'ogl';
import type { OGLRenderingContext } from 'ogl';

export interface GalleryItem {
  image: string;
  text: string;
}

interface Props {
  items: GalleryItem[];
  bend?: number;
  textColor?: string;
  borderRadius?: number;
  font?: string;
  scrollSpeed?: number;
  scrollEase?: number;
  /**
   * Called when the GL context is lost. The parent is expected to swap to the
   * static fallback — a canvas whose context has gone is a dead grey rectangle,
   * and there is nothing useful to do with it.
   */
  onContextLost?: () => void;
  className?: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Draw a caption to a 2D canvas and hand it over as a texture. */
function createTextTexture(gl: OGLRenderingContext, text: string, font: string, color: string) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  // The font string carries the size; pull it out for the canvas height.
  const size = parseInt(/(\d+)px/.exec(font)?.[1] ?? '26', 10);
  canvas.width = Math.ceil(metrics.width) + 24;
  canvas.height = Math.ceil(size * 1.6);
  // Re-set after resizing: changing width/height resets the 2D context.
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new Texture(gl, { generateMipmaps: false });
  texture.image = canvas;
  return { texture, width: canvas.width, height: canvas.height };
}

const VERTEX = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uSpeed;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // A gentle ripple proportional to scroll speed — the only thing that makes
    // the ring feel like a physical object rather than a carousel.
    p.z = (sin(p.x * 4.0 + uSpeed * 3.0) * 1.5 + cos(p.y * 2.0 + uSpeed * 3.0) * 1.5) * (0.1 + abs(uSpeed) * 0.5);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

/*
 * NOTE ON `fwidth`. The obvious way to antialias the rounded corner is
 * `fwidth(d)`. Don't: in ESSL1 — which is what a WebGL2 context still compiles
 * unless the shader opts into `#version 300 es` — derivative functions require
 * `#extension GL_OES_standard_derivatives : enable` in the SHADER SOURCE.
 * Calling `getExtension()` from JavaScript is not enough, and the failure mode
 * is nasty: the fragment shader silently fails to compile, ogl leaves the
 * program unlinked, and every frame throws out of `Program.use` while the
 * canvas stays blank.
 *
 * So the edge softness is passed in as `uEdge` instead — computed on the CPU
 * from the plane's real on-screen size, which is more accurate anyway and works
 * on every context without a feature test.
 */
const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  uniform vec2 uImageSizes;
  uniform vec2 uPlaneSizes;
  uniform float uBorderRadius;
  uniform float uEdge;
  varying vec2 vUv;

  // Signed distance to a rounded box.
  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 d = abs(p) - b + vec2(r);
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
  }

  void main() {
    // object-fit: cover, in UV space.
    vec2 ratio = vec2(
      min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
      min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
    );
    vec2 uv = vec2(
      vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
      vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
    );
    vec4 colour = texture2D(tMap, uv);

    // Worked in WORLD units, not UV: the card is 3:4, so a radius expressed in
    // UV space would come out as an ellipse rather than a circle.
    vec2 halfSize = uPlaneSizes * 0.5;
    vec2 p = (vUv - 0.5) * uPlaneSizes;
    float radius = uBorderRadius * min(uPlaneSizes.x, uPlaneSizes.y);
    float d = roundedBox(p, halfSize, radius);
    float alpha = 1.0 - smoothstep(-uEdge, uEdge, d);
    if (alpha < 0.001) discard;

    gl_FragColor = vec4(colour.rgb, colour.a * alpha);
  }
`;

const TITLE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(tMap, vUv);
    float a = c.a * uAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(c.rgb, a);
  }
`;

const TITLE_VERTEX = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

interface Screen {
  width: number;
  height: number;
}
interface Viewport {
  width: number;
  height: number;
}

/** One photograph plus its caption, positioned on the ring. */
class Media {
  plane: Mesh;
  title: Mesh | null = null;
  program: Program;
  private titleProgram: Program | null = null;
  extra = 0;
  widthTotal = 0;
  width = 0;
  x = 0;
  isBefore = false;
  isAfter = false;
  private image: HTMLImageElement | null = null;

  constructor(
    private gl: OGLRenderingContext,
    scene: Transform,
    private geometry: Plane,
    private item: GalleryItem,
    private index: number,
    private length: number,
    private bend: number,
    borderRadius: number,
    private font: string,
    private textColor: string,
    screen: Screen,
    private viewport: Viewport,
    private onTextureLoad: () => void
  ) {
    const texture = new Texture(gl, { generateMipmaps: false });
    this.program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      transparent: true,
      uniforms: {
        tMap: { value: texture },
        uSpeed: { value: 0 },
        uImageSizes: { value: [1, 1] },
        uPlaneSizes: { value: [0, 0] },
        uBorderRadius: { value: borderRadius },
        // Half-width of the corner's antialiasing band, in world units. Set
        // from the real pixel scale on every resize; see onResize.
        uEdge: { value: 0.01 },
      },
    });

    const img = new Image();
    this.image = img;
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      texture.image = img;
      this.program.uniforms.uImageSizes.value = [img.naturalWidth, img.naturalHeight];
      this.onTextureLoad();
    };
    img.src = item.image;

    this.plane = new Mesh(gl, { geometry, program: this.program });
    this.plane.setParent(scene);
    this.createTitle();
    this.onResize(screen, viewport);
  }

  private createTitle() {
    const { texture, width, height } = createTextTexture(
      this.gl,
      this.item.text,
      this.font,
      this.textColor
    );
    const program = new Program(this.gl, {
      vertex: TITLE_VERTEX,
      fragment: TITLE_FRAGMENT,
      transparent: true,
      depthTest: false,
      uniforms: { tMap: { value: texture }, uAlpha: { value: 1 } },
    });
    this.titleProgram = program;
    this.title = new Mesh(this.gl, { geometry: this.geometry, program });
    this.title.setParent(this.plane);
    (this.title as unknown as { _aspect: number })._aspect = width / height;
  }

  onResize(screen: Screen, viewport: Viewport) {
    this.viewport = viewport;

    /*
     * Card width as a fraction of the stage. This is NOT one constant: at 0.34
     * a phone shows nearly three cards at once, which makes each one a
     * thumbnail and — because a caption is as wide as its words, not as wide as
     * its card — runs the labels of adjacent cards into each other. Wider cards
     * on a narrow stage means fewer of them, which is the right trade anyway.
     */
    const fraction = screen.width < 768 ? 0.62 : 0.34;
    this.plane.scale.x = this.viewport.width * fraction;
    this.plane.scale.y = this.plane.scale.x * (4 / 3);
    // Never taller than the stage — on a short mobile container the 3:4 card
    // would otherwise run off the top and bottom.
    const maxH = this.viewport.height * 0.72;
    if (this.plane.scale.y > maxH) {
      this.plane.scale.y = maxH;
      this.plane.scale.x = maxH * (3 / 4);
    }
    this.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y];
    // 1.5 device-independent pixels' worth of softness, expressed in the world
    // units the distance field is measured in.
    const pxPerWorldUnit = screen.width / this.viewport.width;
    this.program.uniforms.uEdge.value = 1.5 / Math.max(pxPerWorldUnit, 0.0001);

    if (this.title) {
      const aspect = (this.title as unknown as { _aspect: number })._aspect;
      const h = this.plane.scale.y * 0.1;
      this.title.scale.y = h;
      this.title.scale.x = h * aspect;
      // Below the card. Parent scale is non-uniform, so the child's local
      // offset is expressed in parent units.
      this.title.position.y = -0.5 - h / this.plane.scale.y / 2 - 0.04;
      this.title.scale.x /= this.plane.scale.x;
      this.title.scale.y /= this.plane.scale.y;
    }

    this.width = this.plane.scale.x + this.viewport.width * 0.04;
    this.widthTotal = this.width * this.length;
    this.x = this.width * this.index;
  }

  update(scroll: { current: number; last: number }, direction: 'right' | 'left') {
    this.plane.position.x = this.x - scroll.current - this.extra;

    // Bend the row into an arc: the further from centre, the further back and
    // the more rotated, which is what makes it read as a cylinder.
    const x = this.plane.position.x;
    const H = this.viewport.width / 2;
    if (this.bend === 0) {
      this.plane.position.y = 0;
      this.plane.rotation.z = 0;
    } else {
      const B = Math.abs(this.bend);
      const R = (H * H + B * B) / (2 * B);
      const effectiveX = Math.min(Math.abs(x), H);
      const arc = R - Math.sqrt(R * R - effectiveX * effectiveX);
      const sign = this.bend > 0 ? 1 : -1;
      this.plane.position.y = -sign * arc;
      this.plane.rotation.z = -sign * Math.sign(x) * Math.asin(effectiveX / R);
    }

    this.program.uniforms.uSpeed.value = scroll.current - scroll.last;

    /*
     * Only the card nearest the centre keeps its caption.
     *
     * A caption is as wide as its words, not as wide as its card, so on a
     * narrow stage "The garden after dark" and "Long lunch, longer talk"
     * physically overlap between two adjacent cards. Fading by distance fixes
     * that at every width, and reads as focus rather than as a workaround —
     * the ring gets one label, on the thing you are actually looking at.
     */
    if (this.titleProgram) {
      const t = Math.abs(x) / Math.max(this.width, 0.0001);
      this.titleProgram.uniforms.uAlpha.value = Math.max(0, Math.min(1, 1 - (t - 0.15) / 0.45));
    }

    // Wrap: once a card is fully past an edge, jump it a whole row-length round.
    const planeOffset = this.plane.scale.x / 2;
    const viewportOffset = this.viewport.width / 2;
    this.isBefore = this.plane.position.x + planeOffset < -viewportOffset;
    this.isAfter = this.plane.position.x - planeOffset > viewportOffset;
    if (direction === 'right' && this.isBefore) {
      this.extra -= this.widthTotal;
      this.isBefore = this.isAfter = false;
    }
    if (direction === 'left' && this.isAfter) {
      this.extra += this.widthTotal;
      this.isBefore = this.isAfter = false;
    }
  }

  destroy() {
    if (this.image) {
      this.image.onload = null;
      // Abort a still-in-flight decode so a late load can't touch a dead GL ctx.
      this.image.src = '';
      this.image = null;
    }
  }
}

interface AppOptions {
  items: GalleryItem[];
  bend: number;
  textColor: string;
  borderRadius: number;
  font: string;
  scrollSpeed: number;
  scrollEase: number;
}

class App {
  private renderer: Renderer;
  private gl: OGLRenderingContext;
  private camera: Camera;
  private scene: Transform;
  private planeGeometry!: Plane;
  private medias: Media[] = [];
  private screen: Screen = { width: 0, height: 0 };
  private viewport: Viewport = { width: 0, height: 0 };
  private scroll = { ease: 0.03, current: 0, target: 0, last: 0, position: 0 };
  private isDown = false;
  private start = 0;
  private raf: number | null = null;
  private running = false;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private onVisibility!: () => void;
  private onContextLost!: (e: Event) => void;
  private visible = false;

  constructor(
    private container: HTMLElement,
    private opts: AppOptions,
    private onLost: () => void
  ) {
    this.scroll.ease = opts.scrollEase;

    this.renderer = new Renderer({
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);
    this.container.appendChild(this.gl.canvas);
    this.gl.canvas.style.display = 'block';
    this.gl.canvas.style.width = '100%';
    this.gl.canvas.style.height = '100%';
    // The canvas is decorative duplication of the sr-only list beside it.
    this.gl.canvas.setAttribute('aria-hidden', 'true');

    this.camera = new Camera(this.gl);
    this.camera.fov = 45;
    this.camera.position.z = 20;

    this.scene = new Transform();
    this.planeGeometry = new Plane(this.gl, { heightSegments: 50, widthSegments: 100 });

    this.onResize();
    this.createMedias();
    this.bindEvents();
  }

  private createMedias() {
    const { items, bend, borderRadius, font, textColor } = this.opts;
    this.medias = items.map(
      (item, i) =>
        new Media(
          this.gl,
          this.scene,
          this.planeGeometry,
          item,
          i,
          items.length,
          bend,
          borderRadius,
          font,
          textColor,
          this.screen,
          this.viewport,
          () => this.requestFrame()
        )
    );
  }

  /* ── Events. Every pointer listener below is on `this.container`. ───────── */

  private onWheel = (e: WheelEvent) => {
    // Bound to the container, so this only ever fires with the pointer over the
    // gallery. deltaY is normalised across the three deltaMode units.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.screen.height : 1;
    const delta = (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
    this.scroll.target += delta * 0.01 * this.opts.scrollSpeed;
    this.requestFrame();
  };

  private onDown = (e: MouseEvent | TouchEvent) => {
    this.isDown = true;
    this.scroll.position = this.scroll.current;
    this.start = 'touches' in e ? e.touches[0].clientX : e.clientX;
  };

  private onMove = (e: MouseEvent | TouchEvent) => {
    if (!this.isDown) return;
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const distance = (this.start - x) * (this.opts.scrollSpeed * 0.025);
    this.scroll.target = this.scroll.position + distance;
    this.requestFrame();
  };

  private onUp = () => {
    this.isDown = false;
  };

  private onResizeBound = () => this.onResize();

  private bindEvents() {
    const c = this.container;
    // passive: the gallery never calls preventDefault, and declaring so keeps
    // the browser's scrolling off the main thread.
    c.addEventListener('wheel', this.onWheel as EventListener, { passive: true });
    c.addEventListener('mousedown', this.onDown as EventListener);
    c.addEventListener('mousemove', this.onMove as EventListener);
    c.addEventListener('mouseup', this.onUp);
    // A drag that wanders off the gallery ends there rather than being followed
    // across the document — following it is the behaviour being removed.
    c.addEventListener('mouseleave', this.onUp);
    c.addEventListener('touchstart', this.onDown as EventListener, { passive: true });
    c.addEventListener('touchmove', this.onMove as EventListener, { passive: true });
    c.addEventListener('touchend', this.onUp, { passive: true });
    c.addEventListener('touchcancel', this.onUp, { passive: true });

    // Only `resize` belongs on window.
    window.addEventListener('resize', this.onResizeBound);
    // ResizeObserver catches container-only changes that no window resize fires
    // for — the section growing when the fallback list wraps, for instance.
    this.resizeObserver = new ResizeObserver(this.onResizeBound);
    this.resizeObserver.observe(c);

    this.onVisibility = () => this.setRunning(this.visible && !document.hidden);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.visible = entry.isIntersecting;
        this.setRunning(this.visible && !document.hidden);
      },
      { threshold: 0 }
    );
    this.intersectionObserver.observe(c);

    this.onContextLost = (e) => {
      e.preventDefault();
      this.onLost();
    };
    this.gl.canvas.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onResize() {
    if (this.destroyed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;

    this.screen = { width, height };
    this.renderer.setSize(width, height);
    this.camera.perspective({ aspect: width / height });

    const fov = (this.camera.fov * Math.PI) / 180;
    const viewHeight = 2 * Math.tan(fov / 2) * this.camera.position.z;
    this.viewport = { width: viewHeight * this.camera.aspect, height: viewHeight };

    for (const media of this.medias) media.onResize(this.screen, this.viewport);
    this.requestFrame();
  }

  /* ── The loop. Gated on visibility; genuinely cancelled when idle. ─────── */

  private setRunning(next: boolean) {
    if (this.destroyed || next === this.running) return;
    this.running = next;
    if (next) {
      this.raf = requestAnimationFrame(this.update);
    } else if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  /** Draw one frame even while idle — after a resize, or a late texture. */
  private requestFrame() {
    if (this.destroyed || this.running || this.raf !== null) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      this.render();
    });
  }

  private update = () => {
    if (this.destroyed || !this.running) return;
    this.render();
    this.raf = requestAnimationFrame(this.update);
  };

  private render() {
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease);
    const direction = this.scroll.current > this.scroll.last ? 'right' : 'left';
    for (const media of this.medias) media.update(this.scroll, direction);
    this.renderer.render({ scene: this.scene, camera: this.camera });
    this.scroll.last = this.scroll.current;
  }

  /** Public: the arrow keys nudge the ring by one card. */
  nudge(direction: -1 | 1) {
    const step = this.medias[0]?.width ?? 1;
    this.scroll.target += step * direction;
    this.requestFrame();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.running = false;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;

    const c = this.container;
    c.removeEventListener('wheel', this.onWheel as EventListener);
    c.removeEventListener('mousedown', this.onDown as EventListener);
    c.removeEventListener('mousemove', this.onMove as EventListener);
    c.removeEventListener('mouseup', this.onUp);
    c.removeEventListener('mouseleave', this.onUp);
    c.removeEventListener('touchstart', this.onDown as EventListener);
    c.removeEventListener('touchmove', this.onMove as EventListener);
    c.removeEventListener('touchend', this.onUp);
    c.removeEventListener('touchcancel', this.onUp);
    window.removeEventListener('resize', this.onResizeBound);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;

    for (const media of this.medias) media.destroy();
    this.medias = [];

    this.gl.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    // Release the GL context rather than waiting for GC: browsers cap the number
    // of live contexts, and StrictMode's double-mount would spend two of them.
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl.canvas.parentNode?.removeChild(this.gl.canvas);
  }
}

export default function CircularGallery({
  items,
  bend = 2.5,
  textColor = '#733F0F',
  borderRadius = 0.06,
  font = '600 26px Poppins',
  scrollSpeed = 2,
  scrollEase = 0.03,
  onContextLost,
  className = '',
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Held in a ref and read late, so a parent re-render never re-runs the effect
  // and rebuilds the entire GL scene.
  const lostRef = useRef(onContextLost);
  lostRef.current = onContextLost;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const app = new App(
      el,
      { items, bend, textColor, borderRadius, font, scrollSpeed, scrollEase },
      () => lostRef.current?.()
    );

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') app.nudge(1);
      else if (e.key === 'ArrowLeft') app.nudge(-1);
      else return;
      e.preventDefault();
    };
    el.addEventListener('keydown', onKeyDown);

    // Runs on StrictMode's synthetic unmount too, which is the point: two
    // canvases and two rAF loops is exactly what this has to prevent.
    return () => {
      el.removeEventListener('keydown', onKeyDown);
      app.destroy();
    };
  }, [items, bend, textColor, borderRadius, font, scrollSpeed, scrollEase]);

  return (
    <div ref={ref} className={`h-full w-full cursor-grab active:cursor-grabbing ${className}`} />
  );
}
