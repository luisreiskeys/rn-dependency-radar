export type ProjectType = "react-native-cli" | "expo-managed" | "expo-bare";

export interface ProjectInfo {
  rootPath: string;
  type: ProjectType;
  hasExpo: boolean;
  hasReactNative: boolean;
}

