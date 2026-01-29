import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

interface CacheEntry {
  packageHash: string;
  lastScanAt: string;
  criticalCount: number;
}

export class Cache {
  private readonly cacheFile: string;

  constructor(private readonly workspaceRoot: string) {
    this.cacheFile = path.join(this.workspaceRoot, ".rn-dependency-radar", "cache.json");
  }

  ensureDir() {
    const dir = path.dirname(this.cacheFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  computePackageHash(): string | null {
    const pkgPath = path.join(this.workspaceRoot, "package.json");
    if (!fs.existsSync(pkgPath)) {
      return null;
    }
    const content = fs.readFileSync(pkgPath, "utf8");
    return crypto.createHash("sha1").update(content).digest("hex");
  }

  read(): CacheEntry | null {
    if (!fs.existsSync(this.cacheFile)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(this.cacheFile, "utf8");
      return JSON.parse(raw) as CacheEntry;
    } catch {
      return null;
    }
  }

  write(entry: CacheEntry) {
    this.ensureDir();
    fs.writeFileSync(this.cacheFile, JSON.stringify(entry, null, 2), "utf8");
  }
}

