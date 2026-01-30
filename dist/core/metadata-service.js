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
exports.MetadataService = void 0;
const https = __importStar(require("https"));
class MetadataService {
    constructor() {
        this.cache = new Map();
    }
    async get(name) {
        if (this.cache.has(name)) {
            return this.cache.get(name) ?? null;
        }
        const encoded = encodeURIComponent(name);
        const url = `https://registry.npmjs.org/${encoded}`;
        try {
            const data = await this.fetchWithTimeout(url, 5000);
            if (!data) {
                this.cache.set(name, null);
                return null;
            }
            const json = JSON.parse(data);
            const latestVersion = json["dist-tags"]?.latest ?? null;
            let lastUpdatedAt = null;
            let versionTimes = null;
            if (json.time) {
                versionTimes = json.time;
                const entries = Object.entries(json.time).filter(([k]) => k !== "created" && k !== "modified");
                const sorted = entries.sort((a, b) => a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0);
                lastUpdatedAt = sorted[0]?.[1] ?? null;
            }
            // npm can mark deprecation either at the package root or per-version.
            let deprecated = false;
            let deprecationMessage = null;
            if (typeof json.deprecated === "string") {
                deprecated = true;
                deprecationMessage = json.deprecated;
            }
            else if (latestVersion && json.versions && json.versions[latestVersion]) {
                const latestInfo = json.versions[latestVersion];
                if (typeof latestInfo.deprecated === "string") {
                    deprecated = true;
                    deprecationMessage = latestInfo.deprecated;
                }
            }
            const meta = {
                latestVersion,
                lastUpdatedAt,
                versionTimes,
                deprecated,
                deprecationMessage
            };
            this.cache.set(name, meta);
            return meta;
        }
        catch {
            this.cache.set(name, null);
            return null;
        }
    }
    fetchWithTimeout(url, timeoutMs) {
        return new Promise((resolve) => {
            let timeoutHandle;
            let resolved = false;
            const finish = (result) => {
                if (resolved) {
                    return;
                }
                resolved = true;
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }
                resolve(result);
            };
            const req = https.get(url, (res) => {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }
                if (res.statusCode && res.statusCode >= 400) {
                    finish(null);
                    return;
                }
                const chunks = [];
                res.on("data", (c) => {
                    chunks.push(c);
                });
                res.on("end", () => {
                    finish(Buffer.concat(chunks).toString("utf8"));
                });
            });
            req.on("error", () => {
                finish(null);
            });
            timeoutHandle = setTimeout(() => {
                req.destroy();
                finish(null);
            }, timeoutMs);
        });
    }
}
exports.MetadataService = MetadataService;
//# sourceMappingURL=metadata-service.js.map