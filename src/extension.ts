import * as vscode from "vscode";
import { ProjectDetector } from "./core/project-detector";
import { DependencyAnalyzer } from "./core/dependency-analyzer";
import { RulesEngine, RuleDefinition } from "./core/rules-engine";
import { RiskScorer } from "./core/risk-scorer";
import { Cache } from "./core/cache";
import { MetadataService } from "./core/metadata-service";
import { Notifier } from "./providers/notifier";
import { StatusBarProvider } from "./providers/status-bar";
import { RadarWebview } from "./providers/webview";
import { debounce } from "./utils/debounce";
import { DependencyRisk } from "./models/dependency";
import * as path from "path";
import * as fs from "fs";

let statusBarProvider: StatusBarProvider | undefined;
let lastScanRisks: DependencyRisk[] = [];

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration("rnDependencyRadar");

  const projectDetector = new ProjectDetector(workspaceRoot);
  const project = await projectDetector.detect();

  if (!project) {
    return;
  }

  // Try multiple paths to find the rules file
  // In development (F5), extensionPath points to the extension's source directory
  // In production, it points to the extension's installation directory
  const possiblePaths: string[] = [];

  // Add paths using extensionPath
  possiblePaths.push(
    path.join(context.extensionPath, "rules", "rn-default-rules.json"),
    path.join(context.extensionPath, "dist", "rules", "rn-default-rules.json"),
    path.join(context.extensionPath, "..", "rules", "rn-default-rules.json"),
    path.join(context.extensionPath, "..", "..", "rules", "rn-default-rules.json")
  );

  // Also try using extensionUri (more reliable in some contexts)
  try {
    const extensionUri = context.extensionUri;
    if (extensionUri && extensionUri.scheme === "file") {
      const uriPath = extensionUri.fsPath;
      possiblePaths.push(
        path.join(uriPath, "rules", "rn-default-rules.json"),
        path.join(uriPath, "dist", "rules", "rn-default-rules.json"),
        path.join(uriPath, "..", "rules", "rn-default-rules.json")
      );
    }
  } catch (e) {
    // extensionUri might not be available
  }

  // Fallback: try relative to workspace root (for development)
  if (workspaceFolders && workspaceFolders.length > 0) {
    const wsRoot = workspaceFolders[0].uri.fsPath;
    // Check if we're in the extension's own workspace
    if (wsRoot.includes("RN Dependency Radar") || wsRoot.endsWith("rn-dependency-radar")) {
      possiblePaths.push(
        path.join(wsRoot, "rules", "rn-default-rules.json"),
        path.join(wsRoot, "dist", "rules", "rn-default-rules.json")
      );
    }
  }

  // Debug: log extension path info
  console.log(`[RN Dependency Radar] extensionPath: ${context.extensionPath}`);
  try {
    console.log(`[RN Dependency Radar] extensionUri: ${context.extensionUri?.fsPath || context.extensionUri?.toString()}`);
  } catch (e) {
    // ignore
  }

  let rules: RuleDefinition[] = [];

  for (const testPath of possiblePaths) {
    const exists = fs.existsSync(testPath);
    console.log(`[RN Dependency Radar] Checking: ${testPath} (exists: ${exists})`);
    
    if (exists) {
      try {
        const rulesContent = fs.readFileSync(testPath, "utf8");
        rules = JSON.parse(rulesContent);
        console.log(`[RN Dependency Radar] ✓ Loaded ${rules.length} rules from: ${testPath}`);
        break;
      } catch (error) {
        console.error(`[RN Dependency Radar] ✗ Error parsing rules from ${testPath}:`, error);
      }
    }
  }

  if (rules.length === 0) {
    const errorDetails = `extensionPath: ${context.extensionPath}, tried ${possiblePaths.length} paths`;
    console.error(`[RN Dependency Radar] Could not load default rules. ${errorDetails}`);
    console.error(`[RN Dependency Radar] Tried paths:`, possiblePaths);
    vscode.window.showErrorMessage(
      `RN Dependency Radar: Could not load default rules. Check the Output panel for details.`
    );
  }

  // Read risk thresholds from configuration
  const thresholdsConfig = config.get<{
    installedVersionAgeMonths?: { high?: number; medium?: number };
    missedVersionsCount?: { high?: number; medium?: number };
    libraryLastUpdateMonths?: { high?: number; medium?: number };
  }>("riskThresholds", {});

  const thresholds = {
    installedVersionAgeMonths: {
      high: thresholdsConfig.installedVersionAgeMonths?.high ?? 36,
      medium: thresholdsConfig.installedVersionAgeMonths?.medium ?? 18
    },
    missedVersionsCount: {
      high: thresholdsConfig.missedVersionsCount?.high ?? 50,
      medium: thresholdsConfig.missedVersionsCount?.medium ?? 10
    },
    libraryLastUpdateMonths: {
      high: thresholdsConfig.libraryLastUpdateMonths?.high ?? 24,
      medium: thresholdsConfig.libraryLastUpdateMonths?.medium ?? 12
    }
  };

  let rulesEngine = new RulesEngine(rules, thresholds);
  const riskScorer = new RiskScorer();
  const cache = new Cache(workspaceRoot);
  const notifier = new Notifier(config);
  const metadataService = new MetadataService();
  let analyzer = new DependencyAnalyzer(
    project,
    rulesEngine,
    riskScorer,
    cache,
    metadataService
  );
  const webview = new RadarWebview(context);

  let isScanning = false;

  statusBarProvider = new StatusBarProvider();
  statusBarProvider.register(context);

  // Function to recalculate risks with current thresholds
  const recalculateRisks = () => {
    if (lastScanRisks.length === 0) {
      console.log("[RN Dependency Radar] No data to recalculate");
      return; // No data to recalculate
    }

    // Read current thresholds from configuration (get fresh config)
    const currentConfig = vscode.workspace.getConfiguration("rnDependencyRadar");
    const currentThresholdsConfig = currentConfig.get<{
      installedVersionAgeMonths?: { high?: number; medium?: number };
      missedVersionsCount?: { high?: number; medium?: number };
      libraryLastUpdateMonths?: { high?: number; medium?: number };
    }>("riskThresholds", {});

    const currentThresholds = {
      installedVersionAgeMonths: {
        high: currentThresholdsConfig.installedVersionAgeMonths?.high ?? 36,
        medium: currentThresholdsConfig.installedVersionAgeMonths?.medium ?? 18
      },
      missedVersionsCount: {
        high: currentThresholdsConfig.missedVersionsCount?.high ?? 50,
        medium: currentThresholdsConfig.missedVersionsCount?.medium ?? 10
      },
      libraryLastUpdateMonths: {
        high: currentThresholdsConfig.libraryLastUpdateMonths?.high ?? 24,
        medium: currentThresholdsConfig.libraryLastUpdateMonths?.medium ?? 12
      }
    };

    console.log("[RN Dependency Radar] Recalculating with thresholds:", JSON.stringify(currentThresholds, null, 2));

    // Recreate rules engine with new thresholds
    rulesEngine = new RulesEngine(rules, currentThresholds);
    analyzer = new DependencyAnalyzer(
      project,
      rulesEngine,
      riskScorer,
      cache,
      metadataService
    );

    // Recalculate risks for existing dependencies
    const recalculatedRisks = lastScanRisks.map((risk) =>
      rulesEngine.evaluate(risk.dependency, project, riskScorer)
    );

    lastScanRisks = recalculatedRisks;

    // Update UI
    webview.update(lastScanRisks);
    const criticalRisks = lastScanRisks.filter((r) => r.riskLevel === "high");
    const visibleCritical = notifier.filterIgnored(criticalRisks);
    statusBarProvider?.update(visibleCritical.length);

    console.log(`[RN Dependency Radar] Risks recalculated. Critical: ${visibleCritical.length}, Total: ${lastScanRisks.length}`);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("rnDependencyRadar.openSettings", () => {
      vscode.commands.executeCommand("workbench.action.openSettings", "rnDependencyRadar");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("rnDependencyRadar.recalculateRisks", () => {
      console.log("[RN Dependency Radar] Manual recalculate triggered");
      recalculateRisks();
    })
  );

  // Listen for configuration changes and recalculate risks immediately
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      console.log(`[RN Dependency Radar] Configuration changed. Affects riskThresholds: ${e.affectsConfiguration("rnDependencyRadar.riskThresholds")}`);
      if (e.affectsConfiguration("rnDependencyRadar.riskThresholds")) {
        console.log("[RN Dependency Radar] Risk thresholds changed, recalculating...");
        recalculateRisks();
      } else if (e.affectsConfiguration("rnDependencyRadar")) {
        // Also check if any rnDependencyRadar config changed (broader check)
        console.log("[RN Dependency Radar] Some RN Dependency Radar config changed, checking if thresholds changed...");
        recalculateRisks();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("rnDependencyRadar.showDetails", async () => {
      // If we already have data, show it immediately (fast response)
      if (lastScanRisks.length > 0) {
        webview.show(lastScanRisks);
        return;
      }

      // If we don't have data yet, show loading and trigger a scan
      webview.showLoading();

      if (!isScanning) {
        await runScan();
      }
      // If a scan is already running, webview.update() will be called when it finishes
    })
  );

  // Debug/test command to inspect npm metadata for a specific package
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "rnDependencyRadar.testMetadataAsyncStorage",
      async () => {
        const meta = await metadataService.get(
          "@react-native-community/async-storage"
        );
        // Log to the extension host console for easier inspection
        // eslint-disable-next-line no-console
        console.log(
          "RN Dependency Radar test metadata for @react-native-community/async-storage:",
          meta
        );
        await vscode.window.showInformationMessage(
          `Metadata for @react-native-community/async-storage: ${JSON.stringify(
            meta,
            null,
            2
          )}`
        );
      }
    )
  );

  const runScan = async () => {
    if (isScanning) {
      return;
    }

    isScanning = true;
    statusBarProvider?.update(0, "Analyzing...");

    try {
      const result = await analyzer.scan();
      lastScanRisks = result.risks;

      // Always push fresh data to the webview; it will no‑op if the panel is closed
      webview.update(lastScanRisks);

      const criticalRisks = result.risks.filter((r) => r.riskLevel === "high");
      const visibleCritical = notifier.filterIgnored(criticalRisks);

      statusBarProvider?.update(visibleCritical.length);
      await notifier.notifySummary(visibleCritical.length);
    } catch (error) {
      vscode.window.showErrorMessage(
        `RN Dependency Radar: Error analyzing dependencies: ${error}`
      );
    } finally {
      isScanning = false;
    }
  };

  const debouncedScan = debounce(runScan, 1000);

  // Scan inicial
  if (config.get<boolean>("scanOnStartup", true)) {
    // Executa o scan inicial em background sem bloquear
    runScan().catch((error) => {
      console.error("Erro no scan inicial:", error);
    });
  }

  const dependencyFiles = [
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml"
  ];

  dependencyFiles.forEach((pattern) => {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, pattern)
    );

    watcher.onDidCreate((uri) => {
      console.log(`[RN Dependency Radar] ${pattern} created:`, uri.fsPath);
      debouncedScan();
    });
    watcher.onDidChange((uri) => {
      console.log(`[RN Dependency Radar] ${pattern} changed:`, uri.fsPath);
      debouncedScan();
    });
    watcher.onDidDelete((uri) => {
      console.log(`[RN Dependency Radar] ${pattern} deleted:`, uri.fsPath);
      debouncedScan();
    });

    context.subscriptions.push(watcher);
  });
}

export function deactivate() {
  statusBarProvider?.dispose();
}

