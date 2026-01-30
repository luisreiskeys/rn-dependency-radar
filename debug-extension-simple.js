/**
 * Simple Debug Script - Copy and paste into VS Code Developer Tools Console
 * 
 * Steps:
 * 1. Open VS Code
 * 2. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)
 * 3. Type "Developer: Toggle Developer Tools"
 * 4. Go to Console tab
 * 5. Copy and paste ALL the code below
 * 6. Press Enter
 */

// Check if extension is installed
// Note: This script must be run in the Extension Host context
// Try: Command Palette > "Developer: Execute Extension Development Host Command"
// Or use the Output panel to see extension logs

(async function() {
  try {
    // Access extensions API
    const extensions = await vscode.extensions.all || [];
    const rnRadar = extensions.find(ext => 
      ext.id === "luisreisdev.rn-dependency-radar" || 
      ext.packageJSON?.name === "rn-dependency-radar"
    );

console.log("=== RN Dependency Radar Debug ===");
console.log("Extension found:", !!rnRadar);

if (rnRadar) {
  console.log("ID:", rnRadar.id);
  console.log("Version:", rnRadar.packageJSON.version);
  console.log("Path:", rnRadar.extensionPath);
  console.log("Active:", rnRadar.isActive);
  
  // Try to activate
  if (!rnRadar.isActive) {
    console.log("\nActivating extension...");
    rnRadar.activate().then(() => {
      console.log("✓ Activated!");
    }).catch(err => {
      console.error("✗ Activation error:", err);
    });
  }
  
  // Check commands
  vscode.commands.getCommands().then(commands => {
    const rnCommands = commands.filter(c => c.includes("rnDependencyRadar"));
    console.log("\nCommands:", rnCommands);
    
    if (rnCommands.length > 0) {
      console.log("\nTrying to execute showDetails...");
      vscode.commands.executeCommand("rnDependencyRadar.showDetails").then(() => {
        console.log("✓ Command executed");
      }).catch(err => {
        console.error("✗ Command error:", err);
      });
    }
  });
  
  // Check workspace
  const ws = vscode.workspace.workspaceFolders;
  console.log("\nWorkspace:", ws?.[0]?.uri.fsPath || "None");
  
} else {
  console.log("Extension NOT installed!");
  console.log("Searching for similar extensions...");
  extensions.filter(e => 
    e.id.includes("radar") || 
    e.id.includes("dependency") ||
    e.packageJSON?.name?.includes("radar")
  ).forEach(e => {
    console.log("  -", e.id);
  });
}

  } catch (error) {
    console.error("Error accessing extensions API:", error);
    console.log("\n=== Alternative: Check Output Panel ===");
    console.log("View > Output > Select 'RN Dependency Radar'");
    console.log("Or use Command Palette > 'Developer: Open Extension Host Log'");
  }
})();
