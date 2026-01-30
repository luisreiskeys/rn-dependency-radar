import * as vscode from "vscode";
import { DependencyRisk } from "../models/dependency";

export class Notifier {
  private ignored = new Set<string>();

  constructor(private readonly config: vscode.WorkspaceConfiguration) {}

  filterIgnored(risks: DependencyRisk[]): DependencyRisk[] {
    return risks.filter((r) => !this.shouldIgnore(r.dependency.name));
  }

  async notifySummary(criticalCount: number, scanDuration?: string) {
    const alertLevel = (this.config.get<string>("alertLevel", "high") ?? "high") as
      | "high"
      | "medium"
      | "low";

    if (alertLevel !== "high" || criticalCount === 0) {
      // Still show completion message if scan took a while
      if (scanDuration && parseFloat(scanDuration) > 5) {
        const message = `📡 RN Dependency Radar: Analysis completed in ${scanDuration}s. ${criticalCount === 0 ? "No critical issues found." : `${criticalCount} critical ${criticalCount === 1 ? "issue" : "issues"} found.`}`;
        await vscode.window.showInformationMessage(message, "View details").then((selection) => {
          if (selection === "View details") {
            vscode.commands.executeCommand("rnDependencyRadar.showDetails");
          }
        });
      }
      return;
    }

    const icon = "📡";
    const severityEmoji = "🟥"; // high only for now
    const title = `${icon} RN Dependency Radar`;

    const durationText = scanDuration ? ` (${scanDuration}s)` : "";
    const message =
      criticalCount === 1
        ? `${title}: ${severityEmoji} 1 dependency with HIGH risk detected${durationText}.`
        : `${title}: ${severityEmoji} ${criticalCount} dependencies with HIGH risk detected${durationText}.`;

    const selection = await vscode.window.showWarningMessage(
      message,
      "View details"
    );

    if (selection === "View details") {
      await vscode.commands.executeCommand("rnDependencyRadar.showDetails");
    }
  }

  private shouldIgnore(name: string): boolean {
    if (this.ignored.has(name)) {
      return true;
    }
    const ignoreList = this.config.get<string[]>("ignore", []) ?? [];
    return ignoreList.includes(name);
  }
}

