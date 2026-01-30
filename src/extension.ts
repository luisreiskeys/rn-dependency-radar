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
import * as crypto from "crypto";

let statusBarProvider: StatusBarProvider | undefined;
let lastScanRisks: DependencyRisk[] = [];
let lastPackageJsonHash: string | null = null;

export async function activate(context: vscode.ExtensionContext) {
  try {
    console.log("[RN Dependency Radar] Extension activating...");
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log("[RN Dependency Radar] No workspace folders found.");
      // Status bar will be created later when command is registered
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    console.log("[RN Dependency Radar] Workspace root:", workspaceRoot);
    
    const config = vscode.workspace.getConfiguration("rnDependencyRadar");

    let project;
    try {
      const projectDetector = new ProjectDetector(workspaceRoot);
      project = await projectDetector.detect();
    } catch (error) {
      console.error("[RN Dependency Radar] Error detecting project:", error);
      vscode.window.showErrorMessage(
        `RN Dependency Radar: Error detecting project. Check the Output panel for details.`
      );
      // Status bar will be created later when command is registered
      return;
    }

    if (!project) {
      console.log("[RN Dependency Radar] Project not detected. Make sure your project has 'react-native' or 'expo' in package.json dependencies.");
      // Status bar will be created later when command is registered
      return;
    }

    console.log("[RN Dependency Radar] Project detected:", project.type);

    // Status bar already created above, just update it
    statusBarProvider?.update(0, "Initializing...");

    // Try multiple paths to find the rules file
    // In development (F5), extensionPath points to the extension's source directory
    // In production, it points to the extension's installation directory
    const possiblePaths: string[] = [];

    // Add paths using extensionPath
    // In production, the file is at dist/rules/rn-default-rules.json
    // In development, it might be at rules/rn-default-rules.json
    possiblePaths.push(
      path.join(context.extensionPath, "dist", "rules", "rn-default-rules.json"), // Production path (first priority)
      path.join(context.extensionPath, "rules", "rn-default-rules.json"), // Development fallback
      path.join(context.extensionPath, "..", "rules", "rn-default-rules.json"),
      path.join(context.extensionPath, "..", "..", "rules", "rn-default-rules.json")
    );

    // Also try using extensionUri (more reliable in some contexts)
    try {
      const extensionUri = context.extensionUri;
      if (extensionUri && extensionUri.scheme === "file") {
        const uriPath = extensionUri.fsPath;
        possiblePaths.push(
          path.join(uriPath, "dist", "rules", "rn-default-rules.json"), // Production path (first priority)
          path.join(uriPath, "rules", "rn-default-rules.json"), // Development fallback
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

    // Create status bar AFTER webview and command are ready
    statusBarProvider = new StatusBarProvider();
    statusBarProvider.update(0, "Ready");
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
      const startTime = Date.now();

      try {
        const result = await analyzer.scan();
        const duration = Date.now() - startTime;
        const durationSeconds = (duration / 1000).toFixed(1);
        
        lastScanRisks = result.risks;

        // Update package.json hash after full scan
        const pkgPath = path.join(workspaceRoot, "package.json");
        if (fs.existsSync(pkgPath)) {
          const currentContent = fs.readFileSync(pkgPath, "utf8");
          lastPackageJsonHash = crypto.createHash("sha1").update(currentContent).digest("hex");
        }

        // Always push fresh data to the webview; it will no‑op if the panel is closed
        webview.update(lastScanRisks);

        const criticalRisks = result.risks.filter((r) => r.riskLevel === "high");
        const visibleCritical = notifier.filterIgnored(criticalRisks);

        statusBarProvider?.update(visibleCritical.length);
        await notifier.notifySummary(visibleCritical.length, durationSeconds);
        
        console.log(`[RN Dependency Radar] Scan completed in ${durationSeconds}s. Analyzed ${result.risks.length} dependencies.`);
      } catch (error) {
        const duration = Date.now() - startTime;
        const durationSeconds = (duration / 1000).toFixed(1);
        console.error(`[RN Dependency Radar] Scan failed after ${durationSeconds}s:`, error);
        vscode.window.showErrorMessage(
          `RN Dependency Radar: Error analyzing dependencies: ${error}`
        );
      } finally {
        isScanning = false;
      }
    };

    // Function to detect changes in package.json and handle incrementally
    const handlePackageJsonChange = async () => {
      const pkgPath = path.join(workspaceRoot, "package.json");
      if (!fs.existsSync(pkgPath)) {
        return;
      }

      // Compute current hash
      const currentContent = fs.readFileSync(pkgPath, "utf8");
      const currentHash = crypto.createHash("sha1").update(currentContent).digest("hex");

      // If no previous hash, do full scan
      if (!lastPackageJsonHash) {
        lastPackageJsonHash = currentHash;
        await runScan();
        return;
      }

      // If hash changed, detect what changed
      if (currentHash !== lastPackageJsonHash) {
        try {
          const currentPkg = JSON.parse(currentContent);
          const currentDeps = new Set([
            ...Object.keys(currentPkg.dependencies ?? {}),
            ...Object.keys(currentPkg.devDependencies ?? {})
          ]);

          // Get previous dependencies from last scan
          const previousDeps = new Set(lastScanRisks.map(r => r.dependency.name));

          // Find added and removed dependencies
          const added = Array.from(currentDeps).filter(dep => !previousDeps.has(dep));
          const removed = Array.from(previousDeps).filter(dep => !currentDeps.has(dep));

          console.log(`[RN Dependency Radar] Detected changes - Added: ${added.length}, Removed: ${removed.length}`);

          if (added.length > 0) {
            // Scan only new dependencies incrementally
            console.log(`[RN Dependency Radar] Scanning ${added.length} new dependency(ies): ${added.join(", ")}`);
            statusBarProvider?.update(0, "Analyzing new...");
            
            const newRisks: DependencyRisk[] = [];
            for (const packageName of added) {
              try {
                const risk = await analyzer.scanSingle(packageName);
                if (risk) {
                  newRisks.push(risk);
                }
              } catch (error) {
                console.error(`[RN Dependency Radar] Error scanning ${packageName}:`, error);
              }
            }

            // Merge with existing risks
            lastScanRisks = [...lastScanRisks, ...newRisks];
            
            // Update UI
            webview.update(lastScanRisks);
            
            const criticalRisks = lastScanRisks.filter((r) => r.riskLevel === "high");
            const visibleCritical = notifier.filterIgnored(criticalRisks);
            statusBarProvider?.update(visibleCritical.length);

            // Notify about new dependency(ies)
            if (newRisks.length > 0) {
              const highRisks = newRisks.filter(r => r.riskLevel === "high");
              
              if (newRisks.length === 1) {
                // Single dependency
                const newRisk = newRisks[0];
                const riskEmoji = newRisk.riskLevel === "high" ? "🟥" : newRisk.riskLevel === "medium" ? "🟧" : "🟩";
                const message = `📦 ${newRisk.dependency.name} ${newRisk.dependency.version} added. Risk: ${riskEmoji} ${newRisk.riskLevel.toUpperCase()}`;
                
                if (newRisk.riskLevel === "high") {
                  await vscode.window.showWarningMessage(message, "View details").then((selection) => {
                    if (selection === "View details") {
                      vscode.commands.executeCommand("rnDependencyRadar.showDetails");
                    }
                  });
                } else {
                  await vscode.window.showInformationMessage(message, "View details").then((selection) => {
                    if (selection === "View details") {
                      vscode.commands.executeCommand("rnDependencyRadar.showDetails");
                    }
                  });
                }
              } else {
                // Multiple dependencies
                const hasHigh = highRisks.length > 0;
                const message = `📦 ${newRisks.length} dependency(ies) added${hasHigh ? ` (${highRisks.length} with HIGH risk)` : ""}.`;
                
                if (hasHigh) {
                  await vscode.window.showWarningMessage(message, "View details").then((selection) => {
                    if (selection === "View details") {
                      vscode.commands.executeCommand("rnDependencyRadar.showDetails");
                    }
                  });
                } else {
                  await vscode.window.showInformationMessage(message, "View details").then((selection) => {
                    if (selection === "View details") {
                      vscode.commands.executeCommand("rnDependencyRadar.showDetails");
                    }
                  });
                }
              }
            }
          }

          if (removed.length > 0) {
            // Remove dependencies from list
            console.log(`[RN Dependency Radar] Removing ${removed.length} dependency(ies): ${removed.join(", ")}`);
            lastScanRisks = lastScanRisks.filter(r => !removed.includes(r.dependency.name));
            
            // Update UI
            webview.update(lastScanRisks);
            
            const criticalRisks = lastScanRisks.filter((r) => r.riskLevel === "high");
            const visibleCritical = notifier.filterIgnored(criticalRisks);
            statusBarProvider?.update(visibleCritical.length);
          }

          // Update hash
          lastPackageJsonHash = currentHash;
        } catch (error) {
          console.error("[RN Dependency Radar] Error detecting changes:", error);
          // Fallback to full scan
          lastPackageJsonHash = currentHash;
          await runScan();
        }
      }
    };

    const debouncedScan = debounce(runScan, 1000);
    const debouncedIncrementalScan = debounce(handlePackageJsonChange, 500);

    // Scan inicial
    if (config.get<boolean>("scanOnStartup", true)) {
      // Executa o scan inicial em background sem bloquear
      runScan().catch((error) => {
        console.error("Erro no scan inicial:", error);
      });
    }

    // Setup file watchers for dependency files
    // Use glob patterns that work at workspace root level
    const dependencyFiles = [
      "package.json",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml"
    ];

    console.log(`[RN Dependency Radar] Setting up file watchers for workspace: ${workspaceRoot}`);

    // Create watchers using glob patterns (more reliable)
    const packageJsonPattern = new vscode.RelativePattern(workspaceRoot, "package.json");
    const packageLockPattern = new vscode.RelativePattern(workspaceRoot, "package-lock.json");
    const yarnLockPattern = new vscode.RelativePattern(workspaceRoot, "yarn.lock");
    const pnpmLockPattern = new vscode.RelativePattern(workspaceRoot, "pnpm-lock.yaml");

    const watchers = [
      { pattern: packageJsonPattern, name: "package.json" },
      { pattern: packageLockPattern, name: "package-lock.json" },
      { pattern: yarnLockPattern, name: "yarn.lock" },
      { pattern: pnpmLockPattern, name: "pnpm-lock.yaml" }
    ];

    watchers.forEach(({ pattern, name }) => {
      const filePath = path.join(workspaceRoot, name);
      const fileExists = fs.existsSync(filePath);
      console.log(`[RN Dependency Radar] Watcher for ${name}: ${filePath} (exists: ${fileExists})`);

      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      const handleChange = (uri: vscode.Uri) => {
        console.log(`[RN Dependency Radar] ✓ ${name} changed:`, uri.fsPath);
        if (name === "package.json") {
          debouncedIncrementalScan();
        } else {
          // For lock files, do incremental scan (they change when package.json changes)
          debouncedIncrementalScan();
        }
      };

      watcher.onDidCreate(handleChange);
      watcher.onDidChange(handleChange);
      watcher.onDidDelete((uri) => {
        console.log(`[RN Dependency Radar] ✓ ${name} deleted:`, uri.fsPath);
        debouncedScan();
      });

      context.subscriptions.push(watcher);
    });

    // Also watch for text document saves as a fallback (more reliable in some cases)
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        const fileName = path.basename(document.fileName);
        if (dependencyFiles.includes(fileName)) {
          const relativePath = vscode.workspace.asRelativePath(document.uri);
          console.log(`[RN Dependency Radar] ✓ Text document saved: ${fileName} (${relativePath})`);
          if (fileName === "package.json") {
            debouncedIncrementalScan();
          } else {
            debouncedIncrementalScan();
          }
        }
      })
    );

    // Additional fallback: Use Node.js fs.watch for more reliable file system monitoring
    // This is especially important when files are changed externally (e.g., by yarn/npm)
    dependencyFiles.forEach((fileName) => {
      const filePath = path.join(workspaceRoot, fileName);
      if (fs.existsSync(filePath)) {
        try {
          const nodeWatcher = fs.watch(filePath, (eventType) => {
            if (eventType === "change") {
              console.log(`[RN Dependency Radar] ✓ ${fileName} changed (Node.js watcher):`, filePath);
              if (fileName === "package.json") {
                debouncedIncrementalScan();
              } else {
                debouncedIncrementalScan();
              }
            }
          });
          
          // Store watcher reference for cleanup
          context.subscriptions.push({
            dispose: () => {
              nodeWatcher.close();
            }
          });
          
          console.log(`[RN Dependency Radar] Node.js watcher added for: ${fileName}`);
        } catch (error) {
          console.error(`[RN Dependency Radar] Failed to create Node.js watcher for ${fileName}:`, error);
        }
      }
    });

    // Add a manual refresh command for debugging
    context.subscriptions.push(
      vscode.commands.registerCommand("rnDependencyRadar.refresh", async () => {
        console.log("[RN Dependency Radar] Manual refresh triggered");
        await runScan();
      })
    );

    console.log(`[RN Dependency Radar] File watchers configured. Monitoring ${dependencyFiles.length} files.`);
  } catch (error) {
    console.error("[RN Dependency Radar] Fatal error during activation:", error);
    vscode.window.showErrorMessage(
      `RN Dependency Radar: Fatal error during activation. Check the Output panel for details.`
    );
    // Try to show status bar anyway
    if (!statusBarProvider) {
      statusBarProvider = new StatusBarProvider();
      statusBarProvider.update(0, "Error");
      statusBarProvider.register(context);
    }
  }
}

export function deactivate() {
  statusBarProvider?.dispose();
}

