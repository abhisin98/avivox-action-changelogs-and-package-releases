// Git operations: committing, tagging, and pushing

import * as core from "@actions/core";
import * as exec from "@actions/exec";

import { UpdatedPackage } from "./types";
import { readPackageJson, normalizeWhitespace } from "./utils";

/**
 * Commits all staged changes with the given commit message.
 * Exits early without error if there are no changes to commit.
 *
 * @param commitMessage - The commit message to use
 */
export async function commitChanges(commitMessage: string): Promise<void> {
  core.info("Committing version changes and changelogs...");

  // Normalize commit message: replace tabs with spaces, collapse multiple spaces, trim
  const normalizedMessage = normalizeWhitespace(commitMessage);

  // Stage all modified files in the repository
  await exec.exec("git", ["add", "."]);

  // Commit with the normalized message; git will silently succeed if nothing to commit
  try {
    await exec.exec("git", ["commit", "-m", normalizedMessage]);
    core.debug(`Commit created: "${normalizedMessage}"`);
  } catch {
    // git commit exits with code 1 if there are no changes, which is not an error
    core.debug("No changes to commit or commit already made");
  }
}

/**
 * Creates a git tag for each updated package version.
 * Tag format: <package-name>@<version> (e.g., "my-package@1.2.3")
 * Skips tags that already exist.
 *
 * @param packages - Array of packages that were updated
 */
export async function createTags(packages: UpdatedPackage[]): Promise<void> {
  if (packages.length === 0) {
    return;
  }

  core.info("Creating git tags for updated packages...");

  for (const pkg of packages) {
    // Read package.json to get the name and version
    const packageJsonPath = `${pkg.dir}/package.json`;
    const packageJson = readPackageJson(packageJsonPath);

    if (!packageJson || !packageJson.name || !packageJson.version) {
      core.warning(`Failed to read package info from ${packageJsonPath}`);
      continue;
    }

    const packageName = String(packageJson.name);
    const packageVersion = String(packageJson.version);
    const tagName = `${packageName}@${packageVersion}`;

    // Check if tag already exists to avoid errors
    let tagExists = false;
    try {
      await exec.exec("git", ["rev-parse", tagName], { ignoreReturnCode: true });
      tagExists = true;
    } catch {
      tagExists = false;
    }

    if (tagExists) {
      core.debug(`Tag already exists: ${tagName}`);
      continue;
    }

    // Create the tag pointing to the current commit
    await exec.exec("git", ["tag", tagName]);
    core.info(`Created tag: ${tagName}`);
  }
}

/**
 * Pushes all commits and tags to the remote repository.
 * Used after creating tags to make changes available on GitHub.
 */
export async function pushChanges(): Promise<void> {
  core.info("Pushing commits and tags to remote...");

  // Push commits to the current branch
  await exec.exec("git", ["push"]);

  // Push all tags
  await exec.exec("git", ["push", "--tags"]);

  core.debug("Commits and tags pushed successfully");
}
