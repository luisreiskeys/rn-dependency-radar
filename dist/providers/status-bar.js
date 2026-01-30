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
exports.StatusBarProvider = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarProvider {
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.item.text = "📡 RN Radar";
        this.item.tooltip = "RN Dependency Radar — React Native / Expo dependency risk monitor.";
        this.item.command = "rnDependencyRadar.showDetails";
        this.item.show();
    }
    register(context) {
        context.subscriptions.push(this.item);
    }
    update(criticalCount, customText) {
        if (customText) {
            this.item.text = `📡 RN Radar: ${customText}`;
            this.item.color = undefined;
        }
        else if (criticalCount > 0) {
            this.item.text = `📡 RN Radar: ${criticalCount} ${criticalCount === 1 ? 'critical' : 'criticals'}`;
            this.item.color = new vscode.ThemeColor("errorForeground");
        }
        else {
            this.item.text = "📡 RN Radar: ok";
            this.item.color = undefined;
        }
    }
    dispose() {
        this.item.dispose();
    }
}
exports.StatusBarProvider = StatusBarProvider;
//# sourceMappingURL=status-bar.js.map