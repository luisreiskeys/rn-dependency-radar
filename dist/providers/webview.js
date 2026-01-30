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
exports.RadarWebview = void 0;
const vscode = __importStar(require("vscode"));
class RadarWebview {
    constructor(context) {
        this.context = context;
        this.lastRisks = [];
    }
    show(risks = null) {
        if (risks) {
            this.lastRisks = risks;
        }
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel("rnDependencyRadar.details", "RN Dependency Radar — Dependencies", vscode.ViewColumn.One, {
                enableScripts: true
            });
            // Handle messages from webview
            this.panel.webview.onDidReceiveMessage((message) => {
                switch (message.command) {
                    case "openSettings":
                        // Use our custom command to open settings
                        vscode.commands.executeCommand("rnDependencyRadar.openSettings").then(() => {
                            console.log("[RN Dependency Radar] Settings opened via command");
                        }, (error) => {
                            console.error("[RN Dependency Radar] Error opening settings:", error);
                        });
                        return;
                }
            }, null, this.context.subscriptions);
            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null, this.context.subscriptions);
        }
        else {
            this.panel.reveal(vscode.ViewColumn.One);
        }
        // Se não tem dados ainda, mostra loading
        if (!this.lastRisks || this.lastRisks.length === 0) {
            this.panel.webview.html = this.renderLoading();
        }
        else {
            this.panel.webview.html = this.renderHtml(this.lastRisks);
        }
    }
    showLoading() {
        if (!this.panel) {
            this.show(null);
        }
        else {
            this.panel.webview.html = this.renderLoading();
        }
    }
    update(risks) {
        this.lastRisks = risks;
        if (this.panel) {
            this.panel.webview.html = this.renderHtml(this.lastRisks);
        }
    }
    isVisible() {
        return this.panel !== undefined;
    }
    renderHtml(risks) {
        const runtimeRisks = risks.filter((r) => !r.dependency.meta.isDevDependency);
        const devRisks = risks.filter((r) => r.dependency.meta.isDevDependency);
        const totalRuntime = runtimeRisks.length;
        const totalDev = devRisks.length;
        const normalizeVersion = (v) => v.replace(/^[\^~>=<]/, "");
        const byRiskRuntime = runtimeRisks.reduce((acc, r) => {
            acc[r.riskLevel] = (acc[r.riskLevel] ?? 0) + 1;
            return acc;
        }, {});
        const byRiskDev = devRisks.reduce((acc, r) => {
            acc[r.riskLevel] = (acc[r.riskLevel] ?? 0) + 1;
            return acc;
        }, {});
        const byTypeRuntime = runtimeRisks.reduce((acc, r) => {
            const t = r.dependency.type;
            acc[t] = (acc[t] ?? 0) + 1;
            return acc;
        }, {});
        const byTypeDev = devRisks.reduce((acc, r) => {
            const t = r.dependency.type;
            acc[t] = (acc[t] ?? 0) + 1;
            return acc;
        }, {});
        const versionBucketsRuntime = runtimeRisks.reduce((acc, r) => {
            const installed = r.dependency.version;
            const latest = r.dependency.meta.latestVersion;
            if (!latest) {
                acc.unknown += 1;
            }
            else {
                const installedNormalized = normalizeVersion(installed);
                const latestNormalized = normalizeVersion(latest);
                if (installedNormalized === latestNormalized) {
                    acc.upToDate += 1;
                }
                else {
                    acc.outdated += 1;
                }
            }
            return acc;
        }, { upToDate: 0, outdated: 0, unknown: 0 });
        const versionBucketsDev = devRisks.reduce((acc, r) => {
            const installed = r.dependency.version;
            const latest = r.dependency.meta.latestVersion;
            if (!latest) {
                acc.unknown += 1;
            }
            else {
                const installedNormalized = normalizeVersion(installed);
                const latestNormalized = normalizeVersion(latest);
                if (installedNormalized === latestNormalized) {
                    acc.upToDate += 1;
                }
                else {
                    acc.outdated += 1;
                }
            }
            return acc;
        }, { upToDate: 0, outdated: 0, unknown: 0 });
        const pctRuntime = (count) => totalRuntime > 0 ? Math.round((count / totalRuntime) * 100) : 0;
        const pctDev = (count) => totalDev > 0 ? Math.round((count / totalDev) * 100) : 0;
        const formatDate = (iso) => {
            if (!iso) {
                return "-";
            }
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) {
                return "-";
            }
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const yyyy = d.getFullYear();
            return `${mm}/${dd}/${yyyy}`;
        };
        const renderRows = (list) => list.map((r) => {
            const d = r.dependency;
            const latest = d.meta.latestVersion ?? "-";
            const lastUpdated = formatDate(d.meta.lastUpdatedAt);
            const installedUpdated = formatDate(d.meta.installedLastUpdatedAt);
            // Verificar se tem versão mais recente disponível
            // Remove prefixos (^, ~, etc.) e compara apenas os números de versão
            const installedNormalized = normalizeVersion(d.version);
            const latestNormalized = latest !== "-" ? normalizeVersion(latest) : null;
            const hasNewerVersion = latestNormalized !== null && installedNormalized !== latestNormalized;
            // Verificar se não tem data de atualização
            const hasNoUpdateDate = d.meta.lastUpdatedAt == null;
            const isDeprecated = Boolean(d.meta.deprecated);
            const rulesText = r.triggeredRules.map((rr) => `• ${rr.message}`).join("\n") ||
                "No specific rule — low or unknown risk.";
            const libraryRisk = r.libraryRiskLevel ?? r.riskLevel;
            const projectRisk = r.projectRiskLevel ?? r.riskLevel;
            const riskToClass = (risk) => risk === "high" ? "badge-high" : risk === "medium" ? "badge-medium" : "badge-low";
            // Classes para destacar a linha
            const rowClasses = [];
            if (hasNoUpdateDate) {
                rowClasses.push("row-no-update-date");
            }
            if (hasNewerVersion) {
                rowClasses.push("row-outdated-version");
            }
            if (isDeprecated) {
                rowClasses.push("row-deprecated");
            }
            const npmUrl = `https://www.npmjs.com/package/${encodeURIComponent(d.name)}`;
            const versionDiff = d.meta.missedVersionsCount != null && d.meta.missedVersionsCount > 0
                ? d.meta.missedVersionsCount.toString()
                : "-";
            // Escapar HTML para usar no atributo title (tooltip)
            const escapeHtml = (text) => {
                return text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#39;");
            };
            const tooltipText = escapeHtml(rulesText);
            return `
          <tr class="${rowClasses.join(" ")}">
            <td><a href="${npmUrl}" target="_blank" rel="noopener noreferrer"><code>${d.name}</code></a>${isDeprecated ? ' <span class="deprecated-badge">DEPRECATED</span>' : ''}</td>
            <td>${installedUpdated === "-" ? d.version : `${d.version} - ${installedUpdated}`}</td>
            <td>${latest}${hasNewerVersion ? ' <span class="update-badge">New version available</span>' : ''}</td>
            <td>${versionDiff}</td>
            <td>${d.type}</td>
            <td title="${tooltipText}">
              <span class="badge ${riskToClass(libraryRisk)}">LIB ${libraryRisk.toUpperCase()}</span>
            </td>
            <td title="${tooltipText}">
              <span class="badge ${riskToClass(projectRisk)}">PROJECT ${projectRisk.toUpperCase()}</span>
            </td>
            <td>${hasNoUpdateDate ? '<span class="no-date-warning">⚠️ Check manually</span>' : lastUpdated}</td>
          </tr>
        `;
        }).join("");
        const runtimeRows = renderRows(runtimeRisks);
        const devRows = renderRows(devRisks);
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", sans-serif;
      padding: 16px;
    }
    .dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .card {
      border-radius: 8px;
      border: 1px solid rgba(128, 128, 128, 0.4);
      padding: 16px;
      background: rgba(0, 0, 0, 0.2);
    }
    .card h3 {
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 14px;
      font-weight: 600;
    }
    .chart-container-horizontal {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
    }
    .chart-container-types {
      display: flex;
      flex-direction: row;
      gap: 12px;
      margin-top: 12px;
    }
    .chart-container-types .section-group {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .section-group {
      padding: 6px 8px;
      border-radius: 6px;
    }
    .section-group.dev {
      background: rgba(0, 172, 193, 0.12);
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      opacity: 0.85;
    }
    .bar-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .bar-label {
      width: 80px;
      flex-shrink: 0;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
    }
    .bar-track {
      flex: 1;
      height: 14px;
      background: rgba(128, 128, 128, 0.25);
      border-radius: 999px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.3s ease;
      min-width: 0;
    }
    .bar-value {
      width: 28px;
      text-align: right;
      font-size: 12px;
      font-weight: 600;
    }
    .donut-chart {
      width: 120px;
      height: 120px;
      position: relative;
      margin: 0 auto;
    }
    .chart-container-types .donut-chart {
      width: 100px;
      height: 100px;
    }
    .donut-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    .donut-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    .donut-center-value {
      font-size: 24px;
      font-weight: 700;
    }
    .chart-container-types .donut-center-value {
      font-size: 20px;
    }
    .donut-center-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
    }
    .chart-container-types .donut-center-label {
      font-size: 11px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .badge-high {
      background-color: #ff6b6b;
      color: #fff;
    }
    .badge-medium {
      background-color: #ffd166;
      color: #1a1a1a;
    }
    .badge-low {
      background-color: #4caf50;
      color: #fff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      border-bottom: 1px solid rgba(128, 128, 128, 0.3);
      padding: 8px 10px;
      vertical-align: middle;
      font-size: 13px;
    }
    th {
      text-align: left;
      font-weight: 600;
      position: sticky;
      top: 0;
      background-color: #1e1e1e;
      z-index: 1;
    }
    tr:nth-child(even) {
      background: rgba(128, 128, 128, 0.08);
    }
    .row-no-update-date {
      border-left: 3px solid #ff9800;
      background: rgba(255, 152, 0, 0.1) !important;
    }
    .row-outdated-version {
      border-left: 3px solid #2196f3;
      background: rgba(33, 150, 243, 0.1) !important;
    }
    .row-deprecated {
      border-left: 3px solid #ff6b6b;
      background: rgba(255, 107, 107, 0.12) !important;
    }
    .row-no-update-date.row-outdated-version {
      border-left: 3px solid #ff9800;
      background: linear-gradient(to right, rgba(255, 152, 0, 0.1), rgba(33, 150, 243, 0.1)) !important;
    }
    .update-badge {
      display: inline-block;
      padding: 2px 6px;
      background: #2196f3;
      color: #fff;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      margin-left: 6px;
      white-space: nowrap;
    }
    .no-date-warning {
      color: #ff9800;
      font-weight: 600;
      font-size: 12px;
    }
    .deprecated-badge {
      display: inline-block;
      padding: 2px 6px;
      background: #ff6b6b;
      color: #fff;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      margin-left: 6px;
      white-space: nowrap;
    }
    .dev-separator td {
      font-weight: 600;
      padding-top: 16px;
      border-top: 2px solid rgba(128, 128, 128, 0.6);
    }
    .settings-button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      margin-left: 12px;
      background: rgba(128, 128, 128, 0.2);
      border: 1px solid rgba(128, 128, 128, 0.4);
      border-radius: 4px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 12px;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s;
    }
    .settings-button:hover {
      background: rgba(128, 128, 128, 0.3);
    }
    .settings-button:active {
      background: rgba(128, 128, 128, 0.4);
    }
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .header-left {
      display: flex;
      align-items: center;
    }
  </style>
</head>
<body>
  <div class="header-row">
    <div class="header-left">
      <h2 style="margin: 0;">📡 RN Dependency Radar</h2>
      <button class="settings-button" onclick="openSettings()">
        ⚙️ Settings
      </button>
    </div>
  </div>
  <p>Overview of runtime and development dependencies analyzed in this project. Each chart shows runtime on the first row and dev dependencies on the second row.</p>

  <section class="dashboard">
    <div class="card">
      <h3>Risk Distribution</h3>
      <div class="chart-container-horizontal">
        <div class="section-group">
          <div class="section-title">Runtime Dependencies</div>
          <div class="bar-row">
            <div class="bar-label">High</div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pctRuntime(byRiskRuntime["high"] ?? 0)}%; background: linear-gradient(to right, #ff6b6b, #ff8787);"></div>
            </div>
            <div class="bar-value" style="color: #ff6b6b;">${byRiskRuntime["high"] ?? 0}</div>
          </div>
          <div class="bar-row">
            <div class="bar-label">Medium</div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pctRuntime(byRiskRuntime["medium"] ?? 0)}%; background: linear-gradient(to right, #ffd166, #ffe082);"></div>
            </div>
            <div class="bar-value" style="color: #ffd166;">${byRiskRuntime["medium"] ?? 0}</div>
          </div>
          <div class="bar-row">
            <div class="bar-label">Low</div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pctRuntime(byRiskRuntime["low"] ?? 0)}%; background: linear-gradient(to right, #4caf50, #66bb6a);"></div>
            </div>
            <div class="bar-value" style="color: #4caf50;">${byRiskRuntime["low"] ?? 0}</div>
          </div>
        </div>
        <div class="section-group dev">
          <div class="section-title">Dev Dependencies</div>
          <div class="bar-row">
            <div class="bar-label">High</div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pctDev(byRiskDev["high"] ?? 0)}%; background: linear-gradient(to right, #ff6b6b, #ff8787);"></div>
            </div>
            <div class="bar-value" style="color: #ff6b6b;">${byRiskDev["high"] ?? 0}</div>
          </div>
          <div class="bar-row">
            <div class="bar-label">Medium</div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pctDev(byRiskDev["medium"] ?? 0)}%; background: linear-gradient(to right, #ffd166, #ffe082);"></div>
            </div>
            <div class="bar-value" style="color: #ffd166;">${byRiskDev["medium"] ?? 0}</div>
          </div>
          <div class="bar-row">
            <div class="bar-label">Low</div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pctDev(byRiskDev["low"] ?? 0)}%; background: linear-gradient(to right, #4caf50, #66bb6a);"></div>
            </div>
            <div class="bar-value" style="color: #4caf50;">${byRiskDev["low"] ?? 0}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Dependency Types</h3>
      <div class="chart-container-types">
        <div class="section-group">
          <div class="section-title">Runtime Dependencies</div>
          <div class="donut-chart">
            <svg class="donut-svg" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(128, 128, 128, 0.2)" stroke-width="20"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#007acc" stroke-width="20" 
                stroke-dasharray="${(byTypeRuntime["native"] ?? 0) * 314 / Math.max(totalRuntime, 1)} ${314}"
                stroke-dashoffset="0"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#4caf50" stroke-width="20" 
                stroke-dasharray="${(byTypeRuntime["js"] ?? 0) * 314 / Math.max(totalRuntime, 1)} ${314}"
                stroke-dashoffset="${-((byTypeRuntime["native"] ?? 0) * 314 / Math.max(totalRuntime, 1))}"/>
            </svg>
            <div class="donut-center">
              <div class="donut-center-value">${totalRuntime}</div>
              <div class="donut-center-label">Runtime</div>
            </div>
          </div>
          <div style="margin-top: 12px; text-align: center; font-size: 12px;">
            <div style="margin-bottom: 4px;"><span style="color: #007acc;">●</span> Native: ${byTypeRuntime["native"] ?? 0}</div>
            <div><span style="color: #4caf50;">●</span> Pure JS: ${byTypeRuntime["js"] ?? 0}</div>
          </div>
        </div>
        <div class="section-group dev">
          <div class="section-title">Dev Dependencies</div>
          <div class="donut-chart">
            <svg class="donut-svg" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(128, 128, 128, 0.2)" stroke-width="20"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#007acc" stroke-width="20" 
                stroke-dasharray="${(byTypeDev["native"] ?? 0) * 314 / Math.max(totalDev, 1)} ${314}"
                stroke-dashoffset="0"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#4caf50" stroke-width="20" 
                stroke-dasharray="${(byTypeDev["js"] ?? 0) * 314 / Math.max(totalDev, 1)} ${314}"
                stroke-dashoffset="${-((byTypeDev["native"] ?? 0) * 314 / Math.max(totalDev, 1))}"/>
            </svg>
            <div class="donut-center">
              <div class="donut-center-value">${totalDev}</div>
              <div class="donut-center-label">Dev</div>
            </div>
          </div>
          <div style="margin-top: 12px; text-align: center; font-size: 12px;">
            <div style="margin-bottom: 4px;"><span style="color: #007acc;">●</span> Native: ${byTypeDev["native"] ?? 0}</div>
            <div><span style="color: #4caf50;">●</span> Pure JS: ${byTypeDev["js"] ?? 0}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Version Status</h3>
      <div class="chart-container-horizontal">
        <div class="section-group">
          <div class="section-title">Runtime Dependencies</div>
          <div class="bar-row">
            <div class="bar-label">Up to date</div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pctRuntime(versionBucketsRuntime.upToDate)}%; background: linear-gradient(to right, #4caf50, #66bb6a);"></div>
            </div>
            <div class="bar-value" style="color: #4caf50;">${versionBucketsRuntime.upToDate}</div>
          </div>
          <div class="bar-row">
            <div class="bar-label">Outdated</div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pctRuntime(versionBucketsRuntime.outdated)}%; background: linear-gradient(to right, #ff9800, #ffb74d);"></div>
            </div>
            <div class="bar-value" style="color: #ff9800;">${versionBucketsRuntime.outdated}</div>
          </div>
          <div class="bar-row">
            <div class="bar-label">Unknown</div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pctRuntime(versionBucketsRuntime.unknown)}%; background: linear-gradient(to right, #9e9e9e, #bdbdbd);"></div>
            </div>
            <div class="bar-value" style="color: #9e9e9e;">${versionBucketsRuntime.unknown}</div>
          </div>
        </div>
        <div class="section-group dev">
          <div class="section-title">Dev Dependencies</div>
          <div class="bar-row">
            <div class="bar-label">Up to date</div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pctDev(versionBucketsDev.upToDate)}%; background: linear-gradient(to right, #4caf50, #66bb6a);"></div>
            </div>
            <div class="bar-value" style="color: #4caf50;">${versionBucketsDev.upToDate}</div>
          </div>
          <div class="bar-row">
            <div class="bar-label">Outdated</div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pctDev(versionBucketsDev.outdated)}%; background: linear-gradient(to right, #ff9800, #ffb74d);"></div>
            </div>
            <div class="bar-value" style="color: #ff9800;">${versionBucketsDev.outdated}</div>
          </div>
          <div class="bar-row">
            <div class="bar-label">Unknown</div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pctDev(versionBucketsDev.unknown)}%; background: linear-gradient(to right, #9e9e9e, #bdbdbd);"></div>
            </div>
            <div class="bar-value" style="color: #9e9e9e;">${versionBucketsDev.unknown}</div>
          </div>
        </div>
      </div>
    </div>
  </section>
  <table>
    <thead>
      <tr>
        <th title="Package name (click to open npm page)"><span>Dependency</span></th>
        <th title="Version currently used in this project and its release date"><span>Installed Version</span></th>
        <th title="Latest version published on npm"><span>Latest Version</span></th>
        <th title="How many versions exist between the installed and latest versions"><span>Version diff</span></th>
        <th title="Library type: native module or pure JavaScript"><span>Type</span></th>
        <th title="Risk of the library itself considering the latest version available (hover to see justification)"><span>Lib Risk</span></th>
        <th title="Risk of the specific version installed in this project (hover to see justification)"><span>Project Risk</span></th>
        <th title="Release date of the latest version on npm (MM/DD/YYYY)"><span>Last Update</span></th>
      </tr>
    </thead>
    <tbody>
      ${runtimeRows ||
            "<tr><td colspan='8'>No runtime dependencies analyzed.</td></tr>"}
      ${devRisks.length > 0
            ? `
        <tr class="dev-separator">
          <td colspan="8">Dev dependencies (from devDependencies)</td>
        </tr>
        ${devRows}
      `
            : ""}
    </tbody>
  </table>
  <script>
    const vscode = acquireVsCodeApi();
    function openSettings() {
      vscode.postMessage({
        command: 'openSettings'
      });
    }
  </script>
</body>
</html>`;
    }
    renderLoading() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", sans-serif;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(128, 128, 128, 0.3);
      border-top-color: #007acc;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .loading-text {
      color: rgba(255, 255, 255, 0.7);
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <div class="loading-text">Analyzing dependencies...</div>
  <div class="loading-text" style="font-size: 12px; margin-top: 8px;">This may take a few seconds</div>
</body>
</html>`;
    }
}
exports.RadarWebview = RadarWebview;
//# sourceMappingURL=webview.js.map