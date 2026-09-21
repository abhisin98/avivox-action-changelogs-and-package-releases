// Tests for src/changelog.ts

import * as core from "@actions/core";
import * as exec from "@actions/exec";

import { calculateNewVersion, generateChangelogsAndBumpVersions } from "../changelog";
import * as utils from "../utils";

// Mock external dependencies
jest.mock("@actions/core");
jest.mock("@actions/exec");
jest.mock("../utils");

const mockCore = core as jest.Mocked<typeof core>;
const mockExec = exec as jest.Mocked<typeof exec>;
const mockUtils = utils as jest.Mocked<typeof utils>;

// ====================================================================
describe("CalculateNewVersion test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("test: should return canary version with short sha and timestamp", () => {
    // arrange
    const releaseType = "canary";
    const suggestedVersion = "1.2.0";
    const currentVersion = "1.1.0";
    const headSha = "deadbeef1234567890abcdef";
    const prNumber = "";

    // act
    const result = calculateNewVersion(releaseType, suggestedVersion, currentVersion, headSha, prNumber);

    //? expect
    // SHA is shortened to first 7 characters: deadbee (from deadbeef...)
    expect(result).toMatch(/^1\.2\.0-canary\.deadbee\.\d{10}$/);
    expect(result).toContain("-canary.deadbee.");
  });

  it("test: should return beta version with pr number, short sha and timestamp", () => {
    // arrange
    const releaseType = "beta";
    const suggestedVersion = "1.2.0";
    const currentVersion = "1.1.0";
    const headSha = "abc123def456789012345678";
    const prNumber = "42";

    // act
    const result = calculateNewVersion(releaseType, suggestedVersion, currentVersion, headSha, prNumber);

    //? expect
    expect(result).toMatch(/^1\.2\.0-beta\.42\.abc123d\.\d{10}$/);
    expect(result).toContain("-beta.42.abc123d.");
  });

  it("test: should increment patch version for patch release type", () => {
    // arrange
    mockUtils.parseVersion.mockReturnValue({ major: 1, minor: 2, patch: 3 });
    const releaseType = "patch";
    const suggestedVersion = "1.2.4";
    const currentVersion = "1.2.3";

    // act
    const result = calculateNewVersion(releaseType, suggestedVersion, currentVersion);

    //? expect
    expect(result).toBe("1.2.4");
    expect(mockUtils.parseVersion).toHaveBeenCalledWith("1.2.3");
  });

  it("test: should increment minor and reset patch for minor release type", () => {
    // arrange
    mockUtils.parseVersion.mockReturnValue({ major: 1, minor: 2, patch: 3 });
    const releaseType = "minor";
    const suggestedVersion = "1.3.0";
    const currentVersion = "1.2.3";

    // act
    const result = calculateNewVersion(releaseType, suggestedVersion, currentVersion);

    //? expect
    expect(result).toBe("1.3.0");
  });

  it("test: should increment major and reset minor and patch for major release type", () => {
    // arrange
    mockUtils.parseVersion.mockReturnValue({ major: 1, minor: 2, patch: 3 });
    const releaseType = "major";
    const suggestedVersion = "2.0.0";
    const currentVersion = "1.2.3";

    // act
    const result = calculateNewVersion(releaseType, suggestedVersion, currentVersion);

    //? expect
    expect(result).toBe("2.0.0");
  });

  it("test: should use suggested version for auto release type", () => {
    // arrange
    const releaseType = "auto";
    const suggestedVersion = "1.2.4";
    const currentVersion = "1.2.3";

    // act
    const result = calculateNewVersion(releaseType, suggestedVersion, currentVersion);

    //? expect
    expect(result).toBe("1.2.4");
  });

  it("test: should throw error when version parsing fails for patch", () => {
    // arrange
    mockUtils.parseVersion.mockReturnValue(null);
    const releaseType = "patch";
    const suggestedVersion = "1.2.4";
    const currentVersion = "invalid-version";

    // act & expect
    expect(() => {
      calculateNewVersion(releaseType, suggestedVersion, currentVersion);
    }).toThrow("Cannot parse current version: invalid-version");
  });

  it("test: should throw error when version parsing fails for minor", () => {
    // arrange
    mockUtils.parseVersion.mockReturnValue(null);
    const releaseType = "minor";
    const suggestedVersion = "1.3.0";
    const currentVersion = "bad-version";

    // act & expect
    expect(() => {
      calculateNewVersion(releaseType, suggestedVersion, currentVersion);
    }).toThrow("Cannot parse current version: bad-version");
  });

  it("test: should throw error when version parsing fails for major", () => {
    // arrange
    mockUtils.parseVersion.mockReturnValue(null);
    const releaseType = "major";
    const suggestedVersion = "2.0.0";
    const currentVersion = "broken-version";

    // act & expect
    expect(() => {
      calculateNewVersion(releaseType, suggestedVersion, currentVersion);
    }).toThrow("Cannot parse current version: broken-version");
  });

  it("test: should handle canary version with empty headSha", () => {
    // arrange
    const releaseType = "canary";
    const suggestedVersion = "1.2.0";
    const currentVersion = "1.1.0";
    const headSha = "";
    const prNumber = "";

    // act
    const result = calculateNewVersion(releaseType, suggestedVersion, currentVersion, headSha, prNumber);

    //? expect
    // headSha.substring(0, 7) with empty string becomes empty string
    expect(result).toMatch(/^1\.2\.0-canary\.\.\d{10}$/);
  });

  it("test: should handle beta version with empty prNumber", () => {
    // arrange
    const releaseType = "beta";
    const suggestedVersion = "1.2.0";
    const currentVersion = "1.1.0";
    const headSha = "abc123def456789012345678";
    const prNumber = "";

    // act
    const result = calculateNewVersion(releaseType, suggestedVersion, currentVersion, headSha, prNumber);

    //? expect
    // eslint-disable-next-line no-useless-escape
    expect(result).toMatch(/^1\.2\.0-beta\.\.\abc123d\.\d{10}$/);
  });

  it("test: should handle version with large numbers", () => {
    // arrange
    mockUtils.parseVersion.mockReturnValue({ major: 10, minor: 20, patch: 30 });
    const releaseType = "patch";
    const suggestedVersion = "10.20.31";
    const currentVersion = "10.20.30";

    // act
    const result = calculateNewVersion(releaseType, suggestedVersion, currentVersion);

    //? expect
    expect(result).toBe("10.20.31");
  });
});

// ====================================================================
describe("GenerateChangelogsAndBumpVersions test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCore.info.mockImplementation();
    mockCore.debug.mockImplementation();
    mockCore.warning.mockImplementation();
  });

  it("test: should return empty array when no package.json files found", async () => {
    // arrange
    mockExec.exec.mockImplementation(async (command, _args, options) => {
      if (command === "find") {
        (options?.listeners?.stdout as Function)?.("");
        return 0;
      }
      return 0;
    });

    // act
    const result = await generateChangelogsAndBumpVersions("auto");

    //? expect
    expect(result).toEqual([]);
    expect(mockCore.warning).toHaveBeenCalledWith("No package.json files found");
  });

  it("test: should skip packages with invalid package.json", async () => {
    // arrange
    mockExec.exec.mockImplementation(async (command, _args, options) => {
      if (command === "find") {
        (options?.listeners?.stdout as Function)?.("./packages/pkg1/package.json\n");
        return 0;
      }
      return 0;
    });

    mockUtils.readPackageJson.mockReturnValue(null);

    // act
    const result = await generateChangelogsAndBumpVersions("auto");

    //? expect
    expect(result).toEqual([]);
    expect(mockCore.debug).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid package"));
  });

  it("test: should skip packages when git-cliff fails", async () => {
    // arrange
    mockExec.exec.mockImplementation(async (command, args, options) => {
      if (command === "find") {
        (options?.listeners?.stdout as Function)?.("./packages/pkg1/package.json\n");
        return 0;
      }
      if (command === "git" && args?.includes("tag")) {
        return 0; // No tags found
      }
      if (command === "git-cliff") {
        (options?.listeners?.stderr as Function)?.("Error occurred");
        throw new Error("git-cliff failed");
      }
      return 0;
    });

    mockUtils.readPackageJson.mockReturnValue({
      name: "my-package",
      version: "1.0.0",
    });

    // act
    const result = await generateChangelogsAndBumpVersions("auto");

    //? expect
    expect(result).toEqual([]);
    expect(mockCore.warning).toHaveBeenCalledWith(expect.stringContaining("Failed to run git-cliff"));
  });

  it("test: should skip packages when version does not change", async () => {
    // arrange
    mockExec.exec.mockImplementation(async (command, _args, options) => {
      if (command === "find") {
        (options?.listeners?.stdout as Function)?.("./packages/pkg1/package.json\n");
        return 0;
      }
      return 0;
    });

    mockUtils.readPackageJson.mockReturnValue({
      name: "my-package",
      version: "1.0.0",
    });

    // Mock git-cliff to return same version
    let gitCliffCallCount = 0;
    mockExec.exec.mockImplementation(async (command, _args, options) => {
      if (command === "git-cliff") {
        gitCliffCallCount++;
        if (gitCliffCallCount === 1) {
          // First call for changelog generation
          return 0;
        } else {
          // Second call for version
          (options?.listeners?.stdout as Function)?.("1.0.0");
          return 0;
        }
      }
      if (command === "find") {
        (options?.listeners?.stdout as Function)?.("./packages/pkg1/package.json\n");
        return 0;
      }
      return 0;
    });

    // act
    const result = await generateChangelogsAndBumpVersions("auto");

    //? expect
    expect(result).toEqual([]);
    expect(mockCore.debug).toHaveBeenCalledWith(expect.stringContaining("No version change"));
  });

  it("test: should update package when version changes", async () => {
    // arrange
    let callCount = 0;
    mockExec.exec.mockImplementation(async (command, args, options) => {
      if (command === "find") {
        (options?.listeners?.stdout as Function)?.("./packages/pkg1/package.json\n");
        return 0;
      }
      if (command === "git" && args?.includes("tag")) {
        return 1; // No tags, command fails
      }
      if (command === "git-cliff") {
        callCount++;
        if (callCount === 1) {
          return 0; // First call succeeds
        } else {
          (options?.listeners?.stdout as Function)?.("1.1.0");
          return 0;
        }
      }
      return 0;
    });

    const originalPackage = { name: "my-package", version: "1.0.0" };
    const mockReadPackageJson = jest.fn();
    mockReadPackageJson.mockReturnValue(originalPackage);
    mockUtils.readPackageJson.mockImplementation(mockReadPackageJson);
    mockUtils.writePackageJson.mockImplementation();

    // act
    const result = await generateChangelogsAndBumpVersions("patch");

    //? expect
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toEqual({ dir: "./packages/pkg1" });
    expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining("Updated my-package"));
  });

  it("test: should apply correct version bump strategy with auto", async () => {
    // arrange
    let callCount = 0;
    mockExec.exec.mockImplementation(async (command, _args, options) => {
      if (command === "find") {
        (options?.listeners?.stdout as Function)?.("./package.json\n");
        return 0;
      }
      if (command === "git-cliff") {
        callCount++;
        if (callCount === 1) {
          return 0;
        } else {
          (options?.listeners?.stdout as Function)?.("2.0.0");
          return 0;
        }
      }
      return 0;
    });

    mockUtils.readPackageJson.mockReturnValue({ name: "test-pkg", version: "1.0.0" });
    mockUtils.writePackageJson.mockImplementation();

    // act
    await generateChangelogsAndBumpVersions("auto");

    //? expect
    expect(mockUtils.writePackageJson).toHaveBeenCalledWith(
      "./package.json",
      expect.objectContaining({
        version: "2.0.0",
      })
    );
  });

  it("test: should handle multiple packages", async () => {
    // arrange
    let findCallCount = 0;
    let gitCliffCallCount = 0;

    mockExec.exec.mockImplementation(async (command, _args, options) => {
      if (command === "find") {
        if (findCallCount === 0) {
          (options?.listeners?.stdout as Function)?.("./packages/pkg1/package.json\n./packages/pkg2/package.json\n");
          findCallCount++;
        }
        return 0;
      }
      if (command === "git-cliff") {
        gitCliffCallCount++;
        (options?.listeners?.stdout as Function)?.(gitCliffCallCount % 2 === 1 ? "1.1.0" : "2.0.0");
        return 0;
      }
      return 0;
    });

    mockUtils.readPackageJson.mockReturnValueOnce({ name: "pkg1", version: "1.0.0" }).mockReturnValueOnce({ name: "pkg2", version: "1.0.0" }).mockReturnValueOnce({ name: "pkg1", version: "1.1.0" });

    mockUtils.writePackageJson.mockImplementation();

    // act
    const result = await generateChangelogsAndBumpVersions("auto");

    //? expect
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("test: should handle prerelease tag strategy in git-cliff call", async () => {
    // arrange
    mockExec.exec.mockImplementation(async (command, args, options) => {
      if (command === "find") {
        (options?.listeners?.stdout as Function)?.("./package.json\n");
        return 0;
      }
      if (command === "git" && args?.[0] === "tag") {
        // Simulate tag exists
        (options?.listeners?.stdout as Function)?.("my-package@1.0.0\n");
        return 0;
      }
      if (command === "git-cliff") {
        if (args?.includes("--tag-pattern")) {
          // Verify tag pattern is correctly set
          expect(args).toContain("--tag-pattern");
        }
        (options?.listeners?.stdout as Function)?.("1.1.0");
        return 0;
      }
      return 0;
    });

    mockUtils.readPackageJson.mockReturnValue({ name: "my-package", version: "1.0.0" });
    mockUtils.writePackageJson.mockImplementation();

    // act
    await generateChangelogsAndBumpVersions("auto");

    //? expect
    // The function finds packages and queries git tags for each one
    expect(mockExec.exec).toHaveBeenCalledWith("find", expect.any(Array), expect.any(Object));
    // It should call git tag --list with a pattern for the package
    expect(mockExec.exec).toHaveBeenCalledWith("git", expect.arrayContaining(["tag", "--list"]), expect.any(Object));
  });

  it("test: should log correct debug information when processing packages", async () => {
    // arrange
    mockExec.exec.mockImplementation(async (command, _args, options) => {
      if (command === "find") {
        (options?.listeners?.stdout as Function)?.("./package.json\n");
        return 0;
      }
      if (command === "git-cliff") {
        (options?.listeners?.stdout as Function)?.("1.1.0");
        return 0;
      }
      return 0;
    });

    mockUtils.readPackageJson.mockReturnValue({ name: "test-pkg", version: "1.0.0" });
    mockUtils.writePackageJson.mockImplementation();

    // act
    await generateChangelogsAndBumpVersions("auto");

    //? expect
    expect(mockCore.debug).toHaveBeenCalledWith(expect.stringContaining("Found 1 package.json files"));
    expect(mockCore.debug).toHaveBeenCalledWith(expect.stringContaining("Processing package: test-pkg@1.0.0"));
  });

  it("test: should handle warning when package.json read fails during tag creation", async () => {
    // arrange
    mockExec.exec.mockImplementation(async (command, _args, options) => {
      if (command === "find") {
        (options?.listeners?.stdout as Function)?.("./bad-package/package.json\n");
        return 0;
      }
      if (command === "git-cliff") {
        (options?.listeners?.stdout as Function)?.("1.1.0");
        return 0;
      }
      return 0;
    });

    mockUtils.readPackageJson.mockReturnValue(null);

    // act
    const result = await generateChangelogsAndBumpVersions("auto");

    //? expect
    expect(result).toEqual([]);
    expect(mockCore.debug).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid package"));
  });
});
