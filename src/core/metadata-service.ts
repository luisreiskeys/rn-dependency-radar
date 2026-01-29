import * as https from "https";
import { ClientRequest } from "http";

export interface RemoteMetadata {
  latestVersion: string | null;
  lastUpdatedAt: string | null;
  versionTimes: Record<string, string> | null;
  deprecated: boolean;
  deprecationMessage: string | null;
}

export class MetadataService {
  private cache = new Map<string, RemoteMetadata | null>();

  async get(name: string): Promise<RemoteMetadata | null> {
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

      const json = JSON.parse(data) as {
        "dist-tags"?: { latest?: string };
        time?: Record<string, string>;
        deprecated?: string;
        versions?: Record<string, { deprecated?: string }>;
      };

      const latestVersion = json["dist-tags"]?.latest ?? null;
      let lastUpdatedAt: string | null = null;
      let versionTimes: Record<string, string> | null = null;

      if (json.time) {
        versionTimes = json.time;
        const entries = Object.entries(json.time).filter(
          ([k]) => k !== "created" && k !== "modified"
        );
        const sorted = entries.sort((a, b) =>
          a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0
        );
        lastUpdatedAt = sorted[0]?.[1] ?? null;
      }

      // npm can mark deprecation either at the package root or per-version.
      let deprecated = false;
      let deprecationMessage: string | null = null;

      if (typeof json.deprecated === "string") {
        deprecated = true;
        deprecationMessage = json.deprecated;
      } else if (latestVersion && json.versions && json.versions[latestVersion]) {
        const latestInfo = json.versions[latestVersion];
        if (typeof latestInfo.deprecated === "string") {
          deprecated = true;
          deprecationMessage = latestInfo.deprecated;
        }
      }

      const meta: RemoteMetadata = {
        latestVersion,
        lastUpdatedAt,
        versionTimes,
        deprecated,
        deprecationMessage
      };

      this.cache.set(name, meta);
      return meta;
    } catch {
      this.cache.set(name, null);
      return null;
    }
  }

  private fetchWithTimeout(url: string, timeoutMs: number): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      let timeoutHandle: NodeJS.Timeout;
      let resolved = false;

      const finish = (result: string | null) => {
        if (resolved) {
          return;
        }
        resolved = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        resolve(result);
      };

      const req: ClientRequest = https.get(url, (res) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        if (res.statusCode && res.statusCode >= 400) {
          finish(null);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => {
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

