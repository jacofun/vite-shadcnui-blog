import type { TerminalCommand } from "./types";

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + cost,
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length] ?? right.length;
}

export class CommandRegistry {
  private readonly aliases = new Map<string, TerminalCommand>();
  private readonly commands: TerminalCommand[];

  constructor(commands: TerminalCommand[]) {
    this.commands = [...commands];

    for (const command of commands) {
      this.aliases.set(command.name, command);
      command.aliases?.forEach((alias) => this.aliases.set(alias, command));
    }
  }

  list(includeHidden = false): readonly TerminalCommand[] {
    return includeHidden
      ? this.commands
      : this.commands.filter((command) => !command.hidden);
  }

  resolve(name: string): TerminalCommand | undefined {
    return this.aliases.get(name.toLowerCase());
  }

  suggest(name: string): string | undefined {
    const candidates = Array.from(this.aliases.keys())
      .map((candidate) => ({
        candidate,
        distance: editDistance(name.toLowerCase(), candidate),
      }))
      .sort((left, right) => left.distance - right.distance);
    const closest = candidates[0];

    return closest && closest.distance <= 2 ? closest.candidate : undefined;
  }
}

export function tokenizeCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (const character of input.trim()) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (escaped) {
    current += "\\";
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}
