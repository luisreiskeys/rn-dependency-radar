import * as fs from "fs";
import * as path from "path";
import { ProjectInfo, ProjectType } from "../models/project";

export class ProjectDetector {
  constructor(private readonly workspaceRoot: string) {}

  async detect(): Promise<ProjectInfo | null> {
    const packageJsonPath = path.join(this.workspaceRoot, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const deps = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {})
    } as Record<string, string>;

    const hasReactNative = "react-native" in deps;
    const hasExpo = "expo" in deps;

    if (!hasReactNative && !hasExpo) {
      return null;
    }

    const type = this.inferProjectType(hasReactNative, hasExpo);

    return {
      rootPath: this.workspaceRoot,
      type,
      hasExpo,
      hasReactNative
    };
  }

  private inferProjectType(hasReactNative: boolean, hasExpo: boolean): ProjectType {
    const appJsonPath = path.join(this.workspaceRoot, "app.json");
    const appConfigJsPath = path.join(this.workspaceRoot, "app.config.js");
    const hasExpoConfig = fs.existsSync(appJsonPath) || fs.existsSync(appConfigJsPath);

    if (hasExpo && hasExpoConfig && !hasReactNative) {
      return "expo-managed";
    }

    if (hasExpo && hasReactNative) {
      return hasExpoConfig ? "expo-managed" : "expo-bare";
    }

    return "react-native-cli";
  }
}

