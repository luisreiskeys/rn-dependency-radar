export type DependencyType = "js" | "native" | "unknown";

export type RiskLevel = "low" | "medium" | "high" | "unknown";

export interface DependencyMeta {
  lastUpdateMonths?: number;
  lastUpdatedAt?: string | null;
  installedLastUpdateMonths?: number;
  installedLastUpdatedAt?: string | null;
  missedVersionsCount?: number;
  deprecated?: boolean;
  hasNativeModule?: boolean;
  createdForRNVersion?: string | null;
  supportsExpoManaged?: boolean | null;
  latestVersion?: string | null;
   isDevDependency?: boolean;
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: DependencyType;
  meta: DependencyMeta;
}

export interface DependencyRisk {
  dependency: DependencyInfo;
  riskLevel: RiskLevel;
  libraryRiskLevel: RiskLevel;
  projectRiskLevel: RiskLevel;
  score: number;
  triggeredRules: {
    id: string;
    risk: RiskLevel;
    message: string;
  }[];
}

