// GitHub API operations: posting PR comments and creating releases

import * as core from "@actions/core";
import * as github from "@actions/github";
import * as path from "path";

import { UpdatedPackage } from "./types";
import { extractChangelogSection, readPackageJson, readChangelog, normalizeWhitespace } from "./utils";

/**
 * Posts or updates a beta release preview comment on the pull request.
 * The comment includes package names, versions, installation commands, npm links,
 * and changelog excerpts for each updated package.
 * Uses a marker comment to allow updates on subsequent runs.
 *
 * @param packages - Array of packages that were updated
 * @param prNumber - The pull request number
 * @param octokit - GitHub Octokit client instance
 * @param owner - Repository owner
 * @param repo - Repository name
 */
export async function postBetaReleaseComment(packages: UpdatedPackage[], prNumber: string, octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string): Promise<void> {
  if (!packages.length) {
    core.info("No packages updated, skipping PR comment");
    return;
  }

  if (!prNumber) {
    core.warning("No PR number provided, skipping PR comment");
    return;
  }

  core.info(`Posting beta release preview comment on PR ${prNumber}...`);

  // Build comment blocks for each updated package
  const commentBlocks: string[] = [];

  for (const pkg of packages) {
    const changelogFile = path.join(pkg.dir, "CHANGELOG.md");
    const packageJsonFile = path.join(pkg.dir, "package.json");

    // Read package.json to get metadata
    const packageJson = readPackageJson(packageJsonFile);
    if (!packageJson) {
      core.warning(`Failed to read package info from ${packageJsonFile}`);
      continue;
    }

    const packageName = String(packageJson.name || "Unknown");
    const packageVersion = String(packageJson.version || "0.0.0");
    const isPrivate = Boolean(packageJson.private);

    // Extract the changelog section for this release
    const changelogContent = readChangelog(changelogFile);
    const changelogNotes = extractChangelogSection(changelogContent, packageVersion);

    // Build npm install command and link (only for public packages)
    let npmSection = "";
    if (!isPrivate) {
      npmSection = `

\`\`\`bash
npm install ${packageName}@${packageVersion}
\`\`\`

🔗 https://www.npmjs.com/package/${packageName}/v/${packageVersion}
`;
    }

    // Construct the comment block for this package
    const block = `
## 📦 ${packageName}@${packageVersion}
${npmSection}

### Changelog
${changelogNotes || "_No changelog_"}
`;

    commentBlocks.push(block);
  }

  // Build the final comment body with marker and title
  const marker = "<!-- packages -->";
  const body = `${marker}
# 🚀 Beta Release Preview

${commentBlocks.join("\n\n")}

_This comment updates automatically._`;

  // Normalize whitespace in comment body
  const normalizedBody = normalizeWhitespace(body.replace(/\n\n+/g, "\n"));

  // Parse PR number to integer
  const issueNumber = parseInt(prNumber, 10);

  // Fetch existing comments on the PR to find our marker comment
  const { data: existingComments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
  });

  // Look for existing comment with our marker
  const existingComment = existingComments.find((c) => c.body?.includes(marker));

  if (existingComment) {
    // Update existing comment if found
    core.info(`Updating existing comment (ID: ${existingComment.id})`);
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body: normalizedBody,
    });
  } else {
    // Create new comment if not found
    core.info(`Creating new comment on PR ${issueNumber}`);
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: normalizedBody,
    });
  }
}

/**
 * Creates GitHub Releases for each updated package.
 * Uses the changelog excerpt for that version as the release notes.
 * Skips releases that already exist (idempotent).
 *
 * @param packages - Array of packages that were updated
 * @param octokit - GitHub Octokit client instance
 * @param owner - Repository owner
 * @param repo - Repository name
 */
export async function createGitHubReleases(packages: UpdatedPackage[], octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string): Promise<void> {
  if (!packages.length) {
    core.info("No packages updated, skipping release creation");
    return;
  }

  core.info("Creating GitHub releases for updated packages...");

  for (const pkg of packages) {
    const changelogFile = path.join(pkg.dir, "CHANGELOG.md");
    const packageJsonFile = path.join(pkg.dir, "package.json");

    // Read package.json to get metadata
    const packageJson = readPackageJson(packageJsonFile);
    if (!packageJson || !packageJson.name || !packageJson.version) {
      core.warning(`Failed to read package info from ${packageJsonFile}`);
      continue;
    }

    const packageName = String(packageJson.name);
    const packageVersion = String(packageJson.version);
    const tagName = `${packageName}@${packageVersion}`;

    // Extract changelog section for this release
    const changelogContent = readChangelog(changelogFile);
    const changelogNotes = extractChangelogSection(changelogContent, packageVersion);

    // Use changelog as release body, or minimal placeholder if not found
    const releaseBody = changelogNotes || `# Release ${tagName}\n\n`;

    // Normalize whitespace
    const normalizedBody = normalizeWhitespace(releaseBody.replace(/\n\n+/g, "\n"));

    // Check if release already exists to avoid duplicates
    try {
      await octokit.rest.repos.getReleaseByTag({
        owner,
        repo,
        tag: tagName,
      });

      core.info(`Release already exists for tag: ${tagName}`);
      continue;
    } catch (error: unknown) {
      // Expected error if release doesn't exist; continue to create it
      if (error instanceof Error && error.message && (error.message.includes("Not Found") || error.message.includes("404"))) {
        // Release doesn't exist, proceed to create
      } else {
        core.warning(`Error checking for existing release ${tagName}: ${String(error)}`);
        continue;
      }
    }

    // Create the release
    core.info(`Creating release: ${tagName}`);
    await octokit.rest.repos.createRelease({
      owner,
      repo,
      tag_name: tagName,
      name: tagName,
      body: normalizedBody,
      // Note: prerelease flag not set; could be calculated from version string if needed
    });
  }
}
