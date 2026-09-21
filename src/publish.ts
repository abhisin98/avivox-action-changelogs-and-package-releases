// Package publishing to npm registry

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as path from "path";

import { UpdatedPackage } from "./types";
import { readPackageJson } from "./utils";

/**
 * Publishes updated packages to the npm registry.
 * Skips private packages and applies appropriate distribution tags based on version type.
 * Only publishes public packages (not marked as private in package.json).
 *
 * @param packages - Array of packages that were updated
 * @param packageManager - Package manager to use ('pnpm', 'npm', or 'yarn')
 * @param packageAccess - Access level for packages ('public' or 'restricted')
 * @param publishPackageTag - Custom distribution tag (e.g., 'latest', 'beta', 'canary')
 *                           If empty, auto-detected from version string
 * @param publishExtraArgs - Additional arguments to pass to the publish command
 */
export async function publishPackages(
  packages: UpdatedPackage[],
  packageManager: "pnpm" | "npm" | "yarn",
  packageAccess: "public" | "restricted",
  publishPackageTag: string = "",
  publishExtraArgs: string = ""
): Promise<void> {
  if (!packages.length) {
    core.info("No packages to publish");
    return;
  }

  core.info(`Publishing packages using ${packageManager}...`);

  for (const pkg of packages) {
    const packageJsonFile = path.join(pkg.dir, "package.json");

    // Read package.json to get metadata and check if private
    const packageJson = readPackageJson(packageJsonFile);
    if (!packageJson || !packageJson.name || !packageJson.version) {
      core.warning(`Failed to read package info from ${packageJsonFile}`);
      continue;
    }

    const packageName = String(packageJson.name);
    const packageVersion = String(packageJson.version);
    const isPrivate = Boolean(packageJson.private);

    // Skip private packages
    if (isPrivate) {
      core.info(`Skipping private package: ${packageName}`);
      continue;
    }

    // Determine the distribution tag to use
    let distTag = publishPackageTag;

    // If no custom tag provided, auto-detect from version string
    if (!distTag) {
      if (packageVersion.includes("-beta.")) {
        // Beta versions get 'beta' tag by default
        distTag = "beta";
      } else if (packageVersion.includes("-canary.")) {
        // Canary versions get 'canary' tag by default
        distTag = "canary";
      } else {
        // Stable versions get 'latest' tag by default
        distTag = "latest";
      }
    }

    core.info(`Publishing ${packageName}@${packageVersion} with tag: ${distTag}`);

    // Build the publish command based on package manager
    const publishCommand: string[] = [];

    switch (packageManager) {
      case "pnpm":
        publishCommand.push("pnpm", "publish", "--no-git-checks");
        break;
      case "npm":
        publishCommand.push("npm", "publish");
        break;
      case "yarn":
        publishCommand.push("yarn", "npm", "publish");
        break;
    }

    // Add access level flag
    publishCommand.push("--access", packageAccess);

    // Add distribution tag
    publishCommand.push("--tag", distTag);

    // Parse and add any extra arguments from the user
    if (publishExtraArgs) {
      const extraArgs = publishExtraArgs.split(/\s+/);
      publishCommand.push(...extraArgs);
    }

    // Execute the publish command in the package directory
    try {
      await exec.exec(publishCommand[0] ?? "", publishCommand.slice(1), {
        cwd: pkg.dir,
      });
      core.info(`Published ${packageName}@${packageVersion}`);
    } catch (error) {
      core.setFailed(`Failed to publish ${packageName}@${packageVersion}: ${String(error)}`);
      throw error;
    }
  }
}
