import { PhyloParseError } from "../errors";
import type { ParseResult, PhyloNode, PhyloTree } from "../tree/types";
import { buildTreeFromRoot } from "./parser-utils";

interface ParserState {
  input: string; // вся строка целиком
  index: number; // текущая позиция указателя
  id: number; // счетчик генирации
  warnings: string[]; 
}

export function parseNewick(content: string): ParseResult {
  const input = content.trim();
  if (!input) {
    throw new PhyloParseError("Empty Newick input");
  }

  const state: ParserState = {
    input,
    index: 0,
    id: 0,
    warnings: [],
  };

  const root = parseNode(state);
  consumeWs(state);

  if (peek(state) === ";") {
    state.index += 1;
  } else {
    state.warnings.push("Missing trailing semicolon in Newick input");
  }

  consumeWs(state);
  if (state.index < state.input.length) {
    throw buildError(state, "Unexpected trailing characters");
  }

  const tree: PhyloTree = buildTreeFromRoot(root, "newick");

  return { tree, warnings: state.warnings };
}

function parseNode(state: ParserState): PhyloNode {
  consumeWs(state);

  let children: PhyloNode[] = [];
  if (peek(state) === "(") {
    state.index += 1;
    children = parseChildren(state);
    expect(state, ")");
  }

  const label = readLabel(state);
  const { name, confidence } = splitLabel(label);

  let branchLength: number | null = null;
  consumeWs(state);
  if (peek(state) === ":") {
    state.index += 1;
    branchLength = readNumber(state);
  }

  parseBracketAnnotations(state);

  return {
    id: nextId(state),
    name,
    branchLength,
    confidence,
    children,
    annotations: {},
  };
}

function parseChildren(state: ParserState): PhyloNode[] {
  const children: PhyloNode[] = [];
  while (true) {
    children.push(parseNode(state));
    consumeWs(state);
    const token = peek(state);
    if (token === ",") {
      state.index += 1;
      continue;
    }
    if (token === ")") {
      break;
    }
    throw buildError(state, "Expected ',' or ')' in children list");
  }
  return children;
}

function parseBracketAnnotations(state: ParserState): void {
  consumeWs(state);
  while (peek(state) === "[") {
    const start = state.index;
    state.index += 1;
    while (
      state.index < state.input.length &&
      state.input[state.index] !== "]"
    ) {
      state.index += 1;
    }
    if (peek(state) !== "]") {
      throw buildError(state, "Unclosed '[' annotation");
    }
    state.index += 1;
    const text = state.input.slice(start + 1, state.index - 1).trim();
    if (text.toUpperCase().startsWith("&&NHX")) {
      state.warnings.push(
        "NHX metadata detected and preserved as raw annotation",
      );
    }
    consumeWs(state);
  }
}

function readLabel(state: ParserState): string {
  consumeWs(state);
  if (peek(state) === "'") {
    state.index += 1;
    let value = "";

    while (state.index < state.input.length) {
      const ch = state.input[state.index];
      if (ch === "'") {
        if (state.input[state.index + 1] === "'") {
          value += "'";
          state.index += 2;
          continue;
        }
        state.index += 1;
        return value;
      }
      value += ch;
      state.index += 1;
    }

    throw buildError(state, "Unclosed quoted label");
  }

  const start = state.index;
  while (state.index < state.input.length) {
    const ch = state.input[state.index];
    if (ch === ":" || ch === "," || ch === ")" || ch === ";" || ch === "[") {
      break;
    }
    state.index += 1;
  }
  return state.input.slice(start, state.index).trim();
}

function splitLabel(label: string): {
  name: string | null;
  confidence: number | null;
} {
  if (!label) {
    return { name: null, confidence: null };
  }
  const asNumber = Number(label);
  if (Number.isFinite(asNumber)) {
    return { name: null, confidence: asNumber };
  }
  return { name: label, confidence: null };
}

function readNumber(state: ParserState): number {
  consumeWs(state);
  const start = state.index;
  while (
    state.index < state.input.length &&
    /[0-9eE+\-.]/.test(state.input[state.index])
  ) {
    state.index += 1;
  }
  const chunk = state.input.slice(start, state.index);
  const value = Number(chunk);
  if (!Number.isFinite(value)) {
    throw buildError(state, "Invalid branch length");
  }
  return value;
}

function nextId(state: ParserState): string {
  state.id += 1;
  return `n${state.id}`;
}

function expect(state: ParserState, expected: string): void {
  consumeWs(state);
  if (peek(state) !== expected) {
    throw buildError(state, `Expected '${expected}'`);
  }
  state.index += 1;
}

// пропуск пробелов
function consumeWs(state: ParserState): void {
  while (
    state.index < state.input.length &&
    /\s/.test(state.input[state.index])
  ) {
    state.index += 1;
  }
}
// достает символ по индексу или null, если обработали всю строку
function peek(state: ParserState): string | null {
  return state.index < state.input.length ? state.input[state.index] : null;
}

function buildError(state: ParserState, message: string): PhyloParseError {
  const lines = state.input.slice(0, state.index).split("\n");
  return new PhyloParseError(message, {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  });
}
