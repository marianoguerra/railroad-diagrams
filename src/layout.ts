import type { Align, Diagram, Direction, Justify, Metadata } from "./model.js";

export interface LayoutOptions {
  width?: number;
  direction?: Direction;
  align?: Align;
  justify?: Justify;
  gap?: number;
  rowGap?: number;
  fontSize?: number;
  fontFamily?: string;
  paddingX?: number;
  paddingY?: number;
  radius?: number;
  continuationMarker?: string;
  flexAbsorb?: number;
  measureText?: (text: string, fontSize: number, fontFamily: string) => number;
}

export interface ResolvedOptions {
  width: number; direction: Direction; align: Align; justify: Justify;
  gap: number; rowGap: number; fontSize: number; fontFamily: string;
  paddingX: number; paddingY: number; radius: number;
  continuationMarker: string; flexAbsorb: number;
  measureText: (text: string, fontSize: number, fontFamily: string) => number;
}

export interface LayoutNode extends Metadata {
  kind: "empty" | "station" | "row" | "wrapped" | "stack";
  width: number;
  height: number;
  entryY: number;
  exitY: number;
  direction: Direction;
  terminal?: boolean;
  text?: string;
  children?: PositionedLayout[];
  rows?: PositionedLayout[];
  top?: PositionedLayout;
  bottom?: PositionedLayout;
  polarity?: "positive" | "negative";
}
export interface PositionedLayout { x: number; y: number; node: LayoutNode }
export interface Widths { min: number; max: number }

const defaults: ResolvedOptions = {
  width: 640, direction: "ltr", align: "baseline", justify: "start",
  gap: 20, rowGap: 24, fontSize: 15, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  paddingX: 10, paddingY: 7, radius: 10, continuationMarker: "", flexAbsorb: 0.1,
  measureText: (text, size) => [...text].reduce((n, c) => n + (/[^\x00-\xff]/.test(c) ? 1 : .61), 0) * size,
};

export function resolveOptions(options: LayoutOptions = {}): ResolvedOptions {
  const o = { ...defaults, ...options };
  for (const key of ["width", "gap", "rowGap", "fontSize", "paddingX", "paddingY", "radius"] as const)
    if (!Number.isFinite(o[key]) || o[key] < 0) throw new RangeError(`${key} must be a finite non-negative number`);
  if (o.flexAbsorb < 0 || o.flexAbsorb > 1) throw new RangeError("flexAbsorb must be between 0 and 1");
  return o;
}

function stationWidth(d: Extract<Diagram, {type: "terminal" | "nonterminal"}>, o: ResolvedOptions): number {
  return Math.max(2 * o.radius, o.measureText(d.text, o.fontSize, o.fontFamily) + 2 * o.paddingX) + 2 * o.radius;
}

export function contentWidths(d: Diagram, options: LayoutOptions | ResolvedOptions = {}): Widths {
  const o = "measureText" in options && "continuationMarker" in options ? options as ResolvedOptions : resolveOptions(options);
  switch (d.type) {
    case "terminal": case "nonterminal": { const w = stationWidth(d, o); return { min: w, max: w }; }
    case "sequence": {
      if (!d.items.length) return { min: 0, max: 0 };
      const ws = d.items.map(x => contentWidths(x, o));
      return { min: Math.max(...ws.map(x => x.min)) + 4 * o.radius,
        max: ws.reduce((n, x) => n + x.max, o.gap * (ws.length - 1)) };
    }
    case "stack": {
      const a = contentWidths(d.top, o), b = contentWidths(d.bottom, o);
      return { min: Math.max(a.min, b.min) + 6 * o.radius, max: Math.max(a.max, b.max) + 6 * o.radius };
    }
  }
}

type Partition = Diagram[][];
function partitions(items: Diagram[]): Partition[] {
  if (!items.length) return [[[]]];
  let out: Partition[] = [[[items[0]!]]];
  for (const item of items.slice(1)) out = out.flatMap(p => [
    [...p, [item]],
    [...p.slice(0, -1), [...p[p.length - 1]!, item]],
  ]);
  return out;
}

function rowBounds(items: Diagram[], o: ResolvedOptions): Widths {
  if (!items.length) return { min: 0, max: 0 };
  const ws = items.map(x => contentWidths(x, o));
  return { min: ws.reduce((n, x) => n + x.min, o.gap * (items.length - 1)),
    max: ws.reduce((n, x) => n + x.max, o.gap * (items.length - 1)) };
}

function choosePartition(items: Diagram[], width: number, depth: number, o: ResolvedOptions): Partition {
  const marker = o.continuationMarker ? o.measureText(o.continuationMarker, o.fontSize, o.fontFamily) + o.radius : 2 * o.radius;
  const candidates = partitions(items).map(rows => {
    const bs = rows.map(r => rowBounds(r, o));
    const min = Math.max(...bs.map((b, i) => b.min + (rows.length > 1 ? (i === 0 || i === rows.length - 1 ? marker : 2 * marker) : 0)));
    const max = Math.max(...bs.map(b => b.max));
    const wrapPenalty = rows.length * 10 * 2 ** (2 * depth);
    return { rows, min, max, score: wrapPenalty + Math.max(0, max - width) ** 2 };
  });
  const fitting = candidates.filter(c => c.min <= width + .001);
  return (fitting.length ? fitting : candidates).sort((a, b) => a.score - b.score || a.max - b.max)[0]!.rows;
}

function distribute(total: number, count: number, minGap: number, policy: Justify, direction: Direction): number[] {
  if (!count) return [total];
  const innerBase = minGap * Math.max(0, count - 1), extra = Math.max(0, total - innerBase);
  const start = policy === "start" ? 0 : policy === "end" ? extra : policy === "center" ? extra / 2 :
    policy === "space-around" ? extra / (2 * count) : policy === "space-evenly" ? extra / (count + 1) : 0;
  const end = policy === "start" ? extra : policy === "end" ? 0 : policy === "center" ? extra / 2 : start;
  let inner = count <= 1 ? 0 : minGap;
  if (policy === "space-between" && count > 1) inner += extra / (count - 1);
  if (policy === "space-around") inner += extra / count;
  if (policy === "space-evenly") inner += extra / (count + 1);
  const rails = [start, ...Array(Math.max(0, count - 1)).fill(inner), end];
  return direction === "rtl" ? rails.reverse() : rails;
}

function layoutRow(items: Diagram[], target: number, depth: number, o: ResolvedOptions, direction: Direction): LayoutNode {
  if (!items.length) return { kind: "empty", width: target, height: 2, entryY: 1, exitY: 1, direction };
  const bounds = items.map(x => contentWidths(x, o));
  const base = bounds.reduce((n, x) => n + x.min, 0);
  let available = Math.max(0, target - base - o.gap * (items.length - 1));
  const growth = bounds.map(x => x.max - x.min), sumGrowth = growth.reduce((a, b) => a + b, 0);
  const grown = Math.min(available, sumGrowth);
  const widths = bounds.map((b, i) => b.min + (sumGrowth ? grown * growth[i]! / sumGrowth : 0));
  available -= grown;
  const absorbed = available * o.flexAbsorb;
  const rails = distribute(o.gap * (items.length - 1) + absorbed, items.length, o.gap, o.justify, direction);
  const leftover = available - absorbed;
  if (leftover && sumGrowth) widths.forEach((_, i) => widths[i]! += leftover * Math.max(1, bounds[i]!.max) / bounds.reduce((n, b) => n + Math.max(1, b.max), 0));
  else rails[direction === "ltr" ? rails.length - 1 : 0]! += leftover;
  const childNodes = items.map((d, i) => layoutRec(d, widths[i]!, depth + 1, o, direction));
  const baseline = Math.max(...childNodes.map(n => n.entryY));
  const ys = childNodes.map(n => baseline - n.entryY);
  const height = Math.max(...childNodes.map((n, i) => ys[i]! + n.height));
  const visual = direction === "ltr" ? childNodes.map((n, i) => ({ n, i })) : childNodes.map((n, i) => ({ n, i })).reverse();
  let x = rails[0]!;
  const children: PositionedLayout[] = [];
  visual.forEach(({n, i}, vi) => { children.push({ x, y: ys[i]!, node: n }); x += n.width + rails[vi + 1]!; });
  const first = children[0]!, last = children[children.length - 1]!;
  const start = direction === "ltr" ? first : last;
  const end = direction === "ltr" ? last : first;
  return { kind: "row", width: target, height, entryY: start.y + start.node.entryY,
    exitY: end.y + end.node.exitY, direction, children };
}

function layoutSequence(d: Extract<Diagram, {type: "sequence"}>, width: number, depth: number, o: ResolvedOptions, direction: Direction): LayoutNode {
  if (!d.items.length) return { ...d, kind: "empty", width, height: 2, entryY: 1, exitY: 1, direction };
  const rows = choosePartition(d.items, width, depth, o);
  if (rows.length === 1) return { ...layoutRow(rows[0]!, width, depth, o, direction), ...d, kind: "row" };
  const laid = rows.map(r => layoutRow(r, width - 4 * o.radius, depth, o, direction));
  const positioned: PositionedLayout[] = [];
  let y = 0;
  laid.forEach(n => { positioned.push({ x: 2 * o.radius, y, node: n }); y += n.height + o.rowGap; });
  const height = y - o.rowGap;
  return { ...d, kind: "wrapped", width, height, entryY: positioned[0]!.node.entryY,
    exitY: positioned.at(-1)!.y + positioned.at(-1)!.node.exitY, direction, rows: positioned };
}

function layoutRec(d: Diagram, width: number, depth: number, o: ResolvedOptions, direction: Direction): LayoutNode {
  switch (d.type) {
    case "terminal": case "nonterminal": {
      const natural = stationWidth(d, o), h = o.fontSize + 2 * o.paddingY;
      const station: LayoutNode = { ...d, kind: "station", terminal: d.type === "terminal", width: natural, height: h,
        entryY: h / 2, exitY: h / 2, direction };
      if (width <= natural + .001) return station;
      const [before] = distribute(width - natural, 1, 0, o.justify, direction);
      return { kind: "row", width, height: h, entryY: h / 2, exitY: h / 2, direction,
        children: [{ x: before!, y: 0, node: station }] };
    }
    case "sequence": return layoutSequence(d, width, depth, o, direction);
    case "stack": {
      const innerWidth = Math.max(0, width - 6 * o.radius);
      const top = layoutRec(d.top, innerWidth, depth + 1, o, direction);
      const polarity = d.polarity ?? "positive";
      const bottom = layoutRec(d.bottom, innerWidth, depth + 1, o, polarity === "negative" ? (direction === "ltr" ? "rtl" : "ltr") : direction);
      const bottomY = top.height + o.rowGap, height = bottomY + bottom.height;
      const entryY = o.align === "top" ? top.entryY : o.align === "bottom" ? bottomY + bottom.entryY :
        o.align === "center" ? height / 2 : (d.top.type === "sequence" && !d.top.items.length ? bottomY + bottom.entryY : top.entryY);
      return { ...d, kind: "stack", width, height, entryY, exitY: entryY, direction, polarity,
        top: { x: 3 * o.radius, y: 0, node: top }, bottom: { x: 3 * o.radius, y: bottomY, node: bottom } };
    }
  }
}

export function layout(diagram: Diagram, options: LayoutOptions = {}): { node: LayoutNode; options: ResolvedOptions } {
  const o = resolveOptions(options), bounds = contentWidths(diagram, o);
  const width = Math.max(o.width <= 1 ? bounds.max * o.width : o.width, bounds.min);
  return { node: layoutRec(diagram, width, 0, o, o.direction), options: o };
}
