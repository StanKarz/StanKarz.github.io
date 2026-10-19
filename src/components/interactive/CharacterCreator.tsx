import { useState } from 'preact/hooks';
import styles from './CharacterCreator.module.css';

/** One pixel block on the 30 × 44 grid: x, y, width, height, colour. */
type Px = [number, number, number, number, string];
type Draw = (skin: string) => Px[];

interface Piece {
  name: string;
  draw: Draw;
}

const INK = '#1d1712';
const WHITE = '#f4f1ea';

/** Darken (negative) or lighten (positive) a hex colour by a fraction. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) =>
    Math.round(Math.min(255, Math.max(0, amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(channel);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const SKINS = ['#f1c9a5', '#e0ac7e', '#c68642', '#8d5524', '#5c3a1e'];

/** Head, neck, bare arms and torso; clothes go on top. */
const body: Draw = (skin) => [
  [8, 14, 12, 12, skin],
  [6, 14, 2, 12, skin],
  [20, 14, 2, 12, skin],
  [13, 13, 2, 1, shade(skin, -0.12)],
  [10, 5, 8, 8, skin],
  [17, 5, 1, 8, shade(skin, -0.1)],
  [12, 8, 1, 1, INK],
  [15, 8, 1, 1, INK],
  [13, 11, 2, 1, shade(skin, -0.3)],
];

const hands: Draw = (skin) => [
  [6, 26, 2, 2, skin],
  [20, 26, 2, 2, skin],
];

const HEADWEAR: Piece[] = [
  {
    name: 'Pink curls',
    draw: () => {
      const c = '#ff7eb6';
      const d = '#e8559a';
      return [
        [9, 3, 10, 4, c],
        [10, 2, 2, 1, c],
        [13, 2, 2, 1, c],
        [16, 2, 2, 1, c],
        [8, 4, 1, 5, d],
        [19, 4, 1, 5, d],
        [9, 7, 1, 4, d],
        [18, 7, 1, 4, d],
        [10, 5, 8, 2, c],
        [11, 3, 1, 1, d],
        [15, 4, 1, 1, d],
        [12, 6, 1, 1, d],
        [16, 6, 1, 1, d],
      ];
    },
  },
  {
    name: 'Yankees fitted',
    draw: () => [
      [10, 7, 1, 2, INK],
      [17, 7, 1, 2, INK],
      [10, 3, 8, 4, '#13284b'],
      [9, 6, 10, 1, '#0b1a33'],
      [12, 4, 1, 2, WHITE],
      [13, 5, 1, 1, WHITE],
      [14, 4, 1, 2, WHITE],
    ],
  },
  {
    name: 'Carhartt beanie',
    draw: () => [
      [10, 2, 8, 5, '#e07b24'],
      [10, 5, 8, 2, '#c4651a'],
      [13, 5, 2, 1, INK],
    ],
  },
  {
    name: 'Balaclava',
    draw: (skin) => [
      [9, 4, 10, 10, '#232327'],
      [10, 4, 1, 10, '#2f2f34'],
      [11, 7, 6, 4, skin],
      [12, 8, 1, 1, INK],
      [15, 8, 1, 1, INK],
    ],
  },
  {
    name: 'Bucket hat',
    draw: () => [
      [10, 7, 1, 3, INK],
      [17, 7, 1, 3, INK],
      [11, 2, 6, 4, '#e8dcc0'],
      [8, 5, 12, 2, '#d8c9a6'],
    ],
  },
  {
    name: 'Chrome Hearts trucker',
    draw: () => [
      [10, 7, 1, 2, INK],
      [17, 7, 1, 2, INK],
      [10, 3, 8, 4, '#18181b'],
      [9, 6, 10, 1, '#0d0d0f'],
      [13, 3, 1, 3, WHITE],
      [12, 4, 3, 1, WHITE],
    ],
  },
  {
    name: 'Bleached buzz',
    draw: () => [
      [10, 4, 8, 2, '#f1e3a6'],
      [10, 6, 1, 2, '#e2cf86'],
      [17, 6, 1, 2, '#e2cf86'],
    ],
  },
];

/** A short-sleeved tee in any colour. */
function tee(c: string): Px[] {
  return [
    [8, 14, 12, 12, c],
    [6, 14, 2, 4, c],
    [20, 14, 2, 4, c],
    [12, 14, 4, 1, shade(c, -0.15)],
    [19, 15, 1, 11, shade(c, -0.08)],
  ];
}

/** A long-sleeved layer; `wide` makes it oversized. */
function jacket(c: string, wide = false): Px[] {
  const w = wide ? 1 : 0;
  return [
    [8 - w, 14, 12 + 2 * w, 12 + w, c],
    [6 - w, 14, 2 + w, 12, c],
    [20, 14, 2 + w, 12, c],
    [19 + w, 15, 1, 11, shade(c, -0.12)],
  ];
}

const TOPS: Piece[] = [
  {
    name: 'Spray-painted tee',
    draw: () => [
      ...tee(WHITE),
      [9, 16, 2, 1, '#ff4fa3'],
      [10, 17, 1, 1, '#ff4fa3'],
      [15, 19, 3, 1, '#9be22d'],
      [16, 20, 1, 2, '#9be22d'],
      [11, 22, 1, 1, '#33c3f0'],
      [12, 23, 2, 1, '#33c3f0'],
      [17, 16, 1, 1, '#33c3f0'],
      [11, 18, 4, 1, INK],
      [12, 19, 1, 1, INK],
      [14, 19, 1, 1, INK],
    ],
  },
  {
    name: 'Oversized leather',
    draw: () => [
      ...jacket('#1b1b1d', true),
      [12, 14, 4, 13, WHITE],
      [11, 14, 1, 5, '#3a3a3e'],
      [16, 14, 1, 5, '#3a3a3e'],
      [8, 15, 1, 10, '#34343a'],
    ],
  },
  {
    name: "Arc'teryx shell",
    draw: () => {
      const c = '#1f8a8a';
      return [
        ...jacket(c),
        [11, 13, 6, 1, shade(c, -0.2)],
        [14, 14, 1, 12, shade(c, -0.3)],
        [10, 16, 1, 1, WHITE],
        [6, 25, 2, 1, shade(c, -0.25)],
        [20, 25, 2, 1, shade(c, -0.25)],
      ];
    },
  },
  {
    name: 'Silver puffer',
    draw: () => {
      const c = '#c9ccd3';
      const line = shade(c, -0.22);
      return [
        ...jacket(c, true),
        [10, 13, 8, 2, c],
        [7, 17, 14, 1, line],
        [7, 20, 14, 1, line],
        [7, 23, 14, 1, line],
        [5, 18, 3, 1, line],
        [20, 18, 3, 1, line],
        [5, 22, 3, 1, line],
        [20, 22, 3, 1, line],
      ];
    },
  },
  {
    name: 'Carhartt chore coat',
    draw: () => {
      const c = '#b07a3c';
      return [
        ...jacket(c),
        [11, 14, 6, 2, '#5a3b1e'],
        [9, 20, 3, 3, shade(c, -0.15)],
        [16, 20, 3, 3, shade(c, -0.15)],
        [14, 17, 1, 1, INK],
        [14, 21, 1, 1, INK],
      ];
    },
  },
  {
    name: 'Carhartt Detroit jacket',
    draw: () => {
      const c = '#26231f';
      return [
        ...jacket(c),
        [10, 14, 8, 2, '#6b4a2a'],
        [14, 16, 1, 10, shade(c, 0.15)],
        [10, 18, 3, 3, shade(c, 0.1)],
        [11, 18, 1, 1, '#e07b24'],
        [8, 25, 12, 1, shade(c, -0.3)],
      ];
    },
  },
  {
    name: 'Vintage Knicks jersey',
    draw: () => {
      const c = '#1d428a';
      const trim = '#f58426';
      return [
        [9, 14, 10, 12, c],
        [12, 14, 4, 1, trim],
        [13, 15, 2, 1, trim],
        [9, 14, 1, 4, trim],
        [18, 14, 1, 4, trim],
        [9, 25, 10, 1, trim],
        [13, 18, 3, 1, WHITE],
        [15, 19, 1, 1, WHITE],
        [14, 20, 1, 2, WHITE],
      ];
    },
  },
];

const BOTTOMS: Piece[] = [
  {
    name: 'Baggy jeans',
    draw: () => {
      const c = '#4a6fa5';
      return [
        [8, 26, 5, 12, c],
        [15, 26, 5, 12, c],
        [13, 26, 2, 4, c],
        [8, 26, 12, 1, '#2a2017'],
        [8, 34, 5, 1, shade(c, -0.2)],
        [15, 35, 5, 1, shade(c, -0.2)],
        [9, 36, 4, 1, shade(c, 0.2)],
        [16, 33, 3, 1, shade(c, 0.2)],
      ];
    },
  },
  {
    name: 'Denim Tears jeans',
    draw: () => {
      const c = '#8fb3d9';
      // The cotton wreath print: a ring of white pixels around each point.
      const wreath = (x: number, y: number): Px[] => [
        [x - 1, y, 1, 1, WHITE],
        [x + 1, y, 1, 1, WHITE],
        [x, y - 1, 1, 1, WHITE],
        [x, y + 1, 1, 1, WHITE],
      ];
      return [
        [8, 26, 5, 12, c],
        [15, 26, 5, 12, c],
        [13, 26, 2, 4, c],
        [8, 26, 12, 1, '#2a2017'],
        ...wreath(10, 29),
        ...wreath(17, 30),
        ...wreath(11, 34),
        ...wreath(16, 35),
      ];
    },
  },
  {
    name: 'Jorts',
    draw: (skin) => {
      const c = '#5b84bd';
      return [
        [9, 32, 3, 6, skin],
        [16, 32, 3, 6, skin],
        [9, 35, 3, 3, WHITE],
        [16, 35, 3, 3, WHITE],
        [8, 26, 5, 6, c],
        [15, 26, 5, 6, c],
        [13, 26, 2, 4, c],
        [8, 31, 5, 1, '#9cb8de'],
        [15, 31, 5, 1, '#9cb8de'],
      ];
    },
  },
  {
    name: 'Cargo trousers',
    draw: () => {
      const c = '#5d6b3a';
      return [
        [9, 26, 4, 12, c],
        [15, 26, 4, 12, c],
        [13, 26, 2, 4, c],
        [8, 30, 2, 3, shade(c, -0.2)],
        [18, 30, 2, 3, shade(c, -0.2)],
      ];
    },
  },
  {
    name: 'Track pants',
    draw: () => {
      const c = '#18181b';
      return [
        [9, 26, 4, 12, c],
        [15, 26, 4, 12, c],
        [13, 26, 2, 4, c],
        [9, 26, 1, 12, WHITE],
        [18, 26, 1, 12, WHITE],
      ];
    },
  },
  {
    name: 'Plaid skirt',
    draw: () => {
      const c = '#7a1f2b';
      return [
        [9, 31, 3, 7, '#151515'],
        [16, 31, 3, 7, '#151515'],
        [8, 26, 12, 5, c],
        [8, 28, 12, 1, INK],
        [11, 26, 1, 5, INK],
        [16, 26, 1, 5, INK],
      ];
    },
  },
];

/** The left shoe, repeated 8px to the right for the other foot. */
function pair(left: Px[]): Px[] {
  return [...left, ...left.map(([x, y, w, h, c]): Px => [x + 8, y, w, h, c])];
}

const jordan1: Px[] = [
  [8, 35, 5, 3, '#c8202f'],
  [7, 38, 6, 2, WHITE],
  [7, 39, 2, 1, '#c8202f'],
  [12, 38, 1, 2, '#c8202f'],
  [9, 38, 3, 1, INK],
  [7, 40, 6, 1, '#e8e4dc'],
];

const jordan4: Px[] = [
  [8, 36, 5, 2, '#1b1b1d'],
  [7, 38, 6, 2, '#1b1b1d'],
  [8, 36, 1, 1, '#d12a2f'],
  [10, 38, 2, 1, '#8a8a90'],
  [7, 40, 6, 1, WHITE],
  [11, 40, 2, 1, '#d12a2f'],
];

const SHOES: Piece[] = [
  {
    name: 'Moss-covered Timbs',
    draw: () => {
      const c = '#d9a441';
      return [
        [8, 35, 5, 3, c],
        [15, 35, 5, 3, c],
        [7, 38, 6, 2, c],
        [15, 38, 6, 2, c],
        [7, 40, 6, 1, '#4a3520'],
        [15, 40, 6, 1, '#4a3520'],
        [10, 35, 1, 3, '#7a4e1d'],
        [17, 35, 1, 3, '#7a4e1d'],
        [7, 38, 2, 1, '#6f9a2a'],
        [8, 37, 1, 1, '#4f7a1d'],
        [9, 39, 1, 1, '#88b04b'],
        [19, 38, 2, 1, '#6f9a2a'],
        [20, 39, 1, 1, '#4f7a1d'],
        [16, 37, 1, 1, '#88b04b'],
      ];
    },
  },
  { name: "Jordan 1 'Chicago'", draw: () => pair(jordan1) },
  { name: "Jordan 4 'Bred'", draw: () => pair(jordan4) },
  {
    name: 'New Balance 9060s',
    draw: () => [
      [7, 38, 6, 2, '#b9b9bd'],
      [15, 38, 6, 2, '#b9b9bd'],
      [9, 38, 2, 1, '#8a8a90'],
      [17, 38, 2, 1, '#8a8a90'],
      [7, 40, 6, 1, '#e9e6df'],
      [15, 40, 6, 1, '#e9e6df'],
    ],
  },
  {
    name: 'Salomon XT-6s',
    draw: () => [
      [7, 38, 6, 2, '#1b1b1d'],
      [15, 38, 6, 2, '#1b1b1d'],
      [9, 38, 2, 1, '#c6f432'],
      [17, 38, 2, 1, '#c6f432'],
      [7, 40, 6, 1, '#3b3b40'],
      [15, 40, 6, 1, '#3b3b40'],
    ],
  },
  {
    name: 'Adidas Sambas',
    draw: () => [
      [7, 38, 6, 2, WHITE],
      [15, 38, 6, 2, WHITE],
      [10, 38, 1, 2, INK],
      [18, 38, 1, 2, INK],
      [7, 40, 6, 1, '#c48a4a'],
      [15, 40, 6, 1, '#c48a4a'],
    ],
  },
  {
    name: 'Mesh ballet flats',
    draw: () => [
      [9, 38, 3, 1, WHITE],
      [16, 38, 3, 1, WHITE],
      [8, 39, 5, 2, '#c8202f'],
      [15, 39, 5, 2, '#c8202f'],
      [9, 39, 1, 1, '#e8606b'],
      [16, 39, 1, 1, '#e8606b'],
    ],
  },
];

/** A fan opened above the right hand, in alternating paper stripes. */
function paperFan(): Px[] {
  // Each row: y, first x, width. The fan narrows towards the hand.
  const rows: [number, number, number][] = [
    [17, 21, 9],
    [18, 21, 9],
    [19, 22, 7],
    [20, 22, 7],
    [21, 23, 5],
    [22, 23, 5],
    [23, 24, 3],
    [24, 24, 3],
  ];
  const px: Px[] = [];
  for (const [y, x0, w] of rows) {
    for (let i = 0; i < w; i++) px.push([x0 + i, y, 1, 1, (x0 + i) % 2 ? '#e84a3c' : '#2a9d8f']);
  }
  px.push([21, 17, 9, 1, '#f6c445']);
  px.push([25, 25, 1, 2, '#6b4a2a']);
  px.push([22, 26, 3, 1, '#6b4a2a']);
  return px;
}

const EXTRAS: Piece[] = [
  { name: 'Paper fan', draw: paperFan },
  {
    name: 'Umbrella',
    draw: () => [
      [22, 25, 1, 3, '#6b4a2a'],
      [21, 25, 1, 1, '#6b4a2a'],
      [22, 28, 3, 10, '#23232a'],
      [22, 31, 3, 1, '#3a3a44'],
      [23, 38, 1, 2, '#23232a'],
    ],
  },
  {
    name: 'Briefcase',
    draw: () => [
      [21, 27, 3, 1, '#3a2614'],
      [19, 28, 7, 5, '#7a4a24'],
      [22, 29, 1, 1, '#d4af37'],
      [19, 32, 7, 1, '#5a3519'],
    ],
  },
  {
    name: 'Wired headphones',
    draw: () => [
      [9, 9, 1, 1, '#ffffff'],
      [18, 9, 1, 1, '#ffffff'],
      [9, 10, 1, 4, '#ffffff'],
      [18, 10, 1, 4, '#ffffff'],
      [10, 14, 1, 1, '#ffffff'],
      [11, 15, 1, 1, '#ffffff'],
      [12, 16, 1, 1, '#ffffff'],
      [17, 14, 1, 1, '#ffffff'],
      [16, 15, 1, 1, '#ffffff'],
      [15, 16, 1, 1, '#ffffff'],
      [13, 17, 2, 1, '#ffffff'],
      [13, 18, 1, 6, '#ffffff'],
    ],
  },
  {
    name: 'Tote with a Labubu',
    draw: () => [
      [19, 14, 1, 8, '#d9cfb8'],
      [19, 22, 7, 8, '#efe6d2'],
      [20, 24, 5, 1, INK],
      [20, 26, 4, 1, INK],
      [25, 23, 1, 2, '#d4af37'],
      [25, 26, 1, 1, '#8a5a3c'],
      [27, 26, 1, 1, '#8a5a3c'],
      [25, 27, 3, 3, '#8a5a3c'],
      [26, 28, 1, 1, '#f2d6b3'],
    ],
  },
  {
    name: 'Iced coffee',
    draw: () => [
      [23, 19, 1, 3, '#3cb371'],
      [20, 22, 5, 1, WHITE],
      [21, 23, 3, 4, '#d7c3a3'],
      [21, 24, 3, 3, '#6b4226'],
    ],
  },
];

const NECK: Piece[] = [
  { name: 'Nothing', draw: () => [] },
  {
    name: 'Chrome Hearts cross',
    draw: () => {
      const silver = '#d9dde3';
      return [
        [11, 14, 1, 1, silver],
        [12, 15, 1, 1, silver],
        [13, 16, 2, 1, silver],
        [15, 15, 1, 1, silver],
        [16, 14, 1, 1, silver],
        [13, 17, 1, 4, silver],
        [12, 18, 3, 1, silver],
        [14, 17, 1, 1, '#9aa0a8'],
      ];
    },
  },
  {
    name: 'Gold Cuban link',
    draw: () => {
      const gold = '#e0b23a';
      const dark = '#a8801f';
      return [
        [10, 14, 1, 2, gold],
        [11, 15, 1, 2, dark],
        [12, 16, 1, 2, gold],
        [13, 17, 2, 1, dark],
        [13, 16, 2, 1, gold],
        [15, 16, 1, 2, gold],
        [16, 15, 1, 2, dark],
        [17, 14, 1, 2, gold],
      ];
    },
  },
];

const SLOTS = [
  { key: 'head', label: 'Head', pieces: HEADWEAR },
  { key: 'top', label: 'Top', pieces: TOPS },
  { key: 'neck', label: 'Neck', pieces: NECK },
  { key: 'bottoms', label: 'Bottoms', pieces: BOTTOMS },
  { key: 'shoes', label: 'Shoes', pieces: SHOES },
  { key: 'extra', label: 'Extra', pieces: EXTRAS },
] as const;

type SlotKey = (typeof SLOTS)[number]['key'] | 'skin';
type Outfit = Record<SlotKey, number>;

/** The look from the post: wild hair, a spray-painted tee, moss on the Timbs, a paper fan. */
const DEFAULT_OUTFIT: Outfit = { head: 0, top: 0, neck: 0, bottoms: 0, shoes: 0, extra: 0, skin: 1 };

/** MTA route bullet colours. */
const LINE_COLOURS: Record<string, string> = {
  A: '#0039a6',
  B: '#ff6319',
  D: '#ff6319',
  F: '#ff6319',
  M: '#ff6319',
  J: '#996633',
  L: '#a7a9ac',
  N: '#fccc0a',
  R: '#fccc0a',
  W: '#fccc0a',
  '6': '#00933c',
};

/** Yellow bullets take black letters, as on the real signs. */
const DARK_TEXT_LINES = new Set(['N', 'R', 'W']);

const STATIONS = [
  { name: 'Bedford Av', lines: ['L'] },
  { name: 'Canal St', lines: ['6', 'J', 'N'] },
  { name: 'W 4 St–Wash Sq', lines: ['A', 'B', 'F'] },
  { name: 'Delancey St', lines: ['F', 'J', 'M'] },
  { name: 'Jefferson St', lines: ['L'] },
  { name: 'Prince St', lines: ['R', 'W'] },
  { name: '125 St', lines: ['A', 'B', 'D'] },
];

function randomInt(n: number): number {
  return Math.floor(Math.random() * n);
}

export default function CharacterCreator() {
  const [outfit, setOutfit] = useState<Outfit>(DEFAULT_OUTFIT);
  const [station, setStation] = useState(0);

  const skin = SKINS[outfit.skin];
  const layers: Px[] = [
    [7, 41, 15, 1, 'rgb(0 0 0 / 0.18)'],
    ...body(skin),
    ...SHOES[outfit.shoes].draw(skin),
    ...BOTTOMS[outfit.bottoms].draw(skin),
    ...TOPS[outfit.top].draw(skin),
    ...NECK[outfit.neck].draw(skin),
    ...hands(skin),
    ...HEADWEAR[outfit.head].draw(skin),
    ...EXTRAS[outfit.extra].draw(skin),
  ];
  const description = SLOTS.map((s) => s.pieces[outfit[s.key]].name)
    .filter((name) => name !== 'Nothing')
    .join(', ');
  const stop = STATIONS[station];

  function step(key: SlotKey, length: number, by: number) {
    setOutfit((o) => ({ ...o, [key]: (o[key] + by + length) % length }));
  }

  function randomise() {
    setOutfit({
      head: randomInt(HEADWEAR.length),
      top: randomInt(TOPS.length),
      neck: randomInt(NECK.length),
      bottoms: randomInt(BOTTOMS.length),
      shoes: randomInt(SHOES.length),
      extra: randomInt(EXTRAS.length),
      skin: randomInt(SKINS.length),
    });
    setStation((s) => (s + 1 + randomInt(STATIONS.length - 1)) % STATIONS.length);
  }

  return (
    <figure class={styles.wrapper}>
      {/* A station sign: black band, white Helvetica, route bullets on the right. */}
      <div class={styles.sign}>
        <span class={styles.title}>Create a New Yorker</span>
        <span class={styles.bullets} aria-label={`Spotted at ${stop.name}, ${stop.lines.join(' ')} trains`}>
          {stop.lines.map((line) => (
            <span
              key={line}
              class={styles.bullet}
              style={{
                background: LINE_COLOURS[line],
                color: DARK_TEXT_LINES.has(line) ? '#111' : '#fff',
              }}
              aria-hidden="true"
            >
              {line}
            </span>
          ))}
        </span>
      </div>

      <div class={styles.layout}>
        <div class={styles.stage}>
          <span class={styles.mosaic} aria-hidden="true">
            {stop.name}
          </span>
          <svg
            class={styles.sprite}
            viewBox="0 0 31 43"
            shape-rendering="crispEdges"
            role="img"
            aria-label={`A New Yorker wearing: ${description}`}
          >
            {layers.map(([x, y, w, h, fill], i) => (
              <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
            ))}
          </svg>
        </div>

        <div class={styles.controls}>
          {SLOTS.map((slot) => (
            <div key={slot.key} class={styles.row}>
              <span class={styles.label}>{slot.label}</span>
              <button
                type="button"
                class={styles.arrow}
                onClick={() => step(slot.key, slot.pieces.length, -1)}
                aria-label={`Previous ${slot.label.toLowerCase()}`}
              >
                ◀
              </button>
              <span class={styles.value} aria-live="polite">
                {slot.pieces[outfit[slot.key]].name}
              </span>
              <button
                type="button"
                class={styles.arrow}
                onClick={() => step(slot.key, slot.pieces.length, 1)}
                aria-label={`Next ${slot.label.toLowerCase()}`}
              >
                ▶
              </button>
            </div>
          ))}

          <div class={styles.row}>
            <span class={styles.label}>Skin</span>
            <div class={styles.swatches} role="radiogroup" aria-label="Skin tone">
              {SKINS.map((tone, i) => (
                <button
                  key={tone}
                  type="button"
                  role="radio"
                  aria-checked={outfit.skin === i}
                  aria-label={`Skin tone ${i + 1}`}
                  class={styles.swatch}
                  style={{ background: tone }}
                  onClick={() => setOutfit((o) => ({ ...o, skin: i }))}
                />
              ))}
            </div>
          </div>

          <div class={styles.actions}>
            <button type="button" class={styles.primary} onClick={randomise}>
              Randomise
            </button>
            <button
              type="button"
              class={styles.secondary}
              onClick={() => {
                setOutfit(DEFAULT_OUTFIT);
                setStation(0);
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </figure>
  );
}
