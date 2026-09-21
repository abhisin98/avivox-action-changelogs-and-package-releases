// Changelog generation and version bump detection using git-cliff

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as path from "path";

import { ReleaseType, UpdatedPackage } from "./types";
import { parseVersion, readPackageJson, writePackageJson } from "./utils";

/**
 * Finds all package.json files in the repository, excluding node_modules.
 * Uses find command for consistency with the original shell script.
 *
 * @returns Array of relative paths to package.json files
 */
async function findPackageJsonFiles(): Promise<string[]> {
  // Use find to search for package.json files, excluding node_modules directories
  let output = "";
  await exec.exec("find", [".", "-name", "node_modules", "-prune", "-o", "-name", "package.json", "-print"], {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
  });

  // Parse find output: each line is a file path, filter out empty lines and node_modules
  const packageFiles = output
    .split("\n")
    .filter((line) => line.trim() && line.includes("package.json") && !line.includes("node_modules"))
    .map((line) => line.trim());

  return packageFiles;
}

/**
 * Detects if git tags exist for a package using the conventional tag pattern.
 * Tag pattern: <package-name>@X.Y.Z (e.g., "my-package@1.2.3")
 *
 * @param packageName - The name of the package
 * @returns true if tags exist for this package, false otherwise
 */
async function packageHasVersionTags(packageName: string): Promise<boolean> {
  let output = "";

  // List all tags matching the package name pattern
  try {
    await exec.exec("git", ["tag", "--list", `${packageName}@*`], {
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
      },
      ignoreReturnCode: true,
    });
  } catch {
    return false;
  }

  // Check if any tags match the semver pattern (e.g., package@1.2.3)
  const semverRegex = new RegExp(`^${packageName}@\\d+\\.\\d+\\.\\d+$`, "m");
  return semverRegex.test(output);
}

/**
 * Runs git-cliff to generate a changelog and get the suggested next version.
 * If tags exist for this package, uses a tag pattern to scope the changelog.
 *
 * @param packageDir - Relative path to the package directory
 * @param packageName - The package name (for tag pattern matching)
 * @returns Object with suggested version and any git-cliff errors
 */
async function runGitCliff(packageDir: string, packageName: string): Promise<{ version: string; error?: string }> {
  // Construct git-cliff CLI arguments
  const args: string[] = [];

  // If tags exist for this package, add tag pattern to scope changelog to this package only
  const hasTags = await packageHasVersionTags(packageName);
  if (hasTags) {
    args.push("--tag-pattern");
    // Pattern matches: package-name@X.Y.Z
    args.push(`^${packageName}@[0-9]+\\.[0-9]+\\.[0-9]+$`);
  }

  // Add the bump flag to calculate next version
  args.push("--bump");

  // Specify output file for the changelog
  args.push("-o", path.join(packageDir, "CHANGELOG.md"));

  // let output = "";
  let errorOutput = "";

  // Run git-cliff with the constructed arguments
  try {
    await exec.exec("git-cliff", args, {
      cwd: packageDir,
      listeners: {
        stdout: (_data: Buffer) => {
          // output += data.toString();
        },
        stderr: (data: Buffer) => {
          errorOutput += data.toString();
        },
      },
      ignoreReturnCode: false,
    });
  } catch (error) {
    return { version: "", error: `git-cliff failed: ${errorOutput || String(error)}` };
  }

  // Now run git-cliff again to get the bumped version
  const versionArgs: string[] = [...args];
  // Replace the -o flag with --bumped-version
  const outputIndex = versionArgs.indexOf("-o");
  if (outputIndex >= 0) {
    versionArgs.splice(outputIndex, 2); // Remove -o and the filename
  }
  versionArgs.push("--bumped-version");

  let versionOutput = "";
  try {
    await exec.exec("git-cliff", versionArgs, {
      cwd: packageDir,
      listeners: {
        stdout: (data: Buffer) => {
          versionOutput += data.toString();
        },
        stderr: (data: Buffer) => {
          errorOutput += data.toString();
        },
      },
      ignoreReturnCode: false,
    });
  } catch (error) {
    return { version: "", error: `git-cliff --bumped-version failed: ${errorOutput || String(error)}` };
  }

  // Extract version from output, removing any carriage returns or newlines
  const suggestedVersion = versionOutput.replace(/[\r\n]/g, "").trim();

  // git-cliff outputs package@version, extract the version part after the last @
  const versionPart = suggestedVersion.includes("@") ? suggestedVersion.split("@").pop() || "" : suggestedVersion;

  return { version: versionPart };
}

/**
 * Calculates the new version based on the release type and suggested version.
 * Handles auto-detection, semantic versioning (major/minor/patch),
 * and prerelease versioning (beta/canary).
 *
 * @param releaseType - The release strategy selected
 * @param suggestedVersion - Version suggested by git-cliff
 * @param currentVersion - Current version from package.json
 * @param headSha - Full commit SHA for prerelease metadata
 * @param prNumber - PR number for prerelease metadata
 * @returns The new version string to apply
 */
export function calculateNewVersion(releaseType: ReleaseType, suggestedVersion: string, currentVersion: string, headSha: string = "", prNumber: string = ""): string {
  switch (releaseType) {
    case "canary": {
      // Canary version: <suggested>-canary.<short-sha>.<timestamp>
      const shortSha = headSha.substring(0, 7); // Shorten SHA to 7 chars (standard practice)
      const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp for uniqueness
      return `${suggestedVersion}-canary.${shortSha}.${timestamp}`;
    }

    case "beta": {
      // Beta version: <suggested>-beta.<pr>.<short-sha>.<timestamp>
      const shortSha = headSha.substring(0, 7); // Shorten SHA to 7 chars (standard practice)
      const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp for uniqueness
      return `${suggestedVersion}-beta.${prNumber}.${shortSha}.${timestamp}`;
    }

    case "patch": {
      // Patch: increment patch component only (major.minor.patch+1)
      const parsed = parseVersion(currentVersion);
      if (!parsed) {
        throw new Error(`Cannot parse current version: ${currentVersion}`);
      }
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    }

    case "minor": {
      // Minor: increment minor component, reset patch to 0 (major.minor+1.0)
      const parsed = parseVersion(currentVersion);
      if (!parsed) {
        throw new Error(`Cannot parse current version: ${currentVersion}`);
      }
      return `${parsed.major}.${parsed.minor + 1}.0`;
    }

    case "major": {
      // Major: increment major component, reset minor and patch (major+1.0.0)
      const parsed = parseVersion(currentVersion);
      if (!parsed) {
        throw new Error(`Cannot parse current version: ${currentVersion}`);
      }
      return `${parsed.major + 1}.0.0`;
    }

    case "auto":
    default: {
      // Auto: use git-cliff's suggested version as-is
      return suggestedVersion;
    }
  }
}

/**
 * Processes all packages in the repository: generates changelogs and bumps versions.
 * Respects the release-type strategy and only updates packages where version changes.
 *
 * @param releaseType - The release strategy selected
 * @param headSha - Full commit SHA for prerelease metadata
 * @param prNumber - PR number for prerelease metadata
 * @returns Array of packages that were actually updated with new versions
 */
export async function generateChangelogsAndBumpVersions(releaseType: ReleaseType, headSha: string = "", prNumber: string = ""): Promise<UpdatedPackage[]> {
  core.info("Generating changelogs and bumping package versions...");

  const updatedPackages: UpdatedPackage[] = [];

  // Find all package.json files in the monorepo
  const packageFiles = await findPackageJsonFiles();

  if (packageFiles.length === 0) {
    core.warning("No package.json files found");
    return [];
  }

  core.debug(`Found ${packageFiles.length} package.json files`);

  // Process each package
  for (const packageFile of packageFiles) {
    const packageDir = path.dirname(packageFile);

    // Read current package.json to extract metadata
    const packageJson = readPackageJson(packageFile);

    if (!packageJson || !packageJson.name || !packageJson.version) {
      core.debug(`Skipping invalid package: ${packageFile}`);
      continue;
    }

    const packageName = String(packageJson.name);
    const currentVersion = String(packageJson.version);

    core.debug(`Processing package: ${packageName}@${currentVersion}`);

    // Run git-cliff to generate changelog and detect version bump
    const cliffResult = await runGitCliff(packageDir, packageName);

    if (cliffResult.error) {
      core.warning(`Failed to run git-cliff for ${packageName}: ${cliffResult.error}`);
      continue;
    }

    const suggestedVersion = cliffResult.version;

    // Only proceed if version actually changes
    if (suggestedVersion === currentVersion) {
      core.debug(`No version change for ${packageName} (current: ${currentVersion})`);
      continue;
    }

    // Calculate final new version based on release-type strategy
    const newVersion = calculateNewVersion(releaseType, suggestedVersion, currentVersion, headSha, prNumber);

    // Update package.json with new version
    packageJson.version = newVersion;
    writePackageJson(packageFile, packageJson);

    core.info(`Updated ${packageName}: ${currentVersion} → ${newVersion}`);

    // Record this package as updated for later processing (commits, releases, etc.)
    updatedPackages.push({ dir: packageDir });
  }

  return updatedPackages;
}
