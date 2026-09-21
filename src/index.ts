// Main entry point: orchestrates the entire release pipeline

import * as core from "@actions/core";
import * as github from "@actions/github";

import { generateChangelogsAndBumpVersions } from "./changelog";
import { commitChanges, createTags, pushChanges } from "./git";
import { postBetaReleaseComment, createGitHubReleases } from "./github-api";
import { parseInputs } from "./inputs";
import { publishPackages } from "./publish";

/**
 * Main action execution function.
 * Orchestrates the entire release pipeline:
 * 1. Parse and validate inputs
 * 2. Generate changelogs and bump versions
 * 3. Post PR comment (beta releases only)
 * 4. Commit and push (non-beta/canary releases)
 * 5. Create GitHub releases (non-beta/canary releases)
 * 6. Publish packages to registry
 */
async function run(): Promise<void> {
  try {
    // Parse action inputs with defaults and validation
    const inputs = parseInputs();
    core.debug(`Parsed inputs: ${JSON.stringify(inputs)}`);

    // Generate changelogs and bump versions for all packages
    // Returns array of packages that actually had version changes
    const updatedPackages = await generateChangelogsAndBumpVersions(inputs.releaseType, inputs.headSha, inputs.prNumber);

    // Set the action output with the list of updated packages
    core.setOutput("packages", JSON.stringify(updatedPackages));

    // Post a preview comment on PRs for beta releases (helps reviewers see what's being released)
    if (inputs.releaseType === "beta" && updatedPackages.length > 0) {
      const octokit = github.getOctokit(inputs.githubToken);
      const { owner, repo } = github.context.repo;

      await postBetaReleaseComment(updatedPackages, inputs.prNumber, octokit, owner, repo);
    }

    // Commit version bumps and changelogs, create git tags, and push changes
    // Only for stable releases (skip beta and canary to avoid polluting git history)
    if (inputs.commitAndPush && inputs.releaseType !== "beta" && inputs.releaseType !== "canary") {
      if (updatedPackages.length > 0) {
        await commitChanges(inputs.commitMessage);
        await createTags(updatedPackages);
        await pushChanges();
      } else {
        core.info("No packages changed, skipping commit and push");
      }
    }

    // Create GitHub Releases for each updated package
    // Only for stable releases (skip beta and canary to avoid release clutter)
    if (inputs.createRelease && inputs.commitAndPush && inputs.releaseType !== "beta" && inputs.releaseType !== "canary") {
      if (updatedPackages.length > 0) {
        const octokit = github.getOctokit(inputs.githubToken);
        const { owner, repo } = github.context.repo;

        await createGitHubReleases(updatedPackages, octokit, owner, repo);
      }
    }

    // Publish updated packages to the npm registry
    if (inputs.publishPackages && updatedPackages.length > 0) {
      await publishPackages(updatedPackages, inputs.packageManager, inputs.packageAccess, inputs.publishPackageTag, inputs.publishExtraArgs);
    }

    // Log completion
    if (updatedPackages.length > 0) {
      core.info(`Successfully processed ${updatedPackages.length} package(s)`);
    } else {
      core.info("No packages were updated");
    }
  } catch (error) {
    // Catch any errors and report them to the GitHub Actions UI
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(errorMessage);
    process.exit(1);
  }
}

// Execute the main function
run();
