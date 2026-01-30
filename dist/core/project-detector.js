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
exports.ProjectDetector = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ProjectDetector {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    async detect() {
        const packageJsonPath = path.join(this.workspaceRoot, "package.json");
        if (!fs.existsSync(packageJsonPath)) {
            return null;
        }
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        const deps = {
            ...(packageJson.dependencies ?? {}),
            ...(packageJson.devDependencies ?? {})
        };
        const hasReactNative = "react-native" in deps;
        const hasExpo = "expo" in deps;
        if (!hasReactNative && !hasExpo) {
            return null;
        }
        const type = this.inferProjectType(hasReactNative, hasExpo);
        return {
            rootPath: this.workspaceRoot,
            type,
            hasExpo,
            hasReactNative
        };
    }
    inferProjectType(hasReactNative, hasExpo) {
        const appJsonPath = path.join(this.workspaceRoot, "app.json");
        const appConfigJsPath = path.join(this.workspaceRoot, "app.config.js");
        const hasExpoConfig = fs.existsSync(appJsonPath) || fs.existsSync(appConfigJsPath);
        if (hasExpo && hasExpoConfig && !hasReactNative) {
            return "expo-managed";
        }
        if (hasExpo && hasReactNative) {
            return hasExpoConfig ? "expo-managed" : "expo-bare";
        }
        return "react-native-cli";
    }
}
exports.ProjectDetector = ProjectDetector;
//# sourceMappingURL=project-detector.js.map