export interface Rect { x: number; y: number; w: number; h: number; }
export interface ArenaRect { x: number; y: number; w: number; h: number; }

/** Un layout renvoie la liste des obstacles (murs internes) pour une arène donnée. */
export interface RoomLayout {
  id: string;
  obstacles(a: ArenaRect): Rect[];
}

export const ROOM_LAYOUTS: RoomLayout[] = [
  { id: 'open', obstacles: () => [] },
  {
    id: 'pillars4',
    obstacles: (a) => {
      const s = 58;
      return [
        { x: a.x + a.w * 0.26 - s / 2, y: a.y + a.h * 0.3 - s / 2, w: s, h: s },
        { x: a.x + a.w * 0.74 - s / 2, y: a.y + a.h * 0.3 - s / 2, w: s, h: s },
        { x: a.x + a.w * 0.26 - s / 2, y: a.y + a.h * 0.7 - s / 2, w: s, h: s },
        { x: a.x + a.w * 0.74 - s / 2, y: a.y + a.h * 0.7 - s / 2, w: s, h: s },
      ];
    },
  },
  {
    id: 'central',
    obstacles: (a) => [{ x: a.x + a.w / 2 - 90, y: a.y + a.h / 2 - 60, w: 180, h: 120 }],
  },
  {
    id: 'corners',
    obstacles: (a) => {
      const w = 150, h = 96;
      return [
        { x: a.x, y: a.y, w, h },
        { x: a.x + a.w - w, y: a.y, w, h },
        { x: a.x, y: a.y + a.h - h, w, h },
        { x: a.x + a.w - w, y: a.y + a.h - h, w, h },
      ];
    },
  },
  {
    id: 'sidebars',
    obstacles: (a) => {
      const w = 46, h = a.h * 0.5;
      return [
        { x: a.x + a.w * 0.32 - w / 2, y: a.y + a.h / 2 - h / 2, w, h },
        { x: a.x + a.w * 0.68 - w / 2, y: a.y + a.h / 2 - h / 2, w, h },
      ];
    },
  },
  {
    id: 'pillars2',
    obstacles: (a) => {
      const s = 64;
      return [
        { x: a.x + a.w * 0.4 - s / 2, y: a.y + a.h * 0.42 - s / 2, w: s, h: s },
        { x: a.x + a.w * 0.6 - s / 2, y: a.y + a.h * 0.6 - s / 2, w: s, h: s },
      ];
    },
  },
];

export function randomLayout(rng: () => number): RoomLayout {
  return ROOM_LAYOUTS[Math.floor(rng() * ROOM_LAYOUTS.length)];
}
export function layoutById(id: string): RoomLayout {
  return ROOM_LAYOUTS.find((l) => l.id === id) ?? ROOM_LAYOUTS[0];
}
