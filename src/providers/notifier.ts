import * as vscode from "vscode";
import { DependencyRisk } from "../models/dependency";

export class Notifier {
  private ignored = new Set<string>();

  constructor(private readonly config: vscode.WorkspaceConfiguration) {}

  filterIgnored(risks: DependencyRisk[]): DependencyRisk[] {
    return risks.filter((r) => !this.shouldIgnore(r.dependency.name));
  }

  async notifySummary(criticalCount: number) {
    const alertLevel = (this.config.get<string>("alertLevel", "high") ?? "high") as
      | "high"
      | "medium"
      | "low";

    if (alertLevel !== "high" || criticalCount === 0) {
      return;
    }

    const icon = "📡";
    const severityEmoji = "🟥"; // high only for now
    const title = `${icon} RN Dependency Radar`;

    const message =
      criticalCount === 1
        ? `${title}: ${severityEmoji} 1 dependency with HIGH risk detected.`
        : `${title}: ${severityEmoji} ${criticalCount} dependencies with HIGH risk detected.`;

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

