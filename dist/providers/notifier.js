"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notifier = void 0;
const vscode = __importStar(require("vscode"));
class Notifier {
    constructor(config) {
        this.config = config;
        this.ignored = new Set();
    }
    filterIgnored(risks) {
        return risks.filter((r) => !this.shouldIgnore(r.dependency.name));
    }
    async notifySummary(criticalCount, scanDuration) {
        const alertLevel = (this.config.get("alertLevel", "high") ?? "high");
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
        const message = criticalCount === 1
            ? `${title}: ${severityEmoji} 1 dependency with HIGH risk detected${durationText}.`
            : `${title}: ${severityEmoji} ${criticalCount} dependencies with HIGH risk detected${durationText}.`;
        const selection = await vscode.window.showWarningMessage(message, "View details");
        if (selection === "View details") {
            await vscode.commands.executeCommand("rnDependencyRadar.showDetails");
        }
    }
    shouldIgnore(name) {
        if (this.ignored.has(name)) {
            return true;
        }
        const ignoreList = this.config.get("ignore", []) ?? [];
        return ignoreList.includes(name);
    }
}
exports.Notifier = Notifier;
//# sourceMappingURL=notifier.js.map