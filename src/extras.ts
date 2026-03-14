/**
 * @module extras
 * @description Post-analysis optional installations for Claude Code projects.
 *
 * Provides a unified interface for optional extras (safety hooks, statusline, etc.)
 * that can be installed at project or global scope. Each extra follows the same
 * detection → prompt → install flow, making it easy to add new ones.
 *
 * @example
 * import { promptExtras } from './extras.js';
 *
 * await promptExtras(projectDir); // Prompts user for each available extra
 */

import pc from "picocolors";
import prompts from "prompts";
import {
  checkHookStatus,
  checkStatuslineStatus,
  installHook,
  installHookGlobal,
  installStatusline,
  installStatuslineGlobal,
} from "./hooks.js";

// ============================================================================
// Extra Interface
// ============================================================================

/**
 * Installation status for an extra at both project and global scope
 */
export interface ExtraStatus {
  projectInstalled: boolean;
  globalInstalled: boolean;
  projectMatchesOurs: boolean;
  globalMatchesOurs: boolean;
}

/**
 * Definition of an optional extra that can be installed
 */
export interface Extra {
  id: string;
  name: string;
  description: string;
  checkStatus: (projectDir: string) => ExtraStatus;
  installProject: (projectDir: string) => void;
  installGlobal: () => void;
  projectPath: string;
  globalPath: string;
}

// ============================================================================
// Registered Extras
// ============================================================================

export const EXTRAS: Extra[] = [
  {
    id: "safety-hook",
    name: "Safety hook",
    description: "Block dangerous commands (git push, rm -rf, etc.)",
    checkStatus: checkHookStatus,
    installProject: installHook,
    installGlobal: installHookGlobal,
    projectPath: ".claude/hooks/block-dangerous-commands.js",
    globalPath: "~/.claude/hooks/block-dangerous-commands.js",
  },
  {
    id: "statusline",
    name: "Custom statusline",
    description: "Shows project, branch, context, model",
    checkStatus: checkStatuslineStatus,
    installProject: installStatusline,
    installGlobal: installStatuslineGlobal,
    projectPath: ".claude/config/statusline-command.sh",
    globalPath: "~/.claude/config/statusline-command.sh",
  },
];

// ============================================================================
// Prompt Logic
// ============================================================================

/**
 * Prompt the user to install each available extra.
 * Handles detection, scope selection, and installation for all registered extras.
 */
export async function promptExtras(projectDir: string): Promise<void> {
  for (const extra of EXTRAS) {
    const status = extra.checkStatus(projectDir);

    if (status.projectMatchesOurs || status.globalMatchesOurs) {
      // Same version already installed — skip silently
      continue;
    }

    if (status.projectInstalled || status.globalInstalled) {
      // Different version exists — ask what to do
      const where = status.globalInstalled ? "globally" : "in this project";
      const { action } = await prompts({
        type: "select",
        name: "action",
        message: `A different ${extra.name.toLowerCase()} is already configured ${where}. Replace it?`,
        choices: [
          { title: "Install for this project only", value: "project" },
          { title: "Install globally (all projects)", value: "global" },
          { title: "Skip — keep existing", value: "skip" },
        ],
        initial: 2,
      });

      applyAction(action, extra, projectDir);
    } else {
      // Not installed anywhere — offer to install
      const { action } = await prompts({
        type: "select",
        name: "action",
        message: `Add ${extra.name.toLowerCase()}? (${extra.description})`,
        choices: [
          { title: "Install for this project only", value: "project" },
          { title: "Install globally (all projects)", value: "global" },
          { title: "Skip", value: "skip" },
        ],
        initial: 0,
      });

      applyAction(action, extra, projectDir);
    }
  }
}

export function applyAction(action: string | undefined, extra: Extra, projectDir: string): void {
  if (action === "project") {
    extra.installProject(projectDir);
    console.log(pc.green(`  + ${extra.projectPath}`));
  } else if (action === "global") {
    extra.installGlobal();
    console.log(pc.green(`  + ${extra.globalPath} (global)`));
  }
}
