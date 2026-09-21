// Tests for src/publish.ts package publishing

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as path from "path";

import { publishPackages } from "../publish";
import { UpdatedPackage } from "../types";
import * as utils from "../utils";

// Mock external dependencies
jest.mock("@actions/core");
jest.mock("@actions/exec");
jest.mock("path");
jest.mock("../utils");

const mockCore = core as jest.Mocked<typeof core>;
const mockExec = exec as jest.Mocked<typeof exec>;
const mockPath = path as jest.Mocked<typeof path>;
const mockUtils = utils as jest.Mocked<typeof utils>;

// ====================================================================
describe("PublishPackages test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.exec.mockResolvedValue(0);
    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockUtils.readPackageJson.mockReturnValue({});
  });

  it("test: should skip publishing when no packages provided", async () => {
    // arrange
    const packages: UpdatedPackage[] = [];

    // act
    await publishPackages(packages, "npm", "public");

    //? expect
    expect(mockCore.info).toHaveBeenCalledWith("No packages to publish");
    expect(mockExec.exec).not.toHaveBeenCalled();
  });

  it("test: should publish with pnpm and apply latest tag for stable version", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.2.3",
      private: false,
    });

    // act
    await publishPackages(packages, "pnpm", "public");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("pnpm", ["publish", "--no-git-checks", "--access", "public", "--tag", "latest"], { cwd: "packages/pkg1" });
  });

  it("test: should publish with npm and apply latest tag for stable version", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "2.0.0",
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "public");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("npm", ["publish", "--access", "public", "--tag", "latest"], { cwd: "packages/pkg1" });
  });

  it("test: should publish with yarn and apply latest tag for stable version", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "3.1.0",
      private: false,
    });

    // act
    await publishPackages(packages, "yarn", "public");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("yarn", ["npm", "publish", "--access", "public", "--tag", "latest"], { cwd: "packages/pkg1" });
  });

  it("test: should auto-detect beta tag from version string", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.2.3-beta.1",
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "public");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("npm", ["publish", "--access", "public", "--tag", "beta"], expect.any(Object));
  });

  it("test: should auto-detect canary tag from version string", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.2.3-canary.42",
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "public");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("npm", ["publish", "--access", "public", "--tag", "canary"], expect.any(Object));
  });

  it("test: should use custom tag when provided", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.2.3-beta.1",
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "public", "custom-tag");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("npm", ["publish", "--access", "public", "--tag", "custom-tag"], expect.any(Object));
  });

  it("test: should apply restricted access when specified", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "restricted");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("npm", ["publish", "--access", "restricted", "--tag", "latest"], expect.any(Object));
  });

  it("test: should skip private packages", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/private" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "private-pkg",
      version: "1.0.0",
      private: true,
    });

    // act
    await publishPackages(packages, "npm", "public");

    //? expect
    expect(mockCore.info).toHaveBeenCalledWith("Skipping private package: private-pkg");
    expect(mockExec.exec).not.toHaveBeenCalled();
  });

  it("test: should publish multiple packages sequentially", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }, { dir: "packages/pkg2" }];
    mockUtils.readPackageJson.mockImplementation((path: string) => {
      if (path.includes("pkg1")) {
        return { name: "pkg1", version: "1.0.0", private: false };
      }
      if (path.includes("pkg2")) {
        return { name: "pkg2", version: "2.0.0", private: false };
      }
      return null;
    });

    // act
    await publishPackages(packages, "npm", "public");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledTimes(2);
    expect(mockExec.exec).toHaveBeenNthCalledWith(1, "npm", expect.arrayContaining(["publish"]), { cwd: "packages/pkg1" });
    expect(mockExec.exec).toHaveBeenNthCalledWith(2, "npm", expect.arrayContaining(["publish"]), { cwd: "packages/pkg2" });
  });

  it("test: should add extra arguments when provided", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "public", "", "--dry-run --verbose");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("npm", ["publish", "--access", "public", "--tag", "latest", "--dry-run", "--verbose"], expect.any(Object));
  });

  it("test: should split extra arguments on whitespace", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "public", "", "--flag1  --flag2   --flag3");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("npm", expect.arrayContaining(["--flag1", "--flag2", "--flag3"]), expect.any(Object));
  });

  it("test: should skip package if fails to read package.json", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/broken" }];
    mockUtils.readPackageJson.mockReturnValue(null);

    // act
    await publishPackages(packages, "npm", "public");

    //? expect
    expect(mockCore.warning).toHaveBeenCalledWith(expect.stringMatching(/Failed to read package info/));
    expect(mockExec.exec).not.toHaveBeenCalled();
  });

  it("test: should skip package if missing name or version", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/incomplete" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg",
      version: undefined,
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "public");

    //? expect
    expect(mockCore.warning).toHaveBeenCalled();
    expect(mockExec.exec).not.toHaveBeenCalled();
  });

  it("test: should throw error when publish fails", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
      private: false,
    });
    const publishError = new Error("Authentication failed");
    mockExec.exec.mockRejectedValue(publishError);

    // act & assert
    await expect(publishPackages(packages, "npm", "public")).rejects.toThrow("Authentication failed");

    //? expect
    expect(mockCore.setFailed).toHaveBeenCalledWith(expect.stringMatching(/Failed to publish/));
  });

  it("test: should log info when starting publish", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
      private: false,
    });

    // act
    await publishPackages(packages, "pnpm", "public");

    //? expect
    expect(mockCore.info).toHaveBeenCalledWith("Publishing packages using pnpm...");
  });

  it("test: should log info when publishing each package", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "my-package",
      version: "1.5.0",
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "public");

    //? expect
    expect(mockCore.info).toHaveBeenCalledWith("Publishing my-package@1.5.0 with tag: latest");
  });

  it("test: should log success after publish", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "public");

    //? expect
    expect(mockCore.info).toHaveBeenCalledWith("Published pkg1@1.0.0");
  });

  it("test: should handle scoped package names", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/scoped" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "@my-org/my-package",
      version: "1.0.0",
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "public");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("npm", expect.arrayContaining(["publish"]), { cwd: "packages/scoped" });
  });

  it("test: should preserve cwd for each package directory", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "monorepo/packages/a" }, { dir: "monorepo/packages/b" }];
    mockUtils.readPackageJson.mockImplementation((path: string) => {
      if (path.includes("/a/")) {
        return { name: "a", version: "1.0.0", private: false };
      }
      if (path.includes("/b/")) {
        return { name: "b", version: "2.0.0", private: false };
      }
      return null;
    });

    // act
    await publishPackages(packages, "npm", "public");

    //? expect
    expect(mockExec.exec).toHaveBeenNthCalledWith(1, expect.any(String), expect.any(Array), { cwd: "monorepo/packages/a" });
    expect(mockExec.exec).toHaveBeenNthCalledWith(2, expect.any(String), expect.any(Array), { cwd: "monorepo/packages/b" });
  });

  it("test: should continue to next package even if one fails", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }, { dir: "packages/pkg2" }];
    mockUtils.readPackageJson.mockImplementation((path: string) => {
      if (path.includes("pkg1")) {
        return { name: "pkg1", version: "1.0.0", private: false };
      }
      if (path.includes("pkg2")) {
        return { name: "pkg2", version: "2.0.0", private: false };
      }
      return null;
    });
    let callCount = 0;
    mockExec.exec.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("First publish failed"));
      }
      return Promise.resolve(0);
    });

    // act & assert
    await expect(publishPackages(packages, "npm", "public")).rejects.toThrow("First publish failed");

    //? expect - first publish fails, second should not be called
    expect(mockExec.exec).toHaveBeenCalledTimes(1);
  });

  it("test: should default to beta tag when version has -beta.", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "2.0.0-beta.5",
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "public", "");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("npm", expect.arrayContaining(["--tag", "beta"]), expect.any(Object));
  });

  it("test: should default to canary tag when version has -canary.", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "3.0.0-canary.123",
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "public", "");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("npm", expect.arrayContaining(["--tag", "canary"]), expect.any(Object));
  });

  it("test: should default to latest tag for stable versions", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
      private: false,
    });

    // act
    await publishPackages(packages, "npm", "public", "");

    //? expect
    expect(mockExec.exec).toHaveBeenCalledWith("npm", expect.arrayContaining(["--tag", "latest"]), expect.any(Object));
  });
});
