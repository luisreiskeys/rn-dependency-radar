## RN Dependency Radar

React Native & Expo Dependency Health Monitor for VS Code.

Created by [Luis Reis](https://github.com/luisreiskeys).

---

### What is this extension?

**RN Dependency Radar** is a VS Code extension that scans your React Native and Expo projects and gives you a clear dashboard of your dependencies:

- Which libraries are **up to date** and which are **outdated**.
- Which ones have **native code** vs **pure JavaScript**.
- How many versions you are **behind** the latest release.
- Which libraries are **deprecated** or show signs of poor maintenance.
- Separate **Library Risk** (health of the library in npm) and **Project Risk** (your installed version).

It is designed to help you make better decisions about upgrades and library choices, without blocking your development flow.

---

### Features

- **Automatic project detection**
  - Detects React Native CLI, Expo Managed and Expo Bare projects.
  - Activates when it finds `package.json`, `app.json` or `app.config.js`.

- **Dependency scan with npm metadata**
  - Reads `dependencies` and `devDependencies` from `package.json`.
  - Fetches metadata from npm (latest version, release dates, version history, deprecated status).
  - Calculates:
    - Installed version release date.
    - Number of versions between installed and latest (**Version diff**).
    - Months since last update for the installed version.

- **Risk engine for React Native / Expo**
  - Opinionated rules in `rules/rn-default-rules.json` focused on RN/Expo.
  - Separate metrics:
    - **Lib Risk** – risk of the library itself (latest version).
    - **Project Risk** – risk of the version installed in your project.
  - Rules cover:
    - Native modules without recent maintenance.
    - Many missed versions between installed and latest.
    - Deprecated libraries (with clear highlight and justification).

- **Dashboard webview**
  - **Charts**:
    - Risk distribution (High / Medium / Low).
    - Dependency types (Native vs Pure JS).
    - Version status (Up to date / Outdated / Unknown).
  - **Detailed table** with:
    - Dependency name (clickable link to npm).
    - Installed version + release date.
    - Latest version.
    - Version diff (how many versions behind).
    - Type (native / js).
    - Lib Risk & Project Risk badges.
    - Last update date.
    - Justification text and warnings (e.g. “Deprecated — migrate to suggested alternative”).

- **Status bar integration**
  - Status item with a quick overview:
    - `📡 RN Radar: ok` when no critical issues.
    - `📡 RN Radar: 3 criticals` when high‑risk dependencies are found.
  - Clicking the status item opens the dashboard webview.

- **Smart notifications**
  - Single summary notification with the number of high‑risk dependencies.
  - “View details” opens the dashboard.

- **Caching & performance**
  - Results cached per project.
  - Re-scan is triggered only when `package.json` (or lockfiles) change.

---

### Installation

Install **RN Dependency Radar** directly from the VS Code Marketplace:

**[📦 Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=luisreisdev.rn-dependency-radar)**

Or manually:
1. Open VS Code
2. Go to **Extensions** (Cmd+Shift+X / Ctrl+Shift+X)
3. Search for **"RN Dependency Radar"**
4. Click **Install**

Or use the Command Palette:
- Press **Cmd+Shift+P** (Mac) or **Ctrl+Shift+P** (Windows/Linux)
- Type **"Extensions: Install Extensions"**
- Search for **"RN Dependency Radar"**

---

### How to use

1. Open a React Native or Expo project in VS Code.
2. The extension activates automatically when it detects:
   - `package.json`, and optionally
   - `app.json` or `app.config.js`.
3. On startup (if enabled) it runs an initial scan of your dependencies.
4. Watch the **status bar**:
   - If there are issues, it shows the number of critical dependencies.
   - Click it to open the **Dependency Radar** dashboard.
5. In the dashboard:
   - Use the charts for a quick overview.
   - Scroll the table to inspect each dependency, links, risks, and justifications.

---

### Extension settings

You can configure RN Dependency Radar under **Settings → Extensions → RN Dependency Radar**:

- **`rnDependencyRadar.scanOnStartup`**
  - Type: `boolean`
  - Default: `true`
  - Description: Run an initial dependency scan when opening a React Native or Expo project.

- **`rnDependencyRadar.alertLevel`**
  - Type: `string`
  - Values: `"high" | "medium" | "low"`
  - Default: `"high"`
  - Description: Minimum risk severity level to display immediate alerts.

- **`rnDependencyRadar.ignore`**
  - Type: `string[]`
  - Default: `[]`
  - Description: List of dependencies to be ignored by RN Dependency Radar in this workspace.

- **`rnDependencyRadar.riskThresholds.installedVersionAgeMonths`**
  - Type: `object`
  - Default: `{ "high": 36, "medium": 18 }`
  - Description: Thresholds (in months) for installed version age to trigger risk levels. Versions older than `high` months get HIGH risk, older than `medium` months get MEDIUM risk.

- **`rnDependencyRadar.riskThresholds.missedVersionsCount`**
  - Type: `object`
  - Default: `{ "high": 50, "medium": 10 }`
  - Description: Thresholds for number of missed versions to trigger risk levels. More than `high` versions get HIGH risk, more than `medium` versions get MEDIUM risk.

- **`rnDependencyRadar.riskThresholds.libraryLastUpdateMonths`**
  - Type: `object`
  - Default: `{ "high": 24, "medium": 12 }`
  - Description: Thresholds (in months) for library's last update to trigger risk levels. Libraries not updated in more than `high` months get HIGH risk, more than `medium` months get MEDIUM risk.

**Note:** Changes to risk thresholds are applied immediately without requiring a new scan. The dashboard and status bar update automatically.

---

### License

MIT License – see `LICENSE` file.