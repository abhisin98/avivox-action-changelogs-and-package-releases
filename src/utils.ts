// Utility functions for changelog processing and version handling

import * as fs from "fs";

/**
 * Extracts the changelog section for a specific semantic version from a changelog file.
 * Only matches exact stable versions (e.g., 1.0.1 from 1.0.1-beta.123).
 * Handles scoped packages (@scope/name), unscoped packages, and version-only formats.
 *
 * @param content - The full changelog file content
 * @param version - The semantic version to extract (may include prerelease suffix)
 * @returns The changelog section for that version, or empty string if not found
 */
export function extractChangelogSection(content: string, version: string): string {
  // Extract only the stable semver (e.g., 1.0.1 from 1.0.1-beta.123)
  const stableVersionMatch = version.match(/^\d+\.\d+\.\d+/);
  if (!stableVersionMatch) {
    return "";
  }

  const stableVersion = stableVersionMatch[0];

  // Escape dots for use in regex pattern
  const escapedVersion = stableVersion.replace(/\./g, "\\.");

  // Split changelog by markdown h2 headings (##) to get individual release sections
  const sections = content.split(/^##\s+/gm);

  // Match exactly the target version in the heading, handling various formats:
  // - [1.0.1]
  // - [@scope/package@1.0.1]
  // - [package@1.0.1]
  // This regex avoids false matches like [1.0.10] or [1.0.1-beta]
  const versionRegex = new RegExp(`^\\[(?:[^\\]@]+@|@[^\\]]+@)?${escapedVersion}\\]`);

  // Find the section with matching version heading
  const targetSection = sections.find((section) => versionRegex.test(section.trim()));

  // If found, reconstruct as a level-2 heading with the section content
  return targetSection ? `## ${targetSection.trim()}` : "";
}

/**
 * Parses a semantic version string into major, minor, and patch components.
 * Only expects stable version format (e.g., "1.2.3"), not prerelease suffixes.
 *
 * @param version - A semantic version string (e.g., "1.2.3")
 * @returns Object with major, minor, patch numbers, or null if parse fails
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  // Match three dot-separated numbers at the start
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }

  return {
    major: parseInt(match[1] ?? "", 10),
    minor: parseInt(match[2] ?? "", 10),
    patch: parseInt(match[3] ?? "", 10),
  };
}

/**
 * Reads and parses a package.json file.
 *
 * @param filePath - Path to the package.json file
 * @returns Parsed JSON object, or null if file does not exist or parse fails
 */
export function readPackageJson(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Writes a package.json file with updated content.
 * Maintains 2-space indentation for consistency.
 *
 * @param filePath - Path to the package.json file
 * @param content - Object to write as JSON
 */
export function writePackageJson(filePath: string, content: Record<string, unknown>): void {
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + "\n", "utf-8");
}

/**
 * Normalizes whitespace in a string by:
 * - Replacing tabs with spaces
 * - Collapsing multiple spaces to single space
 * - Trimming leading/trailing whitespace
 *
 * @param text - The text to normalize
 * @returns Normalized text
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\t/g, " ") // Replace tabs with spaces
    .replace(/  +/g, " ") // Collapse multiple spaces to single
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Reads a changelog file if it exists.
 *
 * @param filePath - Path to the changelog file
 * @returns File content as string, or empty string if file does not exist
 */
export function readChangelog(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf-8");
}
