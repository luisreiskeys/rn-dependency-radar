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
exports.DependencyAnalyzer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const semver = __importStar(require("semver"));
class DependencyAnalyzer {
    constructor(project, rulesEngine, riskScorer, cache, metadataService) {
        this.project = project;
        this.rulesEngine = rulesEngine;
        this.riskScorer = riskScorer;
        this.cache = cache;
        this.metadataService = metadataService;
    }
    async scan() {
        const pkgPath = path.join(this.project.rootPath, "package.json");
        if (!fs.existsSync(pkgPath)) {
            return { criticalCount: 0, risks: [] };
        }
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        const allDeps = {
            ...(pkg.dependencies ?? {}),
            ...(pkg.devDependencies ?? {})
        };
        const devNames = new Set(Object.keys(pkg.devDependencies ?? {}));
        // Read actual installed versions from lock files
        const installedVersions = this.readInstalledVersions();
        const totalDeps = Object.keys(allDeps).length;
        console.log(`[RN Dependency Radar] Starting scan of ${totalDeps} dependencies...`);
        const scanStartTime = Date.now();
        let cacheHits = 0;
        let cacheMisses = 0;
        const dependencies = (await Promise.all(Object.entries(allDeps).map(async ([name, version]) => {
            const isDev = devNames.has(name);
            // Use actual installed version from lock file if available, otherwise use package.json version
            const actualVersion = installedVersions.get(name) || version;
            const dep = this.buildDependencyInfo(name, actualVersion, isDev);
            const metadataStartTime = Date.now();
            const remote = await this.metadataService.get(name);
            const metadataDuration = Date.now() - metadataStartTime;
            if (metadataDuration < 10) {
                cacheHits++;
            }
            else {
                cacheMisses++;
                if (metadataDuration > 1000) {
                    console.log(`[RN Dependency Radar] Slow metadata fetch for ${name}: ${metadataDuration}ms`);
                }
            }
            if (remote) {
                dep.meta.latestVersion = remote.latestVersion;
                dep.meta.lastUpdatedAt = remote.lastUpdatedAt;
                dep.meta.deprecated = remote.deprecated;
                if (remote.lastUpdatedAt) {
                    const months = (Date.now() - new Date(remote.lastUpdatedAt).getTime()) /
                        (1000 * 60 * 60 * 24 * 30);
                    dep.meta.lastUpdateMonths = Math.floor(months);
                }
                if (remote.versionTimes && remote.latestVersion) {
                    const normalizeVersion = (v) => v.replace(/^[\^~><=]+/, "");
                    const installedRange = dep.version;
                    const installedSemver = semver.minVersion(installedRange)?.version ??
                        normalizeVersion(installedRange);
                    const latestSemver = normalizeVersion(remote.latestVersion);
                    const installedTime = remote.versionTimes[installedSemver] ??
                        remote.versionTimes[installedRange] ??
                        null;
                    if (installedTime) {
                        const months = (Date.now() - new Date(installedTime).getTime()) /
                            (1000 * 60 * 60 * 24 * 30);
                        dep.meta.installedLastUpdatedAt = installedTime;
                        dep.meta.installedLastUpdateMonths = Math.floor(months);
                    }
                    // Count how many versions exist between installed and latest
                    const allVersions = Object.keys(remote.versionTimes).filter((v) => semver.valid(normalizeVersion(v)));
                    const installedValid = semver.valid(installedSemver);
                    const latestValid = semver.valid(latestSemver);
                    if (installedValid && latestValid) {
                        const missed = allVersions.filter((v) => {
                            const nv = normalizeVersion(v);
                            return (semver.gt(nv, installedSemver) &&
                                (semver.lte(nv, latestSemver) || nv === latestSemver));
                        });
                        dep.meta.missedVersionsCount = missed.length;
                    }
                }
            }
            return dep;
        })));
        const scanDuration = Date.now() - scanStartTime;
        console.log(`[RN Dependency Radar] Metadata fetch completed in ${(scanDuration / 1000).toFixed(1)}s (${cacheHits} cached, ${cacheMisses} fetched from npm)`);
        const risks = dependencies.map((dep) => this.rulesEngine.evaluate(dep, this.project, this.riskScorer));
        const cacheHash = this.cache.computePackageHash();
        if (cacheHash) {
            this.cache.write({
                packageHash: cacheHash,
                lastScanAt: new Date().toISOString(),
                criticalCount: risks.filter((r) => r.riskLevel === "high").length
            });
        }
        return {
            criticalCount: risks.filter((r) => r.riskLevel === "high").length,
            risks
        };
    }
    /**
     * Scan a single dependency (incremental scan)
     */
    async scanSingle(packageName) {
        const pkgPath = path.join(this.project.rootPath, "package.json");
        if (!fs.existsSync(pkgPath)) {
            return null;
        }
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        const allDeps = {
            ...(pkg.dependencies ?? {}),
            ...(pkg.devDependencies ?? {})
        };
        const devNames = new Set(Object.keys(pkg.devDependencies ?? {}));
        if (!(packageName in allDeps)) {
            return null; // Package not found
        }
        const version = allDeps[packageName];
        const isDev = devNames.has(packageName);
        const installedVersions = this.readInstalledVersions();
        const actualVersion = installedVersions.get(packageName) || version;
        const dep = this.buildDependencyInfo(packageName, actualVersion, isDev);
        const remote = await this.metadataService.get(packageName);
        if (remote) {
            dep.meta.latestVersion = remote.latestVersion;
            dep.meta.lastUpdatedAt = remote.lastUpdatedAt;
            dep.meta.deprecated = remote.deprecated;
            if (remote.lastUpdatedAt) {
                const months = (Date.now() - new Date(remote.lastUpdatedAt).getTime()) /
                    (1000 * 60 * 60 * 24 * 30);
                dep.meta.lastUpdateMonths = months;
            }
            if (remote.versionTimes && dep.meta.latestVersion && dep.version) {
                const normalizeVersion = (v) => v.replace(/^[\^~><=]+/, "");
                const installedRange = dep.version;
                const installedSemver = semver.minVersion(installedRange)?.version ??
                    normalizeVersion(installedRange);
                const latestSemver = normalizeVersion(dep.meta.latestVersion);
                const installedTime = remote.versionTimes[installedSemver] ??
                    remote.versionTimes[installedRange] ??
                    null;
                if (installedTime) {
                    const months = (Date.now() - new Date(installedTime).getTime()) /
                        (1000 * 60 * 60 * 24 * 30);
                    dep.meta.installedLastUpdatedAt = installedTime;
                    dep.meta.installedLastUpdateMonths = Math.floor(months);
                }
                // Count how many versions exist between installed and latest
                const allVersions = Object.keys(remote.versionTimes).filter((v) => semver.valid(normalizeVersion(v)));
                const installedValid = semver.valid(installedSemver);
                const latestValid = semver.valid(latestSemver);
                if (installedValid && latestValid) {
                    const missed = allVersions.filter((v) => {
                        const nv = normalizeVersion(v);
                        return (semver.gt(nv, installedSemver) &&
                            (semver.lte(nv, latestSemver) || nv === latestSemver));
                    });
                    dep.meta.missedVersionsCount = missed.length;
                }
            }
            if (dep.version && dep.meta.lastUpdatedAt) {
                try {
                    const installed = semver.parse(dep.version);
                    if (installed && installed.release) {
                        // Approximate: use latest update date as proxy
                        const months = (Date.now() - new Date(dep.meta.lastUpdatedAt).getTime()) /
                            (1000 * 60 * 60 * 24 * 30);
                        dep.meta.installedLastUpdateMonths = months;
                        dep.meta.installedLastUpdatedAt = dep.meta.lastUpdatedAt;
                    }
                }
                catch (e) {
                    // Invalid semver
                }
            }
        }
        const risk = this.rulesEngine.evaluate(dep, this.project, this.riskScorer);
        return risk;
    }
    buildDependencyInfo(name, version, isDev) {
        const type = this.inferType(name);
        return {
            name,
            version,
            type,
            meta: {
                // Base metadata; other fields (latestVersion, dates, etc.) are filled by MetadataService.
                lastUpdateMonths: undefined,
                lastUpdatedAt: undefined,
                installedLastUpdateMonths: undefined,
                installedLastUpdatedAt: undefined,
                missedVersionsCount: undefined,
                deprecated: undefined,
                hasNativeModule: type === "native" ? true : undefined,
                createdForRNVersion: null,
                supportsExpoManaged: null,
                latestVersion: undefined,
                isDevDependency: isDev
            }
        };
    }
    readInstalledVersions() {
        const versions = new Map();
        const rootPath = this.project.rootPath;
        const packageLockPath = path.join(rootPath, "package-lock.json");
        const yarnLockPath = path.join(rootPath, "yarn.lock");
        const hasPackageLock = fs.existsSync(packageLockPath);
        const hasYarnLock = fs.existsSync(yarnLockPath);
        // Determine which package manager is being used
        // Prefer yarn.lock if it exists (common in React Native projects)
        // Otherwise use package-lock.json if it exists
        const useYarn = hasYarnLock;
        if (useYarn && hasYarnLock) {
            // Read yarn.lock
            try {
                const yarnLockContent = fs.readFileSync(yarnLockPath, "utf8");
                // Parse yarn.lock format (text-based)
                // Pattern: "package-name@version-range:" or 'package-name@version-range:'
                const lines = yarnLockContent.split("\n");
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    // Match package declaration line (e.g., "@react-navigation/bottom-tabs@^7.4.0:" or '"@react-navigation/bottom-tabs@^7.4.0":')
                    // Handle both quoted and unquoted formats
                    const pkgMatch = line.match(/^["']?(.+?)@(.+?)["']?:$/);
                    if (pkgMatch) {
                        const pkgName = pkgMatch[1];
                        // Look ahead for version field in the next few lines (within the same block)
                        for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
                            const nextLine = lines[j].trim();
                            // Stop if we hit another package declaration (new block)
                            if (nextLine.match(/^["']?.+@.+["']?:$/)) {
                                break;
                            }
                            // Match version field
                            const versionMatch = nextLine.match(/^version\s+["'](.+?)["']$/);
                            if (versionMatch) {
                                versions.set(pkgName, versionMatch[1]);
                                break;
                            }
                        }
                    }
                }
                console.log(`[RN Dependency Radar] Read ${versions.size} versions from yarn.lock`);
            }
            catch (error) {
                console.error("[RN Dependency Radar] Error reading yarn.lock:", error);
            }
        }
        else if (hasPackageLock) {
            // Read package-lock.json
            try {
                const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));
                if (packageLock.packages) {
                    // package-lock.json v2+ format
                    Object.entries(packageLock.packages).forEach(([pkgPath, pkgData]) => {
                        if (pkgData?.version && pkgPath !== "" && pkgPath.startsWith("node_modules/")) {
                            // Extract package name from path (e.g., "node_modules/@react-navigation/bottom-tabs" -> "@react-navigation/bottom-tabs")
                            // or "node_modules/react" -> "react"
                            const pkgName = pkgPath.replace(/^node_modules\//, "");
                            versions.set(pkgName, pkgData.version);
                        }
                    });
                }
                else if (packageLock.dependencies) {
                    // package-lock.json v1 format (legacy)
                    const extractVersions = (deps, prefix = "") => {
                        Object.entries(deps).forEach(([name, dep]) => {
                            if (dep?.version) {
                                const fullName = prefix ? `${prefix}/${name}` : name;
                                versions.set(fullName, dep.version);
                                if (dep.dependencies) {
                                    extractVersions(dep.dependencies, fullName);
                                }
                            }
                        });
                    };
                    extractVersions(packageLock.dependencies);
                }
                console.log(`[RN Dependency Radar] Read ${versions.size} versions from package-lock.json`);
            }
            catch (error) {
                console.error("[RN Dependency Radar] Error reading package-lock.json:", error);
            }
        }
        return versions;
    }
    inferType(name) {
        const nativeHints = ["react-native-", "@react-native-", "expo-"];
        if (nativeHints.some((hint) => name.startsWith(hint))) {
            return "native";
        }
        return "js";
    }
}
exports.DependencyAnalyzer = DependencyAnalyzer;
//# sourceMappingURL=dependency-analyzer.js.map