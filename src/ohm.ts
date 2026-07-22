import * as ohm from "ohm-js";
import {
  alternatives,
  nonterminal,
  oneOrMore,
  optional,
  sequence,
  terminal,
  zeroOrMore,
  type Diagram,
} from "./model.js";
import { renderSvg } from "./svg.js";
import type { LayoutOptions } from "./layout.js";

export interface RailroadRule {
  name: string;
  diagram: Diagram;
}

export interface RailroadGrammar {
  name: string;
  rules: RailroadRule[];
}

export interface ExpandRailroadOptions {
  /** Safety limit for unusually deep non-recursive rule chains. */
  maxDepth?: number;
  /** Keep rules with two or more references as nonterminal stations. */
  preserveSharedRules?: boolean;
  /** Maximum approximate number of diagram nodes after expansion. */
  maxNodes?: number;
}

type SemanticValue = Diagram | Diagram[] | RailroadRule | RailroadGrammar | RailroadGrammar[] | string;

const grammarSemantics = ohm.ohmGrammar.createSemantics();

/**
 * Semantics over Ohm's own grammar grammar. It translates parsing expressions
 * to the railroad diagram language while retaining each named rule.
 */
grammarSemantics.addOperation<SemanticValue>("railroad", {
  Grammars(grammarIter) {
    return grammarIter.children.map(child => child.railroad()) as RailroadGrammar[];
  },
  Grammar(name, _superGrammar, _open, rules, _close) {
    return {
      name: name.sourceString,
      rules: rules.children.map(rule => rule.railroad()) as RailroadRule[],
    } satisfies RailroadGrammar;
  },
  Rule_define(name, _formals, _description, _equals, body) {
    return { name: name.sourceString, diagram: body.railroad() as Diagram } satisfies RailroadRule;
  },
  Rule_override(name, _formals, _operator, body) {
    return { name: name.sourceString, diagram: body.railroad() as Diagram } satisfies RailroadRule;
  },
  Rule_extend(name, _formals, _operator, body) {
    return { name: name.sourceString, diagram: body.railroad() as Diagram } satisfies RailroadRule;
  },
  RuleBody(_leadingBar, terms) {
    const choices = terms.railroad() as Diagram[];
    return choices.length === 1 ? choices[0]! : alternatives(choices[0]!, ...choices.slice(1));
  },
  OverrideRuleBody(_leadingBar, terms) {
    const choices = terms.railroad() as Diagram[];
    return choices.length === 1 ? choices[0]! : alternatives(choices[0]!, ...choices.slice(1));
  },
  TopLevelTerm_inline(expr, _caseName) { return expr.railroad(); },
  TopLevelTerm(expr) { return expr.railroad(); },
  OverrideTopLevelTerm_superSplice(_) { return nonterminal("super"); },
  OverrideTopLevelTerm(expr) { return expr.railroad(); },
  Alt(seqs) {
    const choices = seqs.railroad() as Diagram[];
    return choices.length === 1 ? choices[0]! : alternatives(choices[0]!, ...choices.slice(1));
  },
  Seq(exprs) {
    const items = exprs.children.map(expr => expr.railroad() as Diagram);
    return items.length === 0 ? sequence() : items.length === 1 ? items[0]! : sequence(...items);
  },
  Iter_star(expr, _) { return zeroOrMore(expr.railroad() as Diagram); },
  Iter_plus(expr, _) { return oneOrMore(expr.railroad() as Diagram); },
  Iter_opt(expr, _) { return optional(expr.railroad() as Diagram); },
  Iter(expr) { return expr.railroad(); },
  Pred_not(_, expr) { return sequence(terminal("not"), expr.railroad() as Diagram); },
  Pred_lookahead(_, expr) { return sequence(terminal("lookahead"), expr.railroad() as Diagram); },
  Pred(expr) { return expr.railroad(); },
  Lex_lex(_, expr) { return expr.railroad(); },
  Lex(expr) { return expr.railroad(); },
  Base_application(rule, _params) { return nonterminal(rule.sourceString); },
  Base_range(from, _, to) { return terminal(`${decodeOhmTerminal(from.sourceString)}–${decodeOhmTerminal(to.sourceString)}`); },
  Base_terminal(expr) {
    const value = decodeOhmTerminal(expr.sourceString);
    return value === "" ? sequence() : terminal(value);
  },
  Base_paren(_open, expr, _close) { return expr.railroad(); },
  NonemptyListOf(first, _separators, rest) {
    return [first.railroad(), ...rest.children.map(child => child.railroad())] as Diagram[];
  },
  EmptyListOf() { return [] as Diagram[]; },
  _iter(...children) { return children.map(child => child.railroad()) as Diagram[]; },
});

function decodeOhmTerminal(source: string): string {
  // Ohm string terminals use the same common escapes as JSON. Code-point
  // escapes are normalized separately because JSON does not accept \u{...}.
  const normalized = source.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16)));
  return JSON.parse(normalized) as string;
}

/** Parse Ohm grammar source and convert every declared rule to a diagram. */
export function railroadGrammars(grammarSource: string): RailroadGrammar[] {
  const match = ohm.ohmGrammar.match(grammarSource, "Grammars");
  if (match.failed()) throw new SyntaxError(match.message ?? "Invalid Ohm grammar");
  return grammarSemantics(match).railroad() as RailroadGrammar[];
}

/** Convert the first grammar declaration in an Ohm source string. */
export function railroadGrammar(grammarSource: string): RailroadGrammar {
  const grammar = railroadGrammars(grammarSource)[0];
  if (!grammar) throw new SyntaxError("Expected at least one Ohm grammar declaration");
  return grammar;
}

/** Render each rule in an Ohm grammar as an independently displayable SVG. */
export function renderOhmGrammar(grammarSource: string, options: LayoutOptions = {}): Map<string, string> {
  return new Map(railroadGrammar(grammarSource).rules.map(rule => [
    rule.name,
    renderSvg({ ...rule.diagram, label: rule.name }, options),
  ]));
}

/**
 * Inline rule applications until only terminals, built-ins, or recursive
 * cycle-closing references remain. A rule already active on the current path
 * is retained as a nonterminal, making recursive grammars finite.
 */
export function expandRailroadRule(
  grammar: RailroadGrammar,
  ruleName: string,
  options: ExpandRailroadOptions = {},
): Diagram {
  const rules = new Map(grammar.rules.map(rule => [rule.name, rule.diagram]));
  if (!rules.has(ruleName)) throw new Error(`Unknown rule ${JSON.stringify(ruleName)} in grammar ${JSON.stringify(grammar.name)}`);
  const maxDepth = options.maxDepth ?? 64;
  if (!Number.isInteger(maxDepth) || maxDepth < 1) throw new RangeError("maxDepth must be a positive integer");
  const maxNodes = options.maxNodes ?? Number.POSITIVE_INFINITY;
  if (!(maxNodes > 0)) throw new RangeError("maxNodes must be positive");
  const referenceCounts = new Map<string, number>();
  const countReferences = (diagram: Diagram): void => {
    if (diagram.type === "nonterminal") referenceCounts.set(diagram.text, (referenceCounts.get(diagram.text) ?? 0) + 1);
    else if (diagram.type === "sequence") diagram.items.forEach(countReferences);
    else if (diagram.type === "stack") { countReferences(diagram.top); countReferences(diagram.bottom); }
  };
  grammar.rules.forEach(rule => countReferences(rule.diagram));
  let usedNodes = 0;

  const expand = (diagram: Diagram, active: ReadonlySet<string>, depth: number): Diagram => {
    if (diagram.type === "nonterminal") {
      const target = rules.get(diagram.text);
      const shared = options.preserveSharedRules && (referenceCounts.get(diagram.text) ?? 0) > 1;
      if (!target || shared || active.has(diagram.text) || depth >= maxDepth) {
        usedNodes++;
        return diagram;
      }
      const before = usedNodes;
      const expanded = expand(target, new Set([...active, diagram.text]), depth + 1);
      if (usedNodes <= maxNodes) return expanded;
      usedNodes = before + 1;
      return diagram;
    }
    usedNodes++;
    if (diagram.type === "sequence") return { ...diagram, items: diagram.items.map(item => expand(item, active, depth)) };
    if (diagram.type === "stack") return { ...diagram, top: expand(diagram.top, active, depth), bottom: expand(diagram.bottom, active, depth) };
    return diagram;
  };

  return expand(rules.get(ruleName)!, new Set([ruleName]), 0);
}

/** Render one recursively expanded rule, normally the grammar's start rule. */
export function renderOhmRuleFull(
  grammarSource: string,
  ruleName?: string,
  layoutOptions: LayoutOptions = {},
  expandOptions: ExpandRailroadOptions = {},
): string {
  const grammar = railroadGrammar(grammarSource);
  const selected = ruleName ?? grammar.rules[0]?.name;
  if (!selected) throw new Error(`Grammar ${JSON.stringify(grammar.name)} has no rules`);
  const diagram = expandRailroadRule(grammar, selected, expandOptions);
  return renderSvg({ ...diagram, label: selected }, layoutOptions);
}
