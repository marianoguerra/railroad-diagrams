export type Direction = "ltr" | "rtl";
export type Polarity = "positive" | "negative";
export type Align = "top" | "center" | "bottom" | "baseline";
export type Justify = "start" | "end" | "center" | "space-between" | "space-around" | "space-evenly";

export interface Metadata {
  id?: string;
  className?: string;
  label?: string;
}

export interface Terminal extends Metadata { type: "terminal"; text: string }
export interface Nonterminal extends Metadata { type: "nonterminal"; text: string }
export interface Sequence extends Metadata { type: "sequence"; items: Diagram[] }
export interface Stack extends Metadata {
  type: "stack";
  top: Diagram;
  bottom: Diagram;
  polarity?: Polarity;
}
export type Diagram = Terminal | Nonterminal | Sequence | Stack;

export const terminal = (text: string, meta: Metadata = {}): Terminal => ({ type: "terminal", text, ...meta });
export const nonterminal = (text: string, meta: Metadata = {}): Nonterminal => ({ type: "nonterminal", text, ...meta });
export const sequence = (...items: Diagram[]): Sequence => ({ type: "sequence", items });
export const choice = (top: Diagram, bottom: Diagram, meta: Metadata = {}): Stack =>
  ({ type: "stack", top, bottom, polarity: "positive", ...meta });
export const loop = (forward: Diagram, backward: Diagram, meta: Metadata = {}): Stack =>
  ({ type: "stack", top: forward, bottom: backward, polarity: "negative", ...meta });
export const optional = (item: Diagram, meta: Metadata = {}): Stack =>
  choice(sequence(), item, meta);
export const zeroOrMore = (item: Diagram, separator: Diagram = sequence(), meta: Metadata = {}): Stack =>
  optional(loop(item, separator), meta);
export const oneOrMore = (item: Diagram, separator: Diagram = sequence(), meta: Metadata = {}): Stack =>
  loop(item, separator, meta);

export function alternatives(first: Diagram, ...rest: Diagram[]): Diagram {
  return rest.reduce((top, bottom) => choice(top, bottom), first);
}
