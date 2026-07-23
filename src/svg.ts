import { layout, type LayoutNode, type LayoutOptions, type ResolvedOptions } from "./layout.js";
import type { Diagram } from "./model.js";

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));
const n = (x: number) => Number(x.toFixed(3));
const attrs = (node: LayoutNode, base: string) => {
  const classes = ["rrd", base, node.terminal ? "rrd-terminal" : "", node.className].filter(Boolean).join(" ");
  return `class="${esc(classes)}"${node.id ? ` id="${esc(node.id)}"` : ""}`;
};

type RenderLayer = "rails" | "content";

function renderNode(node: LayoutNode, o: ResolvedOptions, layer: RenderLayer): string {
  const r = o.radius, rail = (d: string) => `<path class="rrd-rail" d="${d}"/>`;
  let body = "";
  if (node.kind === "empty") body = layer === "rails" ? rail(`M0 ${n(node.entryY)}H${n(node.width)}`) : "";
  else if (node.kind === "station") {
    const boxX = r, boxW = node.width - 2 * r, round = node.terminal ? r : 2;
    body = layer === "rails"
      ? rail(`M0 ${n(node.entryY)}H${r}M${n(node.width-r)} ${n(node.exitY)}H${n(node.width)}`)
      : `<rect x="${r}" y="0" width="${n(boxW)}" height="${n(node.height)}" rx="${round}"/>` +
        `<text x="${n(node.width/2)}" y="${n(node.height/2)}">${esc(node.text ?? "")}</text>`;
  } else if (node.kind === "row") {
    const cs = node.children ?? [];
    const leftTipY = (p: typeof cs[number]) => p.y + (node.direction === "ltr" ? p.node.entryY : p.node.exitY);
    const rightTipY = (p: typeof cs[number]) => p.y + (node.direction === "ltr" ? p.node.exitY : p.node.entryY);
    body = layer === "rails" && cs.length ? rail(`M0 ${n(leftTipY(cs[0]!))}H${n(cs[0]!.x)}`) : "";
    body += cs.map((p, i) => {
      const before = i ? cs[i - 1]! : undefined;
      const connector = layer === "rails" && before ? rail(`M${n(before.x+before.node.width)} ${n(rightTipY(before))}H${n(p.x)}`) : "";
      return connector + `<g transform="translate(${n(p.x)} ${n(p.y)})">${renderNode(p.node,o,layer)}</g>`;
    }).join("");
    if (layer === "rails" && cs.length) {
      const last = cs.at(-1)!;
      body += rail(`M${n(last.x+last.node.width)} ${n(rightTipY(last))}H${n(node.width)}`);
    }
  } else if (node.kind === "wrapped") {
    const rows = node.rows ?? [], left = 2*r, right = node.width - 2*r;
    body = rows.map(p => `<g transform="translate(${n(p.x)} ${n(p.y)})">${renderNode(p.node,o,layer)}</g>`).join("");
    for (let i=0;i<rows.length-1;i++) {
      const a=rows[i]!, b=rows[i+1]!, ay=a.y+a.node.exitY, by=b.y+b.node.entryY;
      if (o.continuationMarker && layer === "content") body += `<text class="rrd-marker" x="${right}" y="${n(ay)}">${esc(o.continuationMarker)}</text><text class="rrd-marker" x="${left}" y="${n(by)}">${esc(o.continuationMarker)}</text>`;
      else if (!o.continuationMarker && layer === "rails") body += rail(`M${right} ${n(ay)}h${r}q${r} 0 ${r} ${r}v${n(by-ay-2*r)}q0 ${r} -${r} ${r}H${left}`);
    }
  } else if (node.kind === "stack") {
    const top=node.top!, bot=node.bottom!, x0=top.x, x1=x0+top.node.width, ey=node.entryY;
    const branch = (p: typeof top) => {
      const sy=p.y+p.node.entryY, ey2=p.y+p.node.exitY;
      const connector = (startX: number, startY: number, endX: number, endY: number) => {
        const dy = endY - startY;
        if (Math.abs(dy) < .001) return `M${n(startX)} ${n(startY)}H${n(endX)}`;
        const bend = Math.min(r, Math.abs(dy) / 2, Math.abs(endX - startX) / 2);
        const sx = Math.sign(endX - startX), sy = Math.sign(dy);
        return `M${n(startX)} ${n(startY)}H${n(endX - sx * 2 * bend)}` +
          `q${n(sx * bend)} 0 ${n(sx * bend)} ${n(sy * bend)}` +
          `V${n(endY - sy * bend)}q0 ${n(sy * bend)} ${n(sx * bend)} ${n(sy * bend)}` +
          `H${n(endX)}`;
      };
      return rail(connector(0, ey, x0, sy) + connector(x1, ey2, node.width, ey));
    };
    // Paint connectors first, so station fills mask collapsed/nested rails.
    body = (layer === "rails" ? branch(top) + branch(bot) : "") +
      `<g transform="translate(${x0} ${n(top.y)})">${renderNode(top.node,o,layer)}</g>`+
      `<g transform="translate(${x0} ${n(bot.y)})">${renderNode(bot.node,o,layer)}</g>`;
  }
  const label = layer === "content" && node.label ? `<text class="rrd-label" x="0" y="-6">${esc(node.label)}</text>` : "";
  const groupAttrs = layer === "content" ? attrs(node, `rrd-${node.kind}`) : `class="rrd-rail-layer"`;
  return `<g ${groupAttrs}>${label}${body}</g>`;
}

export function renderSvg(diagram: Diagram, options: LayoutOptions = {}): string {
  const result = layout(diagram, options), {node, options:o}=result, margin=Math.max(8,o.radius), labelPad=node.label?o.fontSize+8:0;
  const width=node.width+2*margin, height=node.height+2*margin+labelPad;
  const accessibleLabel = options.accessibleLabel ?? node.label ?? o.accessibleLabel;
  const description = options.accessibleDescription ?? o.accessibleDescription;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="rrd-diagram" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}" role="img" aria-label="${esc(accessibleLabel)}">`+
    `<title>${esc(accessibleLabel)}</title>${description ? `<desc>${esc(description)}</desc>` : ""}`+
    `<style>.rrd-diagram{--rrd-stroke:#222;--rrd-fill:#fff;--rrd-terminal:#f7f7f7;--rrd-text:var(--rrd-stroke);color:var(--rrd-stroke);font-family:${esc(o.fontFamily)};font-size:${n(o.fontSize)}px}.rrd-rail{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.rrd-station rect{fill:var(--rrd-fill);stroke:currentColor;stroke-width:2}.rrd-terminal rect{fill:var(--rrd-terminal)}.rrd-station text{fill:var(--rrd-text);text-anchor:middle;dominant-baseline:central}.rrd-marker{fill:var(--rrd-text);text-anchor:middle;dominant-baseline:central}.rrd-label{fill:var(--rrd-text);font-size:.8em;dominant-baseline:auto}</style>`+
    `<g transform="translate(${margin} ${margin+labelPad})"><g class="rrd-rails">${renderNode(node,o,"rails")}</g><g class="rrd-content">${renderNode(node,o,"content")}</g></g></svg>`;
}

export const toSVG = renderSvg;
