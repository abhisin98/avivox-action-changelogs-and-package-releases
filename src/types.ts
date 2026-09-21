// Type definitions for the GitHub Action

/** Supported release strategies for version bumping */
export type ReleaseType = "auto" | "major" | "minor" | "patch" | "beta" | "canary";

/** Represents a package that was updated during this action run */
export interface UpdatedPackage {
  dir: string; // Relative path to package directory
}

/** Parsed and validated action inputs */
export interface ActionInputs {
  releaseType: ReleaseType;
  prNumber: string;
  headSha: string;
  commitAndPush: boolean;
  createRelease: boolean;
  commitMessage: string;
  githubToken: string;
  publishPackages: boolean;
  packageManager: "pnpm" | "npm" | "yarn";
  packageAccess: "public" | "restricted";
  publishPackageTag: string;
  publishExtraArgs: string;
}

/** Represents a package.json file and its metadata */
export interface PackageJson {
  name?: string;
  version: string;
  private?: boolean;
  [key: string]: unknown;
}

/** Result of version bump detection and application */
export interface VersionBumpResult {
  packageDir: string;
  packageName: string;
  currentVersion: string;
  newVersion: string;
  changelogPath: string;
}
