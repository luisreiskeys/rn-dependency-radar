/**
 * Debug script for RN Dependency Radar extension
 * 
 * How to use:
 * 1. Open VS Code Developer Tools: Help > Toggle Developer Tools
 * 2. Go to Console tab
 * 3. Copy and paste this entire script
 * 4. Press Enter
 * 
 * Or use Command Palette: "Developer: Execute Extension Development Host Command"
 */

(async function debugRNRadar() {
  console.log("=== RN Dependency Radar Debug Script ===");
  
  // 1. Check if extension is installed
  console.log("\n1. Checking extension installation...");
  const extensions = await vscode.extensions.all;
  const rnRadar = extensions.find(ext => 
    ext.id === "luisreisdev.rn-dependency-radar" || 
    ext.packageJSON.name === "rn-dependency-radar"
  );
  
  if (rnRadar) {
    console.log("✓ Extension found:", rnRadar.id);
    console.log("  - Version:", rnRadar.packageJSON.version);
    console.log("  - Path:", rnRadar.extensionPath);
    console.log("  - Active:", rnRadar.isActive);
    console.log("  - Exports:", Object.keys(rnRadar.exports || {}));
  } else {
    console.log("✗ Extension NOT found!");
    console.log("  Installed extensions:", extensions.map(e => e.id).filter(id => id.includes("radar") || id.includes("dependency")));
    return;
  }
  
  // 2. Try to activate extension
  console.log("\n2. Attempting to activate extension...");
  try {
    if (!rnRadar.isActive) {
      console.log("  Extension is not active, activating...");
      await rnRadar.activate();
      console.log("  ✓ Extension activated!");
    } else {
      console.log("  ✓ Extension is already active");
    }
  } catch (error) {
    console.error("  ✗ Error activating extension:", error);
    console.error("  Stack:", error.stack);
    return;
  }
  
  // 3. Check workspace
  console.log("\n3. Checking workspace...");
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    console.log("  ✓ Workspace found:", workspaceFolders[0].uri.fsPath);
    
    // Check for package.json
    const packageJsonPath = vscode.Uri.joinPath(workspaceFolders[0].uri, "package.json");
    try {
      await vscode.workspace.fs.readFile(packageJsonPath);
      console.log("  ✓ package.json exists");
    } catch (e) {
      console.log("  ✗ package.json not found");
    }
  } else {
    console.log("  ✗ No workspace folders");
  }
  
  // 4. Check commands
  console.log("\n4. Checking registered commands...");
  const commands = await vscode.commands.getCommands();
  const rnCommands = commands.filter(cmd => cmd.includes("rnDependencyRadar"));
  if (rnCommands.length > 0) {
    console.log("  ✓ Commands found:", rnCommands);
    
    // Try to execute showDetails command
    try {
      console.log("  Attempting to execute 'rnDependencyRadar.showDetails'...");
      await vscode.commands.executeCommand("rnDependencyRadar.showDetails");
      console.log("  ✓ Command executed successfully");
    } catch (error) {
      console.error("  ✗ Error executing command:", error);
    }
  } else {
    console.log("  ✗ No RN Dependency Radar commands found");
    console.log("  All commands:", commands.slice(0, 20));
  }
  
  // 5. Check status bar
  console.log("\n5. Checking status bar...");
  // Status bar items are not directly accessible via API, but we can check if the command works
  
  // 6. Check configuration
  console.log("\n6. Checking configuration...");
  const config = vscode.workspace.getConfiguration("rnDependencyRadar");
  console.log("  - scanOnStartup:", config.get("scanOnStartup"));
  console.log("  - alertLevel:", config.get("alertLevel"));
  console.log("  - riskThresholds:", config.get("riskThresholds"));
  
  // 7. Check extension exports
  console.log("\n7. Checking extension exports...");
  if (rnRadar.exports) {
    console.log("  Exports:", Object.keys(rnRadar.exports));
  } else {
    console.log("  No exports found");
  }
  
  // 8. Check for errors in extension host
  console.log("\n8. Summary:");
  console.log("  Extension installed:", !!rnRadar);
  console.log("  Extension active:", rnRadar.isActive);
  console.log("  Commands registered:", rnCommands.length > 0);
  console.log("  Workspace available:", !!(workspaceFolders && workspaceFolders.length > 0));
  
  console.log("\n=== Debug Complete ===");
  console.log("\nNext steps:");
  console.log("1. Check Output panel: View > Output > Select 'RN Dependency Radar'");
  console.log("2. Check Developer Tools Console for errors");
  console.log("3. Try manually activating: Command Palette > 'Developer: Reload Window'");
  
  return {
    extension: rnRadar,
    isActive: rnRadar.isActive,
    commands: rnCommands,
    workspace: workspaceFolders?.[0]?.uri.fsPath
  };
})();
