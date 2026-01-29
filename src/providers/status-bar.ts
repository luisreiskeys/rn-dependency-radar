import * as vscode from "vscode";

export class StatusBarProvider {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.text = "📡 RN Radar";
    this.item.tooltip = "RN Dependency Radar — React Native / Expo dependency risk monitor.";
    this.item.command = "rnDependencyRadar.showDetails";
    this.item.show();
  }

  register(context: vscode.ExtensionContext) {
    context.subscriptions.push(this.item);
  }

  update(criticalCount: number, customText?: string) {
    if (customText) {
      this.item.text = `📡 RN Radar: ${customText}`;
      this.item.color = undefined;
    } else if (criticalCount > 0) {
      this.item.text = `📡 RN Radar: ${criticalCount} ${criticalCount === 1 ? 'critical' : 'criticals'}`;
      this.item.color = new vscode.ThemeColor("errorForeground");
    } else {
      this.item.text = "📡 RN Radar: ok";
      this.item.color = undefined;
    }
  }

  dispose() {
    this.item.dispose();
  }
}

