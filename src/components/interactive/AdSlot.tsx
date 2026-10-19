import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import styles from './AdSlot.module.css';

interface Props {
  /** Which ad of the evening the counter starts on. */
  startCount?: number;
}

/** Parody reels: who's selling, what they're selling, and the moment they're selling it on. */
const REELS: string[][] = [
  ['DraftKings', 'FanDuel', 'BetMGM', 'Kalshi', 'Polymarket', 'Fanatics', 'Caesars'],
  [
    'a same-game parlay',
    'boosted odds',
    'a no-sweat bet',
    'a 12-leg parlay',
    'a live prop',
    'an event contract',
  ],
  [
    'on the next practice swing',
    'on the pitcher shaking off a sign',
    'on the hot dog queue',
    "on the DJ's next song",
    'on a foul ball landing in your lap',
    'on the next ad break',
    'on the seventh-inning stretch',
  ],
];

/** Every pause in play is an ad break. The lever offers the next one. */
const STOPPAGES = [
  'Next practice swing',
  'Red Sox strike out',
  'Cubs strike out',
  'Pitching change',
  'Mound visit',
  'Batter steps out',
  'Foul ball',
  'Pickoff attempt',
  'Replay review',
  'Walk-up song',
  'Middle of the 3rd',
  'End of the 6th',
  'Seventh-inning stretch',
];

/** Each reel spins this long, so they start together and stop left to right. */
const SPIN_MS = [1100, 1500, 1900];
/** Full turns of the drum per reel; later reels turn more so all three spin at a similar speed. */
const LAPS = [3, 4, 5];
/** How far down (0 to 1) the lever has to be dragged before letting go spins the reels. */
const PULL_THRESHOLD = 0.5;
/** Lever travel in px for a full pull; roughly the shaft height in the CSS. */
const LEVER_TRAVEL_PX = 110;
/** A click throws the lever; the reels let go when it hits the bottom. */
const THROW_MS = 450;
const RELEASE_AT_MS = 160;

function randomIndex(length: number, avoid: number): number {
  const pick = Math.floor(Math.random() * (length - 1));
  return pick >= avoid ? pick + 1 : pick;
}

function wrap(reel: string[], i: number): string {
  return reel[((i % reel.length) + reel.length) % reel.length];
}

/** The resting drum: the item on the payline with its neighbours above and below. */
function restingStrip(reel: string[], at: number): string[] {
  return [wrap(reel, at - 1), reel[at], wrap(reel, at + 1)];
}

/**
 * The drum unrolled, top to bottom, in its real order. It spins downwards like a slot reel:
 * it starts with `from` on the payline (second from the bottom) and ends with `to` there (second
 * from the top). Neighbours at both ends match the resting strips, so the swap is invisible.
 */
function spinStrip(reel: string[], from: number, to: number, laps: number): string[] {
  const steps = (((from - to) % reel.length) + reel.length) % reel.length + laps * reel.length;
  return Array.from({ length: steps + 3 }, (_, j) => wrap(reel, to - 1 + j));
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type Phase = 'idle' | 'spinning';

export default function AdSlot({ startCount = 150 }: Props) {
  const [current, setCurrent] = useState<number[]>([0, 0, 0]);
  const [strips, setStrips] = useState<string[][]>(REELS.map((reel) => restingStrip(reel, 0)));
  const [phase, setPhase] = useState<Phase>('idle');
  const [stopped, setStopped] = useState<boolean[]>([true, true, true]);
  const [hasLanded, setHasLanded] = useState(false);
  const [count, setCount] = useState(startCount);
  const [stoppage, setStoppage] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const [isThrowing, setIsThrowing] = useState(false);
  const timers = useRef<number[]>([]);
  const stripRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animations = useRef<Animation[]>([]);
  const pendingTargets = useRef<number[] | null>(null);
  const dragStart = useRef(0);
  const wasDragged = useRef(false);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      animations.current.forEach((a) => a.cancel());
    },
    [],
  );

  // Once the long strips are on screen, run each reel: a small kick up, a fast spin down, then a
  // stop that overshoots and settles back, like a drum hitting its catch.
  useLayoutEffect(() => {
    const targets = pendingTargets.current;
    if (phase !== 'spinning' || !targets) return;
    pendingTargets.current = null;

    animations.current = stripRefs.current.map((el, i) => {
      const strip = el!;
      const item = (strip.firstElementChild as HTMLElement).offsetHeight;
      const half = (strip.parentElement!.clientHeight / item - 1) / 2;
      const y = (line: number) => (half - line) * item;
      const start = y(strips[i].length - 2);
      const end = y(1);
      const anim = strip.animate(
        [
          { transform: `translateY(${start}px)`, easing: 'ease-out' },
          { transform: `translateY(${start - 0.2 * item}px)`, offset: 0.06, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' },
          { transform: `translateY(${end + 0.22 * item}px)`, offset: 0.9, easing: 'ease-in-out' },
          { transform: `translateY(${end}px)` },
        ],
        { duration: SPIN_MS[i], fill: 'forwards' },
      );
      anim.onfinish = () => setStopped((s) => s.map((v, j) => (j === i ? true : v)));
      return anim;
    });

    Promise.all(animations.current.map((a) => a.finished))
      .then(() => {
        setStrips(REELS.map((reel, i) => restingStrip(reel, targets[i])));
        setCurrent(targets);
        setStoppage((s) => randomIndex(STOPPAGES.length, s));
        setPhase('idle');
        setHasLanded(true);
        timers.current.push(window.setTimeout(() => setHasLanded(false), 900));
      })
      .catch(() => {
        // Cancelled on unmount.
      });
  }, [phase, strips]);

  // Back at rest the strips are short again; drop the finished animations before paint.
  useLayoutEffect(() => {
    if (phase !== 'idle') return;
    animations.current.forEach((a) => a.cancel());
    animations.current = [];
  }, [phase]);

  function spin() {
    if (phase !== 'idle') return;
    const targets = REELS.map((reel, i) => randomIndex(reel.length, current[i]));
    setCount((c) => c + 1);

    if (prefersReducedMotion()) {
      setStrips(REELS.map((reel, i) => restingStrip(reel, targets[i])));
      setCurrent(targets);
      setStoppage((s) => randomIndex(STOPPAGES.length, s));
      return;
    }

    pendingTargets.current = targets;
    setStrips(REELS.map((reel, i) => spinStrip(reel, current[i], targets[i], LAPS[i])));
    setStopped([false, false, false]);
    setHasLanded(false);
    setPhase('spinning');
  }

  /** A click or key press throws the lever by itself; a drag past the threshold already did. */
  function throwLever() {
    if (wasDragged.current) {
      wasDragged.current = false;
      return;
    }
    if (phase !== 'idle' || isThrowing) return;
    setIsThrowing(true);
    timers.current.push(window.setTimeout(() => setIsThrowing(false), THROW_MS));
    timers.current.push(window.setTimeout(spin, prefersReducedMotion() ? 0 : RELEASE_AT_MS));
  }

  function onPointerDown(e: PointerEvent) {
    if (phase !== 'idle') return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = e.clientY;
    setDrag(0);
  }

  function onPointerMove(e: PointerEvent) {
    if (drag === null) return;
    setDrag(Math.min(1, Math.max(0, (e.clientY - dragStart.current) / LEVER_TRAVEL_PX)));
  }

  function onPointerUp() {
    if (drag === null) return;
    // Anything more than a nudge counts as a drag, so the click that follows is ignored.
    wasDragged.current = drag > 0.05;
    if (drag >= PULL_THRESHOLD) spin();
    setDrag(null);
  }

  const isBusy = phase !== 'idle';
  const leverClass = [styles.lever, drag !== null ? styles.dragging : '', isThrowing ? styles.throwing : '']
    .filter(Boolean)
    .join(' ');
  const wrapperClass = [styles.wrapper, isBusy ? styles.spinning : '', hasLanded ? styles.landed : '']
    .filter(Boolean)
    .join(' ');
  const label = isBusy ? 'Cut to ad…' : STOPPAGES[stoppage];

  return (
    <figure class={wrapperClass}>
      <div class={styles.marquee}>
        <span class={styles.title}>Fenway Park</span>
        <span class={styles.counter} aria-live="polite">
          Ad #{count} this evening
        </span>
      </div>

      <div class={styles.cabinet}>
        <div class={styles.machine} role="group" aria-label="Gambling ad slot machine">
          {strips.map((strip, i) => (
            <div key={i} class={styles.window}>
              <div
                ref={(el) => (stripRefs.current[i] = el)}
                class={`${styles.strip} ${stopped[i] ? '' : styles.blurred}`}
                style={{
                  // At rest the payline item is index 1; a fresh spin strip starts near the bottom.
                  transform: `translateY(calc((var(--reel-half) - ${isBusy ? strip.length - 2 : 1}) * var(--reel-item)))`,
                }}
              >
                {strip.map((item, j) => (
                  <div key={j} class={styles.item} aria-hidden={isBusy || j !== 1}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          class={leverClass}
          style={drag !== null ? { '--pull': drag } : undefined}
          onClick={throwLever}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
          disabled={isBusy}
          aria-label={`Pull the lever: ${label}`}
        >
          <span class={styles.knob} aria-hidden="true" />
          <span class={styles.shaft} aria-hidden="true">
            <span class={styles.shaftText}>{label}</span>
          </span>
          <span class={styles.base} aria-hidden="true" />
        </button>
      </div>

      <div class={styles.footer}>
        <span>Pull the lever at the next stoppage</span>
        <span>21+. Gambling problem? Call 1-800-GAMBLER.</span>
      </div>
    </figure>
  );
}
