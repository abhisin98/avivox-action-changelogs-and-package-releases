// Tests for src/git.ts git operations

import * as core from "@actions/core";
import * as exec from "@actions/exec";

import { commitChanges, createTags, pushChanges } from "../git";
import { UpdatedPackage } from "../types";
import * as utils from "../utils";

// Mock external dependencies
jest.mock("@actions/core");
jest.mock("@actions/exec");
jest.mock("../utils");

const mockCore = core as jest.Mocked<typeof core>;
const mockExec = exec as jest.Mocked<typeof exec>;
const mockUtils = utils as jest.Mocked<typeof utils>;

// ====================================================================
describe("CommitChanges test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.exec.mockResolvedValue(0);
  });

  it("test: should stage all files and commit with normalized message", async () => {
    // arrange
    const commitMessage = "  Release   v1.2.3  ";
    mockUtils.normalizeWhitespace.mockReturnValue("Release v1.2.3");

    // act
    await commitChanges(commitMessage);

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("git", ["add", "."]);
    expect(mockUtils.normalizeWhitespace).toHaveBeenCalledWith(commitMessage);
    expect(mockExec.exec).toHaveBeenCalledWith("git", ["commit", "-m", "Release v1.2.3"]);
  });

  it("test: should handle no changes to commit gracefully", async () => {
    // arrange
    const commitMessage = "Release v1.2.3";
    mockUtils.normalizeWhitespace.mockReturnValue(commitMessage);
    mockExec.exec.mockImplementation((cmd, args) => {
      if (cmd === "git" && args?.[0] === "commit") {
        const error = new Error("nothing to commit");
        (error as any).exitCode = 1;
        throw error;
      }
      return Promise.resolve(0);
    });

    // act & assert - should not throw
    await expect(commitChanges(commitMessage)).resolves.toBeUndefined();

    //? expect
    expect(mockCore.debug).toHaveBeenCalledWith("No changes to commit or commit already made");
  });

  it("test: should log info message when committing", async () => {
    // arrange
    const commitMessage = "Release v1.0.0";
    mockUtils.normalizeWhitespace.mockReturnValue(commitMessage);

    // act
    await commitChanges(commitMessage);

    //? expect
    expect(mockCore.info).toHaveBeenCalledWith("Committing version changes and changelogs...");
  });

  it("test: should normalize tabs and multiple spaces in message", async () => {
    // arrange
    const commitMessage = "Release\t\tv1.2.3\n\n\n";
    mockUtils.normalizeWhitespace.mockReturnValue("Release v1.2.3");

    // act
    await commitChanges(commitMessage);

    //? expect
    expect(mockUtils.normalizeWhitespace).toHaveBeenCalledWith(commitMessage);
  });

  it("test: should handle empty commit message", async () => {
    // arrange
    const commitMessage = "";
    mockUtils.normalizeWhitespace.mockReturnValue("");

    // act
    await commitChanges(commitMessage);

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("git", ["commit", "-m", ""]);
  });
});

// ====================================================================
describe("CreateTags test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: rev-parse throws (tag doesn't exist), other commands resolve
    mockExec.exec.mockImplementation(async (cmd, args, _options) => {
      if (cmd === "git" && args?.[0] === "rev-parse") {
        throw new Error("fatal: Not a valid object name");
      }
      return Promise.resolve(0);
    });
  });

  it("test: should create tags for each updated package", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }, { dir: "packages/pkg2" }];
    mockUtils.readPackageJson.mockImplementation((path: string) => {
      if (path.includes("pkg1")) {
        return { name: "@scope/pkg1", version: "1.2.3" };
      }
      if (path.includes("pkg2")) {
        return { name: "@scope/pkg2", version: "2.0.0" };
      }
      return null;
    });

    // act
    await createTags(packages);

    //? expect
    expect(mockCore.info).toHaveBeenCalledWith("Creating git tags for updated packages...");
    // First checks if tags exist, then creates them
    expect(mockExec.exec).toHaveBeenCalledWith("git", ["rev-parse", "@scope/pkg1@1.2.3"], { ignoreReturnCode: true });
    expect(mockExec.exec).toHaveBeenCalledWith("git", ["rev-parse", "@scope/pkg2@2.0.0"], { ignoreReturnCode: true });
    expect(mockExec.exec).toHaveBeenCalledWith("git", ["tag", "@scope/pkg1@1.2.3"]);
    expect(mockExec.exec).toHaveBeenCalledWith("git", ["tag", "@scope/pkg2@2.0.0"]);
    expect(mockCore.info).toHaveBeenCalledWith("Created tag: @scope/pkg1@1.2.3");
    expect(mockCore.info).toHaveBeenCalledWith("Created tag: @scope/pkg2@2.0.0");
  });

  it("test: should skip empty package array", async () => {
    // arrange
    const packages: UpdatedPackage[] = [];

    // act
    await createTags(packages);

    //? expect
    expect(mockExec.exec).not.toHaveBeenCalled();
  });

  it("test: should skip packages that fail to read package.json", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/broken" }];
    mockUtils.readPackageJson.mockReturnValue(null);

    // act
    await createTags(packages);

    //? expect
    expect(mockCore.warning).toHaveBeenCalledWith(expect.stringMatching(/Failed to read package info/));
    expect(mockExec.exec).not.toHaveBeenCalledWith(expect.arrayContaining(["tag"]));
  });

  it("test: should skip packages with missing name or version", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/incomplete" }];
    mockUtils.readPackageJson.mockReturnValue({ name: "pkg", version: undefined });

    // act
    await createTags(packages);

    //? expect
    expect(mockCore.warning).toHaveBeenCalled();
  });

  it("test: should skip existing tags and continue", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }, { dir: "packages/pkg2" }];
    mockUtils.readPackageJson.mockImplementation((path: string) => {
      if (path.includes("pkg1")) {
        return { name: "pkg1", version: "1.0.0" };
      }
      if (path.includes("pkg2")) {
        return { name: "pkg2", version: "2.0.0" };
      }
      return null;
    });
    mockExec.exec.mockImplementation((cmd, args, _options) => {
      if (cmd === "git" && args?.[0] === "rev-parse") {
        if (args?.[1] === "pkg1@1.0.0") {
          return Promise.resolve(0); // Tag exists - resolve (no exception)
        }
        if (args?.[1] === "pkg2@2.0.0") {
          // Tag doesn't exist - throw (will be caught by try-catch)
          throw new Error("fatal: Not a valid object name");
        }
      }
      return Promise.resolve(0);
    });

    // act
    await createTags(packages);

    //? expect
    expect(mockCore.debug).toHaveBeenCalledWith("Tag already exists: pkg1@1.0.0");
    // pkg2 should still be created
    expect(mockExec.exec).toHaveBeenCalledWith("git", ["tag", "pkg2@2.0.0"]);
  });

  it("test: should handle package names with special characters", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/special-pkg" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "@my-scope/my-pkg-name",
      version: "1.2.3",
    });

    // act
    await createTags(packages);

    //? expect
    // Should check if tag exists first, then create it
    expect(mockExec.exec).toHaveBeenCalledWith("git", ["rev-parse", "@my-scope/my-pkg-name@1.2.3"], { ignoreReturnCode: true });
    expect(mockExec.exec).toHaveBeenCalledWith("git", ["tag", "@my-scope/my-pkg-name@1.2.3"]);
  });
});

// ====================================================================
describe("PushChanges test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.exec.mockResolvedValue(0);
  });

  it("test: should push commits and tags to remote", async () => {
    // act
    await pushChanges();

    //? expect
    expect(mockCore.info).toHaveBeenCalledWith("Pushing commits and tags to remote...");
    expect(mockExec.exec).toHaveBeenCalledWith("git", ["push"]);
    expect(mockExec.exec).toHaveBeenCalledWith("git", ["push", "--tags"]);
    expect(mockCore.debug).toHaveBeenCalledWith("Commits and tags pushed successfully");
  });

  it("test: should execute push commit before push tags", async () => {
    // arrange
    const callOrder: string[] = [];
    mockExec.exec.mockImplementation((cmd, args) => {
      if (cmd === "git" && args?.[0] === "push" && args?.length === 1) {
        callOrder.push("push-commits");
      } else if (cmd === "git" && args?.includes("--tags")) {
        callOrder.push("push-tags");
      }
      return Promise.resolve(0);
    });

    // act
    await pushChanges();

    //? expect
    expect(callOrder).toEqual(["push-commits", "push-tags"]);
  });

  it("test: should handle network errors", async () => {
    // arrange
    mockExec.exec.mockRejectedValue(new Error("Network error"));

    // act & assert
    await expect(pushChanges()).rejects.toThrow("Network error");
  });

  it("test: should pass execution to exec module correctly", async () => {
    // act
    await pushChanges();

    //? expect
    expect(mockExec.exec).toHaveBeenCalledTimes(2);
    const calls = mockExec.exec.mock.calls;
    expect(calls[0]).toEqual(["git", ["push"]]);
    expect(calls[1]).toEqual(["git", ["push", "--tags"]]);
  });
});
