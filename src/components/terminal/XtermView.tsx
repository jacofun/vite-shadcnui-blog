import { useEffect, useRef, type JSX } from "react";
import { useNavigate } from "react-router-dom";

import "@xterm/xterm/css/xterm.css";

import { commandRegistry } from "./commands";
import { tokenizeCommand } from "./commandRegistry";

const prompt = "\x1b[36mvisitor@yanxiao\x1b[0m:\x1b[35m~\x1b[0m$ ";
const historyStorageKey = "yanxiao-terminal-history";
const inputStorageKey = "yanxiao-terminal-input";
const snapshotStorageKey = "yanxiao-terminal-snapshot";
const maximumStoredHistory = 100;

type TerminalSnapshot = {
  data: string;
  input: string;
};

function readStoredHistory(): string[] {
  try {
    const value: unknown = JSON.parse(
      window.sessionStorage.getItem(historyStorageKey) ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function readStoredInput(): string {
  try {
    return window.sessionStorage.getItem(inputStorageKey) ?? "";
  } catch {
    return "";
  }
}

function readStoredSnapshot(): TerminalSnapshot | null {
  try {
    const value: unknown = JSON.parse(
      window.sessionStorage.getItem(snapshotStorageKey) ?? "null",
    );

    if (
      value &&
      typeof value === "object" &&
      "data" in value &&
      "input" in value &&
      typeof value.data === "string" &&
      typeof value.input === "string"
    ) {
      return { data: value.data, input: value.input };
    }
  } catch {
    // Ignore malformed or unavailable session storage.
  }

  return null;
}

function storeHistory(history: string[]): void {
  try {
    window.sessionStorage.setItem(
      historyStorageKey,
      JSON.stringify(history.slice(-maximumStoredHistory)),
    );
  } catch {
    // The terminal remains usable when session storage is unavailable.
  }
}

function storeInput(input: string): void {
  try {
    window.sessionStorage.setItem(inputStorageKey, input);
  } catch {
    // The terminal remains usable when session storage is unavailable.
  }
}

function clearStoredSnapshot(): void {
  try {
    window.sessionStorage.removeItem(snapshotStorageKey);
  } catch {
    // Clearing the terminal still works when session storage is unavailable.
  }
}

export default function XtermView(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let cleanup = () => undefined;

    const initialize = async () => {
      const [{ Terminal }, { FitAddon }, { SerializeAddon }] =
        await Promise.all([
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
          import("@xterm/addon-serialize"),
        ]);
      if (disposed) return;

      const terminal = new Terminal({
        allowTransparency: true,
        convertEol: true,
        cursorBlink: true,
        cursorStyle: "bar",
        fontFamily:
          '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: 13,
        lineHeight: 1.3,
        scrollback: 1200,
        theme: {
          background: "#070a12",
          black: "#070a12",
          blue: "#60a5fa",
          brightBlack: "#64748b",
          brightBlue: "#93c5fd",
          brightCyan: "#67e8f9",
          brightGreen: "#86efac",
          brightMagenta: "#c4b5fd",
          brightRed: "#fda4af",
          brightWhite: "#f8fafc",
          brightYellow: "#fde68a",
          cursor: "#67e8f9",
          cyan: "#22d3ee",
          foreground: "#cbd5e1",
          green: "#4ade80",
          magenta: "#a78bfa",
          red: "#fb7185",
          selectionBackground: "#164e63",
          white: "#e2e8f0",
          yellow: "#facc15",
        },
      });
      const fitAddon = new FitAddon();
      const serializeAddon = new SerializeAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(serializeAddon);
      terminal.open(container);

      const isTouchDevice =
        window.matchMedia("(pointer: coarse)").matches ||
        navigator.maxTouchPoints > 0;
      const focusTerminal = () => terminal.focus();
      container.addEventListener("pointerdown", focusTerminal);

      const history = readStoredHistory();
      let historyIndex = history.length;
      let input = readStoredInput();
      let running = false;
      let snapshotSaveId: number | undefined;

      const saveSnapshot = () => {
        window.clearTimeout(snapshotSaveId);

        try {
          const snapshot: TerminalSnapshot = {
            data: serializeAddon.serialize(),
            input,
          };
          window.sessionStorage.setItem(
            snapshotStorageKey,
            JSON.stringify(snapshot),
          );
        } catch {
          // The terminal remains usable when session storage is unavailable.
        }
      };
      const scheduleSnapshotSave = () => {
        window.clearTimeout(snapshotSaveId);
        snapshotSaveId = window.setTimeout(saveSnapshot, 120);
      };
      const clearScreen = () => {
        window.clearTimeout(snapshotSaveId);
        clearStoredSnapshot();
        terminal.clear();
      };

      const writePrompt = () => terminal.write(prompt);
      const replaceInput = (value: string) => {
        input = value;
        storeInput(input);
        terminal.write(`\x1b[2K\r${prompt}${input}`);
      };

      const writeParsedSubscription = terminal.onWriteParsed(
        scheduleSnapshotSave,
      );
      window.addEventListener("beforeunload", saveSnapshot);
      window.addEventListener("pagehide", saveSnapshot);

      const storedSnapshot = readStoredSnapshot();
      if (storedSnapshot) {
        terminal.write(storedSnapshot.data, () => {
          if (storedSnapshot.input !== input) {
            terminal.write(`\x1b[2K\r${prompt}${input}`);
          }
        });
      } else {
        terminal.writeln("\x1b[36mYANXIAO.ME TERMINAL\x1b[0m  v0.2.0");
        terminal.writeln(
          "输入 \x1b[36mhelp\x1b[0m 查看命令，按 Tab 补全。",
        );
        terminal.writeln("");
        writePrompt();
        terminal.write(input);
      }

      const executeInput = async () => {
        const rawInput = input.trim();
        input = "";
        storeInput(input);
        terminal.write("\r\n");

        if (!rawInput) {
          writePrompt();
          return;
        }

        history.push(rawInput);
        if (history.length > maximumStoredHistory) {
          history.splice(0, history.length - maximumStoredHistory);
        }
        storeHistory(history);
        historyIndex = history.length;
        const [commandName, ...args] = tokenizeCommand(rawInput);

        if (!commandName) {
          writePrompt();
          return;
        }

        const command = commandRegistry.resolve(commandName);
        if (!command) {
          const suggestion = commandRegistry.suggest(commandName);
          terminal.writeln(`command not found: ${commandName}`);
          if (suggestion) terminal.writeln(`Did you mean: ${suggestion}?`);
          writePrompt();
          return;
        }

        running = true;
        try {
          const result = await command.execute(
            { commands: commandRegistry.list(), history: [...history] },
            args,
          );

          if (result.clear) clearScreen();
          result.output?.forEach((line) => terminal.writeln(line));

          if (result.navigateTo) {
            window.setTimeout(() => {
              navigate(result.navigateTo ?? "/");
              writePrompt();
            }, 180);
            return;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "未知错误";
          terminal.writeln(`\x1b[31mERROR: ${message}\x1b[0m`);
        } finally {
          running = false;
        }
        writePrompt();
      };

      const dataSubscription = terminal.onData((data) => {
        if (running) return;
        if (data === "\r") {
          void executeInput();
          return;
        }
        if (data === "\u007f") {
          if (input) {
            input = Array.from(input).slice(0, -1).join("");
            storeInput(input);
            terminal.write("\b \b");
          }
          return;
        }
        if (data === "\u0003") {
          input = "";
          storeInput(input);
          terminal.write("^C\r\n");
          writePrompt();
          return;
        }
        if (data === "\u000c") {
          clearScreen();
          writePrompt();
          return;
        }
        if (data === "\t") {
          const matches = commandRegistry
            .list(true)
            .map((command) => command.name)
            .filter((name) => name.startsWith(input.toLowerCase()));
          if (matches.length === 1) {
            replaceInput(matches[0] ?? input);
          } else if (matches.length > 1) {
            terminal.write("\r\n");
            terminal.writeln(matches.join("  "));
            writePrompt();
            terminal.write(input);
          }
          return;
        }
        if (data === "\x1b[A") {
          if (historyIndex > 0) {
            historyIndex -= 1;
            replaceInput(history[historyIndex] ?? "");
          }
          return;
        }
        if (data === "\x1b[B") {
          if (historyIndex < history.length - 1) {
            historyIndex += 1;
            replaceInput(history[historyIndex] ?? "");
          } else {
            historyIndex = history.length;
            replaceInput("");
          }
          return;
        }
        if (data.startsWith("\x1b")) return;

        const printable = Array.from(data)
          .filter((character) => {
            const codePoint = character.codePointAt(0) ?? 0;
            return codePoint >= 32 && codePoint !== 127;
          })
          .join("");
        input += printable;
        storeInput(input);
        terminal.write(printable);
      });

      const resizeObserver = new ResizeObserver(() => {
        window.requestAnimationFrame(() => fitAddon.fit());
      });
      resizeObserver.observe(container);
      window.requestAnimationFrame(() => {
        fitAddon.fit();
        if (!isTouchDevice) terminal.focus();
      });

      cleanup = () => {
        saveSnapshot();
        window.clearTimeout(snapshotSaveId);
        window.removeEventListener("beforeunload", saveSnapshot);
        window.removeEventListener("pagehide", saveSnapshot);
        container.removeEventListener("pointerdown", focusTerminal);
        dataSubscription.dispose();
        writeParsedSubscription.dispose();
        resizeObserver.disconnect();
        terminal.dispose();
      };
    };

    void initialize();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [navigate]);

  return (
    <div
      aria-label="彦骁的笔记终端"
      className="h-full min-h-0 w-full bg-[#070a12] p-3 sm:p-4"
      ref={containerRef}
    />
  );
}
