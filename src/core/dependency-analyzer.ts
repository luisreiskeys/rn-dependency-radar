import * as fs from "fs";
import * as path from "path";
import * as semver from "semver";
import { ProjectInfo } from "../models/project";
import { DependencyInfo, DependencyRisk, DependencyType } from "../models/dependency";
import { RulesEngine } from "./rules-engine";
import { RiskScorer } from "./risk-scorer";
import { Cache } from "./cache";
import { MetadataService } from "./metadata-service";

export interface ScanResult {
  criticalCount: number;
  risks: DependencyRisk[];
}

export class DependencyAnalyzer {
  constructor(
    private readonly project: ProjectInfo,
    private readonly rulesEngine: RulesEngine,
    private readonly riskScorer: RiskScorer,
    private readonly cache: Cache,
    private readonly metadataService: MetadataService
  ) {}

  async scan(): Promise<ScanResult> {
    const pkgPath = path.join(this.project.rootPath, "package.json");
    if (!fs.existsSync(pkgPath)) {
      return { criticalCount: 0, risks: [] };
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const allDeps: Record<string, string> = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {})
    };
    const devNames = new Set<string>(Object.keys(pkg.devDependencies ?? {}));

    // Read actual installed versions from lock files
    const installedVersions = this.readInstalledVersions();

    const totalDeps = Object.keys(allDeps).length;
    console.log(`[RN Dependency Radar] Starting scan of ${totalDeps} dependencies...`);
    const scanStartTime = Date.now();
    let cacheHits = 0;
    let cacheMisses = 0;

    const dependencies = (await Promise.all(
      Object.entries(allDeps).map(async ([name, version]) => {
        const isDev = devNames.has(name);
        // Use actual installed version from lock file if available, otherwise use package.json version
        const actualVersion = installedVersions.get(name) || version as string;
        const dep = this.buildDependencyInfo(name, actualVersion, isDev);
        
        const metadataStartTime = Date.now();
        const remote = await this.metadataService.get(name);
        const metadataDuration = Date.now() - metadataStartTime;
        
        if (metadataDuration < 10) {
          cacheHits++;
        } else {
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
            const months =
              (Date.now() - new Date(remote.lastUpdatedAt).getTime()) /
              (1000 * 60 * 60 * 24 * 30);
            dep.meta.lastUpdateMonths = Math.floor(months);
          }

          if (remote.versionTimes && remote.latestVersion) {
            const normalizeVersion = (v: string) =>
              v.replace(/^[\^~><=]+/, "");

            const installedRange = dep.version;
            const installedSemver =
              semver.minVersion(installedRange)?.version ??
              normalizeVersion(installedRange);

            const latestSemver = normalizeVersion(remote.latestVersion);

            const installedTime =
              remote.versionTimes[installedSemver] ??
              remote.versionTimes[installedRange] ??
              null;

            if (installedTime) {
              const months =
                (Date.now() - new Date(installedTime).getTime()) /
                (1000 * 60 * 60 * 24 * 30);
              dep.meta.installedLastUpdatedAt = installedTime;
              dep.meta.installedLastUpdateMonths = Math.floor(months);
            }

            // Count how many versions exist between installed and latest
            const allVersions = Object.keys(remote.versionTimes).filter((v) =>
              semver.valid(normalizeVersion(v))
            );

            const installedValid = semver.valid(installedSemver);
            const latestValid = semver.valid(latestSemver);

            if (installedValid && latestValid) {
              const missed = allVersions.filter((v) => {
                const nv = normalizeVersion(v);
                return (
                  semver.gt(nv, installedSemver) &&
                  (semver.lte(nv, latestSemver) || nv === latestSemver)
                );
              });

              dep.meta.missedVersionsCount = missed.length;
            }
          }
        }

        return dep;
      })
    )) as DependencyInfo[];

    const scanDuration = Date.now() - scanStartTime;
    console.log(`[RN Dependency Radar] Metadata fetch completed in ${(scanDuration / 1000).toFixed(1)}s (${cacheHits} cached, ${cacheMisses} fetched from npm)`);

    const risks = dependencies.map((dep) =>
      this.rulesEngine.evaluate(dep, this.project, this.riskScorer)
    );

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
  async scanSingle(packageName: string): Promise<DependencyRisk | null> {
    const pkgPath = path.join(this.project.rootPath, "package.json");
    if (!fs.existsSync(pkgPath)) {
      return null;
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const allDeps: Record<string, string> = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {})
    };
    const devNames = new Set<string>(Object.keys(pkg.devDependencies ?? {}));

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
        const months =
          (Date.now() - new Date(remote.lastUpdatedAt).getTime()) /
          (1000 * 60 * 60 * 24 * 30);
        dep.meta.lastUpdateMonths = months;
      }

      if (remote.versionTimes && dep.meta.latestVersion && dep.version) {
        const normalizeVersion = (v: string) =>
          v.replace(/^[\^~><=]+/, "");

        const installedRange = dep.version;
        const installedSemver =
          semver.minVersion(installedRange)?.version ??
          normalizeVersion(installedRange);

        const latestSemver = normalizeVersion(dep.meta.latestVersion);

        const installedTime =
          remote.versionTimes[installedSemver] ??
          remote.versionTimes[installedRange] ??
          null;

        if (installedTime) {
          const months =
            (Date.now() - new Date(installedTime).getTime()) /
            (1000 * 60 * 60 * 24 * 30);
          dep.meta.installedLastUpdatedAt = installedTime;
          dep.meta.installedLastUpdateMonths = Math.floor(months);
        }

        // Count how many versions exist between installed and latest
        const allVersions = Object.keys(remote.versionTimes).filter((v) =>
          semver.valid(normalizeVersion(v))
        );

        const installedValid = semver.valid(installedSemver);
        const latestValid = semver.valid(latestSemver);

        if (installedValid && latestValid) {
          const missed = allVersions.filter((v) => {
            const nv = normalizeVersion(v);
            return (
              semver.gt(nv, installedSemver) &&
              (semver.lte(nv, latestSemver) || nv === latestSemver)
            );
          });

          dep.meta.missedVersionsCount = missed.length;
        }
      }

      if (dep.version && dep.meta.lastUpdatedAt) {
        try {
          const installed = semver.parse(dep.version);
          if (installed && installed.release) {
            // Approximate: use latest update date as proxy
            const months =
              (Date.now() - new Date(dep.meta.lastUpdatedAt).getTime()) /
              (1000 * 60 * 60 * 24 * 30);
            dep.meta.installedLastUpdateMonths = months;
            dep.meta.installedLastUpdatedAt = dep.meta.lastUpdatedAt;
          }
        } catch (e) {
          // Invalid semver
        }
      }
    }

    const risk = this.rulesEngine.evaluate(dep, this.project, this.riskScorer);
    return risk;
  }

  private buildDependencyInfo(
    name: string,
    version: string,
    isDev: boolean
  ) {
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
      } as import("../models/dependency").DependencyMeta
    };
  }

  private readInstalledVersions(): Map<string, string> {
    const versions = new Map<string, string>();
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
      } catch (error) {
        console.error("[RN Dependency Radar] Error reading yarn.lock:", error);
      }
    } else if (hasPackageLock) {
      // Read package-lock.json
      try {
        const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));
        if (packageLock.packages) {
          // package-lock.json v2+ format
          Object.entries(packageLock.packages).forEach(([pkgPath, pkgData]: [string, any]) => {
            if (pkgData?.version && pkgPath !== "" && pkgPath.startsWith("node_modules/")) {
              // Extract package name from path (e.g., "node_modules/@react-navigation/bottom-tabs" -> "@react-navigation/bottom-tabs")
              // or "node_modules/react" -> "react"
              const pkgName = pkgPath.replace(/^node_modules\//, "");
              versions.set(pkgName, pkgData.version);
            }
          });
        } else if (packageLock.dependencies) {
          // package-lock.json v1 format (legacy)
          const extractVersions = (deps: any, prefix = "") => {
            Object.entries(deps).forEach(([name, dep]: [string, any]) => {
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
      } catch (error) {
        console.error("[RN Dependency Radar] Error reading package-lock.json:", error);
      }
    }

    return versions;
  }

  private inferType(name: string): DependencyType {
    const nativeHints = ["react-native-", "@react-native-", "expo-"];
    if (nativeHints.some((hint) => name.startsWith(hint))) {
      return "native";
    }
    return "js";
  }
}

