import { CommandRegistry } from "./commandRegistry";
import { executeRemoteCommand } from "./remoteCommand";
import type { TerminalCommand } from "./types";

const cyan = (value: string) => `\x1b[36m${value}\x1b[0m`;
const green = (value: string) => `\x1b[32m${value}\x1b[0m`;
const muted = (value: string) => `\x1b[90m${value}\x1b[0m`;

function navigationCommand(
  name: string,
  description: string,
  navigateTo: string,
): TerminalCommand {
  return {
    description,
    execute: () => ({
      navigateTo,
      output: [`Opening ${navigateTo} ...`],
    }),
    name,
  };
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
}

const commands: TerminalCommand[] = [
  {
    aliases: ["?"],
    description: "查看可用命令",
    execute: (context) => ({
      output: [
        cyan("AVAILABLE COMMANDS"),
        ...context.commands.map(
          (command) =>
            `  ${command.name.padEnd(12)}${command.description}`,
        ),
        "",
        muted("支持 Tab 补全、↑↓ 历史命令、Ctrl+L 清屏。"),
        muted("有些命令不会出现在这里。"),
      ],
    }),
    name: "help",
  },
  navigationCommand("home", "返回首页", "/"),
  navigationCommand("notes", "打开笔记", "/notes"),
  navigationCommand("wedding", "打开婚礼纪念", "/wedding"),
  {
    description: "查看本站信息",
    execute: () => ({
      output: [
        cyan("YANXIAO.ME"),
        "彦骁的笔记：技术、金融市场和学习记录。",
        muted("Built with Vite, React, TypeScript and curiosity."),
      ],
    }),
    name: "about",
  },
  {
    aliases: ["cls"],
    description: "清空终端",
    execute: () => ({ clear: true }),
    name: "clear",
  },
  {
    description: "查看终端版本",
    execute: () => ({
      output: ["yanxiao-terminal 0.1.0", "engine: xterm.js"],
    }),
    name: "version",
  },
  {
    description: "查看命令历史",
    execute: (context) => ({
      output: context.history.length
        ? context.history.map(
            (entry, index) =>
              `${String(index + 1).padStart(3, " ")}  ${entry}`,
          )
        : ["暂无历史命令。"],
    }),
    name: "history",
  },
  {
    description: "输出输入内容",
    execute: (_context, args) => ({ output: [args.join(" ")] }),
    name: "echo",
    usage: "echo <text>",
  },
  {
    description: "生成 UUID",
    execute: () => ({ output: [window.crypto.randomUUID()] }),
    name: "uuid",
  },
  {
    description: "转换时间戳",
    execute: (_context, args) => {
      const rawValue = args[0];
      const numericValue = rawValue ? Number(rawValue) : Date.now();
      const milliseconds =
        rawValue && rawValue.length <= 10 ? numericValue * 1000 : numericValue;
      const date = new Date(milliseconds);

      if (!Number.isFinite(numericValue) || Number.isNaN(date.getTime())) {
        return { output: ["用法：timestamp [秒或毫秒时间戳]"] };
      }

      return {
        output: [
          `ISO   ${date.toISOString()}`,
          `LOCAL ${date.toLocaleString("zh-CN")}`,
        ],
      };
    },
    name: "timestamp",
    usage: "timestamp [value]",
  },
  {
    description: "将文本编码为 Base64",
    execute: (_context, args) => {
      const value = args.join(" ");
      return {
        output: value ? [encodeBase64(value)] : ["用法：base64 <text>"],
      };
    },
    name: "base64",
    usage: "base64 <text>",
  },
  {
    description: "获取一条随机提示",
    execute: () => {
      const fortunes = [
        "先建立可以运行的最小结构，再逐步增加复杂度。",
        "可观测性应当在故障发生之前建立。",
        "真正有价值的笔记会改变下一次行动。",
        "把重复判断固化成工具，把重要判断保留给人。",
      ];
      const index = Math.floor(Math.random() * fortunes.length);
      return {
        output: [
          fortunes[index] ??
            fortunes[0] ??
            "保持记录，保持验证。",
        ],
      };
    },
    name: "fortune",
  },
  {
    description: "识别当前访客",
    execute: () => ({
      output: ["A curious visitor exploring yanxiao.me."],
    }),
    name: "whoami",
  },
  {
    description: "进入矩阵",
    execute: () => {
      const glyphs = "01アイウエオカキクケコサシスセソ";
      const rows = Array.from({ length: 8 }, () =>
        Array.from({ length: 42 }, () =>
          glyphs.charAt(Math.floor(Math.random() * glyphs.length)),
        ).join(""),
      );

      return {
        output: [
          ...rows.map((row) => green(row)),
          "",
          green("Wake up, visitor..."),
        ],
      };
    },
    hidden: true,
    name: "matrix",
  },
  {
    description: "请求管理员权限",
    execute: () => ({
      output: ["Permission denied. This incident will not be reported."],
    }),
    hidden: true,
    name: "sudo",
  },
  {
    description: "冲一杯咖啡",
    execute: () => ({
      output: ["Brewing...", "[##########] 100%", "Coffee is ready. ☕"],
    }),
    hidden: true,
    name: "coffee",
  },
  {
    description: "连接远程命令通道",
    execute: (_context, args) => executeRemoteCommand("classified", args),
    hidden: true,
    name: "classified",
  },
];

export const commandRegistry = new CommandRegistry(commands);
