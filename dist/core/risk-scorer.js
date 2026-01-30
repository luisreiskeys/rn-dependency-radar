"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskScorer = void 0;
class RiskScorer {
    scoreFromRisk(level) {
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
    maxRisk(a, b) {
        const order = ["low", "medium", "high", "unknown"];
        return order.indexOf(b) > order.indexOf(a) ? b : a;
    }
}
exports.RiskScorer = RiskScorer;
//# sourceMappingURL=risk-scorer.js.map