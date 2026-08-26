export type CommandResult = {
  clear?: boolean;
  navigateTo?: string;
  output?: string[];
};

export type CommandContext = {
  commands: readonly TerminalCommand[];
  history: readonly string[];
};

export type TerminalCommand = {
  aliases?: string[];
  description: string;
  execute: (
    context: CommandContext,
    args: string[],
  ) => CommandResult | Promise<CommandResult>;
  hidden?: boolean;
  name: string;
  usage?: string;
};
