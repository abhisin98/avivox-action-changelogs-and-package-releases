// Parse and validate GitHub Action inputs

import * as core from "@actions/core";

import { ActionInputs, ReleaseType } from "./types";

/**
 * Parses and validates all action inputs from the GitHub Actions context.
 * Applies defaults and normalizes values according to the action specification.
 */
export function parseInputs(): ActionInputs {
  // Read release-type and normalize to lowercase
  const releaseTypeRaw = core.getInput("release-type") || "auto";
  const releaseType = releaseTypeRaw.toLowerCase();

  // Validate release type against allowed values
  const validReleaseTypes: ReleaseType[] = ["auto", "major", "minor", "patch", "beta", "canary"];
  if (!validReleaseTypes.includes(releaseType as ReleaseType)) {
    throw new Error(`Invalid release-type: ${releaseType}. Must be one of: ${validReleaseTypes.join(", ")}`);
  }

  // Validate package manager against allowed values
  const packageManager = core.getInput("package-manager").toLowerCase();
  const validPackageManagers = ["pnpm", "npm", "yarn"];
  if (!validPackageManagers.includes(packageManager)) {
    throw new Error(`Invalid package-manager: ${packageManager}. Must be one of: ${validPackageManagers.join(", ")}`);
  }

  // Validate package access level against allowed values
  const packageAccess = core.getInput("package-access");
  const validAccessLevels = ["public", "restricted"];
  if (!validAccessLevels.includes(packageAccess)) {
    throw new Error(`Invalid package-access: ${packageAccess}. Must be one of: ${validAccessLevels.join(", ")}`);
  }

  // Build parsed inputs object from all action inputs
  const inputs: ActionInputs = {
    releaseType: releaseType as ReleaseType,
    prNumber: core.getInput("pr-number") || "",
    headSha: core.getInput("head-sha") || "",
    commitAndPush: core.getBooleanInput("commit-and-push"),
    createRelease: core.getBooleanInput("create-release"),
    commitMessage: core.getInput("commit-message"),
    githubToken: core.getInput("github-token"),
    publishPackages: core.getBooleanInput("publish-packages"),
    packageManager: packageManager as "pnpm" | "npm" | "yarn",
    packageAccess: packageAccess as "public" | "restricted",
    publishPackageTag: core.getInput("publish-package-tag"),
    publishExtraArgs: core.getInput("publish-extra-args"),
  };

  return inputs;
}
