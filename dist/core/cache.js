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
exports.Cache = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
class Cache {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.cacheFile = path.join(this.workspaceRoot, ".rn-dependency-radar", "cache.json");
    }
    ensureDir() {
        const dir = path.dirname(this.cacheFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    computePackageHash() {
        const pkgPath = path.join(this.workspaceRoot, "package.json");
        if (!fs.existsSync(pkgPath)) {
            return null;
        }
        const content = fs.readFileSync(pkgPath, "utf8");
        return crypto.createHash("sha1").update(content).digest("hex");
    }
    read() {
        if (!fs.existsSync(this.cacheFile)) {
            return null;
        }
        try {
            const raw = fs.readFileSync(this.cacheFile, "utf8");
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    write(entry) {
        this.ensureDir();
        fs.writeFileSync(this.cacheFile, JSON.stringify(entry, null, 2), "utf8");
    }
}
exports.Cache = Cache;
//# sourceMappingURL=cache.js.map