import { RiskLevel } from "../models/dependency";

export class RiskScorer {
  scoreFromRisk(level: RiskLevel): number {
    switch (level) {
      case "high":
        return 90;
      case "medium":
        return 60;
      case "low":
        return 20;
      default:
        return 0;
    }
  }

  maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
    const order: RiskLevel[] = ["low", "medium", "high", "unknown"];
    return order.indexOf(b) > order.indexOf(a) ? b : a;
  }
}

