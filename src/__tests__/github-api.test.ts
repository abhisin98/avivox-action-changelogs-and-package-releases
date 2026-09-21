// Tests for src/github-api.ts GitHub API operations

import * as core from "@actions/core";
// import * as github from '@actions/github';
import * as path from "path";

import { postBetaReleaseComment, createGitHubReleases } from "../github-api";
import { UpdatedPackage } from "../types";
import * as utils from "../utils";

// Mock external dependencies
jest.mock("@actions/core");
jest.mock("@actions/github");
jest.mock("../utils");
jest.mock("path");

const mockCore = core as jest.Mocked<typeof core>;
// const mockGithub = github as jest.Mocked<typeof github>;
const mockUtils = utils as jest.Mocked<typeof utils>;
const mockPath = path as jest.Mocked<typeof path>;

// ====================================================================
describe("PostBetaReleaseComment test", () => {
  let mockOctokit: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOctokit = {
      rest: {
        issues: {
          listComments: jest.fn().mockResolvedValue({ data: [] }),
          createComment: jest.fn().mockResolvedValue({ data: { id: 123 } }),
          updateComment: jest.fn().mockResolvedValue({ data: {} }),
        },
      },
    };
    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockUtils.readPackageJson.mockReturnValue({});
    mockUtils.readChangelog.mockReturnValue("");
    mockUtils.extractChangelogSection.mockReturnValue("## Changes\n- Fixed bug");
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);
  });

  it("test: should skip posting comment when no packages updated", async () => {
    // arrange
    const packages: UpdatedPackage[] = [];

    // act
    await postBetaReleaseComment(packages, "42", mockOctokit, "owner", "repo");

    //? expect
    expect(mockCore.info).toHaveBeenCalledWith("No packages updated, skipping PR comment");
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it("test: should skip posting comment when no PR number provided", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
      private: false,
    });

    // act
    await postBetaReleaseComment(packages, "", mockOctokit, "owner", "repo");

    //? expect
    expect(mockCore.warning).toHaveBeenCalledWith("No PR number provided, skipping PR comment");
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it("test: should create new comment when marker does not exist", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
      private: false,
    });
    mockUtils.readChangelog.mockReturnValue("## 1.0.0\n- Initial release");
    mockUtils.extractChangelogSection.mockReturnValue("- Initial release");
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await postBetaReleaseComment(packages, "42", mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        issue_number: 42,
        body: expect.stringContaining("<!-- packages -->"),
      })
    );
  });

  it("test: should update existing comment when marker exists", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    const existingComment = { id: 999, body: "<!-- packages -->\nOld comment" };
    mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [existingComment] });
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
      private: false,
    });
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await postBetaReleaseComment(packages, "42", mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        comment_id: 999,
        body: expect.stringContaining("<!-- packages -->"),
      })
    );
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it("test: should include package name and version in comment", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "@scope/my-package",
      version: "2.3.4",
      private: false,
    });
    mockUtils.readChangelog.mockReturnValue("## 2.3.4\n- New feature");
    mockUtils.extractChangelogSection.mockReturnValue("- New feature");
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await postBetaReleaseComment(packages, "42", mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("@scope/my-package@2.3.4"),
      })
    );
  });

  it("test: should include npm install command for public packages", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "public-pkg",
      version: "1.0.0",
      private: false,
    });
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await postBetaReleaseComment(packages, "42", mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("npm install public-pkg@1.0.0"),
      })
    );
  });

  it("test: should skip npm command for private packages", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/private-pkg" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "private-pkg",
      version: "1.0.0",
      private: true,
    });
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await postBetaReleaseComment(packages, "42", mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.not.stringContaining("npm install"),
      })
    );
  });

  it("test: should include npm link for public packages", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "my-package",
      version: "1.5.0",
      private: false,
    });
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await postBetaReleaseComment(packages, "42", mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("https://www.npmjs.com/package/my-package/v/1.5.0"),
      })
    );
  });

  it("test: should handle multiple packages in single comment", async () => {
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
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await postBetaReleaseComment(packages, "42", mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("pkg1@1.0.0"),
      })
    );
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("pkg2@2.0.0"),
      })
    );
  });

  it("test: should skip package if fails to read package.json", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/broken" }];
    mockUtils.readPackageJson.mockReturnValue(null);

    // act
    await postBetaReleaseComment(packages, "42", mockOctokit, "owner", "repo");

    //? expect
    expect(mockCore.warning).toHaveBeenCalledWith(expect.stringMatching(/Failed to read package info/));
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
  });

  it("test: should use changelog section content in comment", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
      private: false,
    });
    mockUtils.readChangelog.mockReturnValue("## 1.0.0\n- Fix bug\n- Add feature");
    mockUtils.extractChangelogSection.mockReturnValue("- Fix bug\n- Add feature");
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await postBetaReleaseComment(packages, "42", mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("- Fix bug"),
      })
    );
  });

  it("test: should log info when posting comment", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
      private: false,
    });
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await postBetaReleaseComment(packages, "42", mockOctokit, "owner", "repo");

    //? expect
    expect(mockCore.info).toHaveBeenCalledWith("Posting beta release preview comment on PR 42...");
  });

  it("test: should parse PR number as integer", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
      private: false,
    });
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await postBetaReleaseComment(packages, "999", mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 999 }));
  });
});

// ====================================================================
describe("CreateGitHubReleases test", () => {
  let mockOctokit: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOctokit = {
      rest: {
        repos: {
          getReleaseByTag: jest.fn().mockRejectedValue(new Error("Not Found")),
          createRelease: jest.fn().mockResolvedValue({ data: { id: 1 } }),
        },
      },
    };
    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockUtils.readPackageJson.mockReturnValue({});
    mockUtils.readChangelog.mockReturnValue("");
    mockUtils.extractChangelogSection.mockReturnValue("## Changes\n- Fixed bug");
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);
  });

  it("test: should skip release creation when no packages updated", async () => {
    // arrange
    const packages: UpdatedPackage[] = [];

    // act
    await createGitHubReleases(packages, mockOctokit, "owner", "repo");

    //? expect
    expect(mockCore.info).toHaveBeenCalledWith("No packages updated, skipping release creation");
    expect(mockOctokit.rest.repos.createRelease).not.toHaveBeenCalled();
  });

  it("test: should create release for each updated package", async () => {
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
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await createGitHubReleases(packages, mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.repos.createRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        tag_name: "pkg1@1.0.0",
        name: "pkg1@1.0.0",
        owner: "owner",
        repo: "repo",
      })
    );
    expect(mockOctokit.rest.repos.createRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        tag_name: "pkg2@2.0.0",
        name: "pkg2@2.0.0",
      })
    );
  });

  it("test: should skip release if already exists", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
    });
    mockOctokit.rest.repos.getReleaseByTag.mockResolvedValue({ data: { id: 1 } });

    // act
    await createGitHubReleases(packages, mockOctokit, "owner", "repo");

    //? expect
    expect(mockCore.info).toHaveBeenCalledWith("Release already exists for tag: pkg1@1.0.0");
    expect(mockOctokit.rest.repos.createRelease).not.toHaveBeenCalled();
  });

  it("test: should skip package if fails to read package.json", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/broken" }];
    mockUtils.readPackageJson.mockReturnValue(null);

    // act
    await createGitHubReleases(packages, mockOctokit, "owner", "repo");

    //? expect
    expect(mockCore.warning).toHaveBeenCalledWith(expect.stringMatching(/Failed to read package info/));
    expect(mockOctokit.rest.repos.createRelease).not.toHaveBeenCalled();
  });

  it("test: should skip package if missing name or version", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/incomplete" }];
    mockUtils.readPackageJson.mockReturnValue({ name: "pkg", version: undefined });

    // act
    await createGitHubReleases(packages, mockOctokit, "owner", "repo");

    //? expect
    expect(mockCore.warning).toHaveBeenCalled();
  });

  it("test: should use changelog section as release body", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
    });
    mockUtils.readChangelog.mockReturnValue("## 1.0.0\n- Feature A\n- Bug fix B");
    mockUtils.extractChangelogSection.mockReturnValue("- Feature A\n- Bug fix B");
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await createGitHubReleases(packages, mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.repos.createRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("- Feature A"),
      })
    );
  });

  it("test: should use placeholder when changelog not found", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
    });
    mockUtils.readChangelog.mockReturnValue("");
    mockUtils.extractChangelogSection.mockReturnValue("");
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await createGitHubReleases(packages, mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.repos.createRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Release pkg1@1.0.0"),
      })
    );
  });

  it("test: should handle scoped package names", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/scoped" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "@my-org/my-package",
      version: "2.3.4",
    });
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await createGitHubReleases(packages, mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.repos.createRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        tag_name: "@my-org/my-package@2.3.4",
        name: "@my-org/my-package@2.3.4",
      })
    );
  });

  it("test: should log info when creating release", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
    });
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await createGitHubReleases(packages, mockOctokit, "owner", "repo");

    //? expect
    expect(mockCore.info).toHaveBeenCalledWith("Creating GitHub releases for updated packages...");
    expect(mockCore.info).toHaveBeenCalledWith("Creating release: pkg1@1.0.0");
  });

  it("test: should handle 404 error as expected when checking existing release", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
    });
    const notFoundError = new Error("404 Not Found");
    mockOctokit.rest.repos.getReleaseByTag.mockRejectedValue(notFoundError);
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await createGitHubReleases(packages, mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.repos.createRelease).toHaveBeenCalled();
  });

  it("test: should warn but continue on unexpected error checking release", async () => {
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
    const unexpectedError = new Error("Unexpected API error");
    let callCount = 0;
    mockOctokit.rest.repos.getReleaseByTag.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        throw unexpectedError;
      }
      throw new Error("Not Found");
    });
    mockUtils.normalizeWhitespace.mockImplementation((s) => s);

    // act
    await createGitHubReleases(packages, mockOctokit, "owner", "repo");

    //? expect
    expect(mockCore.warning).toHaveBeenCalledWith(expect.stringMatching(/Error checking for existing release/));
  });

  it("test: should collapse multiple newlines in release body", async () => {
    // arrange
    const packages: UpdatedPackage[] = [{ dir: "packages/pkg1" }];
    mockUtils.readPackageJson.mockReturnValue({
      name: "pkg1",
      version: "1.0.0",
    });
    mockUtils.readChangelog.mockReturnValue("## 1.0.0\n\n\n- Feature");
    mockUtils.extractChangelogSection.mockReturnValue("- Feature");
    // Mock normalizeWhitespace to actually collapse newlines
    mockUtils.normalizeWhitespace.mockImplementation((s) => s.replace(/\n\n+/g, "\n"));

    // act
    await createGitHubReleases(packages, mockOctokit, "owner", "repo");

    //? expect
    expect(mockOctokit.rest.repos.createRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringMatching(/^\S/),
      })
    );
  });
});
