import { DependencyInfo, DependencyRisk, RiskLevel } from "../models/dependency";
import { ProjectInfo } from "../models/project";
import { RiskScorer } from "./risk-scorer";

export interface RuleDefinition {
  id: string;
  scope: "react-native";
  target?: "library" | "project";
  conditions: {
    dependencyType?: "js" | "native";
    hasNativeModule?: boolean;
    lastUpdateMonths?: string;
    missedVersionsCount?: string;
    installedLastUpdateMonths?: string;
    deprecated?: boolean;
    createdForRNVersion?: string;
    supportsExpoManaged?: boolean;
  };
  risk: RiskLevel;
  message: string;
}

export interface RiskThresholds {
  installedVersionAgeMonths: { high: number; medium: number };
  missedVersionsCount: { high: number; medium: number };
  libraryLastUpdateMonths: { high: number; medium: number };
}

export class RulesEngine {
  private dynamicRules: RuleDefinition[] = [];

  constructor(
    private readonly staticRules: RuleDefinition[],
    private readonly thresholds?: RiskThresholds
  ) {
    this.generateDynamicRules();
  }

  private generateDynamicRules() {
    if (!this.thresholds) {
      return;
    }

    const t = this.thresholds;

    // Dynamic rules for installed version age (applies to both JS and native)
    this.dynamicRules = [
      {
        id: "installed-version-very-old",
        scope: "react-native",
        target: "project",
        conditions: {
          installedLastUpdateMonths: `>${t.installedVersionAgeMonths.high}`
        },
        risk: "high",
        message: `Installed version is more than ${t.installedVersionAgeMonths.high} months old — high risk of compatibility issues and missing security patches.`
      },
      {
        id: "installed-version-old",
        scope: "react-native",
        target: "project",
        conditions: {
          installedLastUpdateMonths: `>${t.installedVersionAgeMonths.medium}`
        },
        risk: "medium",
        message: `Installed version is more than ${t.installedVersionAgeMonths.medium} months old — consider upgrading to reduce compatibility risks.`
      },
      {
        id: "many-missed-versions-high",
        scope: "react-native",
        target: "project",
        conditions: {
          missedVersionsCount: `>${t.missedVersionsCount.high}`
        },
        risk: "high",
        message: `More than ${t.missedVersionsCount.high} versions behind latest — significant upgrade required, may have breaking changes.`
      },
      {
        id: "many-missed-versions-medium",
        scope: "react-native",
        target: "project",
        conditions: {
          missedVersionsCount: `>${t.missedVersionsCount.medium}`
        },
        risk: "medium",
        message: `More than ${t.missedVersionsCount.medium} versions behind latest — consider upgrading to stay current.`
      },
      {
        id: "library-no-update-high",
        scope: "react-native",
        target: "library",
        conditions: {
          lastUpdateMonths: `>${t.libraryLastUpdateMonths.high}`
        },
        risk: "high",
        message: `Library hasn't been updated in more than ${t.libraryLastUpdateMonths.high} months — may be abandoned or unmaintained.`
      },
      {
        id: "library-no-update-medium",
        scope: "react-native",
        target: "library",
        conditions: {
          lastUpdateMonths: `>${t.libraryLastUpdateMonths.medium}`
        },
        risk: "medium",
        message: `Library hasn't been updated in more than ${t.libraryLastUpdateMonths.medium} months — monitor for maintenance activity.`
      }
    ];
  }

  private getAllRules(): RuleDefinition[] {
    return [...this.staticRules, ...this.dynamicRules];
  }

  evaluate(
    dependency: DependencyInfo,
    project: ProjectInfo,
    scorer: RiskScorer
  ): DependencyRisk {
    // Se não temos data de atualização, não aplica regras baseadas em tempo
    const hasUpdateDate = dependency.meta.lastUpdateMonths != null;

    const allRules = this.getAllRules();
    const triggered = allRules
      .filter((rule) => {
        // Se a regra depende de lastUpdateMonths e não temos essa info, pula
        if (rule.conditions.lastUpdateMonths && !hasUpdateDate) {
          return false;
        }
        return this.matches(rule, dependency, project);
      })
      .map((rule) => ({
        id: rule.id,
        risk: rule.risk,
        message: rule.message,
        target: rule.target ?? "library"
      }));

    // Se não temos data de atualização, adiciona uma mensagem especial
    if (!hasUpdateDate && dependency.type === "native") {
      triggered.push({
        id: "no-update-date",
        risk: "low",
        message: "Last update date not available — please check manually in the library repository.",
        target: "library"
      });
    }

    const libraryRules = triggered.filter((r) => r.target === "library");
    const projectRules = triggered.filter((r) => r.target === "project");

    const libraryRisk: RiskLevel =
      libraryRules.reduce<RiskLevel>(
        (acc, r) => scorer.maxRisk(acc, r.risk),
        "low"
      ) || "low";

    const projectRisk: RiskLevel =
      projectRules.reduce<RiskLevel>(
        (acc, r) => scorer.maxRisk(acc, r.risk),
        "low"
      ) || "low";

    const highestRisk = scorer.maxRisk(libraryRisk, projectRisk);

    const justifications =
      highestRisk === "low"
        ? triggered.filter((r) => r.risk === "low")
        : triggered.filter((r) => r.risk === highestRisk);

    const score = scorer.scoreFromRisk(highestRisk);

    return {
      dependency,
      riskLevel: highestRisk,
      libraryRiskLevel: libraryRisk,
      projectRiskLevel: projectRisk,
      score,
      triggeredRules: justifications
    };
  }

  private matches(rule: RuleDefinition, dep: DependencyInfo, project: ProjectInfo): boolean {
    if (rule.scope === "react-native" && !project.hasReactNative) {
      return false;
    }

    const c = rule.conditions;
    const m = dep.meta;

    if (c.dependencyType && dep.type !== c.dependencyType) {
      return false;
    }

    if (typeof c.hasNativeModule === "boolean" && m.hasNativeModule !== c.hasNativeModule) {
      return false;
    }

    if (typeof c.supportsExpoManaged === "boolean") {
      if (m.supportsExpoManaged == null) {
        return false;
      }
      if (m.supportsExpoManaged !== c.supportsExpoManaged) {
        return false;
      }
    }

    if (typeof c.deprecated === "boolean" && m.deprecated !== c.deprecated) {
      return false;
    }

    // Helper to evaluate numeric conditions like ">12" or "<3"
    const matchesNumeric = (expr: string, value: number | undefined | null): boolean => {
      if (value == null) {
        return false;
      }
      const op = expr[0];
      const num = Number(expr.slice(1));
      if (Number.isNaN(num)) {
        return false;
      }
      if (op === ">" && !(value > num)) {
        return false;
      }
      if (op === "<" && !(value < num)) {
        return false;
      }
      if (op === "=" && !(value === num)) {
        return false;
      }
      return true;
    };

    // Time-based rules (overall last update)
    if (c.lastUpdateMonths && !matchesNumeric(c.lastUpdateMonths, m.lastUpdateMonths)) {
      return false;
    }

    // Installed version age rules
    if (
      c.installedLastUpdateMonths &&
      !matchesNumeric(c.installedLastUpdateMonths, m.installedLastUpdateMonths)
    ) {
      return false;
    }

    // Missed versions rules
    if (c.missedVersionsCount && !matchesNumeric(c.missedVersionsCount, m.missedVersionsCount)) {
      return false;
    }

    if (c.createdForRNVersion && m.createdForRNVersion) {
      if (c.createdForRNVersion === "<0.60") {
        if (!m.createdForRNVersion.startsWith("0.") || Number(m.createdForRNVersion.split(".")[1]) >= 60) {
          return false;
        }
      }
    }

    return true;
  }
}

