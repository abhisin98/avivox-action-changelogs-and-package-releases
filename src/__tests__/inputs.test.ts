// Tests for src/inputs.ts

import * as core from "@actions/core";

import { parseInputs } from "../inputs";

// Mock @actions/core module
jest.mock("@actions/core");
const mockCore = core as jest.Mocked<typeof core>;

// ====================================================================
describe("ParseInputs test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default mock returns that satisfy validation
    mockCore.getInput.mockImplementation((name: string) => {
      // Return defaults that match action.yml
      const defaults: Record<string, string> = {
        "release-type": "auto",
        "package-manager": "pnpm",
        "package-access": "public",
        "pr-number": "",
        "head-sha": "",
        "commit-message": "chore(release): publish package versions and changelogs [skip ci]",
        "github-token": "",
        "publish-package-tag": "",
        "publish-extra-args": "",
      };
      return defaults[name] || "";
    });
    mockCore.getBooleanInput.mockReturnValue(false);
  });

  it("test: should parse all inputs with defaults when no inputs provided", () => {
    // arrange - mocks already set to defaults

    // act
    const result = parseInputs();

    //? expect
    expect(result).toEqual({
      releaseType: "auto",
      prNumber: "",
      headSha: "",
      commitAndPush: false,
      createRelease: false,
      commitMessage: "chore(release): publish package versions and changelogs [skip ci]",
      githubToken: "",
      publishPackages: false,
      packageManager: "pnpm",
      packageAccess: "public",
      publishPackageTag: "",
      publishExtraArgs: "",
    });
  });

  it("test: should normalize release-type to lowercase", () => {
    // arrange
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "release-type") return "MAJOR";
      if (name === "package-manager") return "pnpm";
      if (name === "package-access") return "public";
      return "";
    });

    // act
    const result = parseInputs();

    //? expect
    expect(result.releaseType).toBe("major");
  });

  it("test: should parse valid release-type values", () => {
    // arrange
    const validTypes = ["auto", "major", "minor", "patch", "beta", "canary"];

    for (const releaseType of validTypes) {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === "release-type") return releaseType;
        if (name === "package-manager") return "pnpm";
        if (name === "package-access") return "public";
        return "";
      });

      // act
      const result = parseInputs();

      //? expect
      expect(result.releaseType).toBe(releaseType);
    }
  });

  it("test: should throw error for invalid release-type", () => {
    // arrange
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "release-type") return "invalid-type";
      if (name === "package-manager") return "pnpm";
      if (name === "package-access") return "public";
      return "";
    });

    // act & expect
    expect(() => {
      parseInputs();
    }).toThrow("Invalid release-type: invalid-type");
  });

  it("test: should throw error for invalid package-manager", () => {
    // arrange
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "package-manager") return "invalid-manager";
      if (name === "package-access") return "public";
      return "";
    });

    // act & expect
    expect(() => {
      parseInputs();
    }).toThrow("Invalid package-manager: invalid-manager");
  });

  it("test: should parse valid package-manager values", () => {
    // arrange
    const validManagers = ["pnpm", "npm", "yarn"];

    for (const manager of validManagers) {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === "package-manager") return manager;
        if (name === "package-access") return "public";
        return "";
      });

      // act
      const result = parseInputs();

      //? expect
      expect(result.packageManager).toBe(manager);
    }
  });

  it("test: should normalize package-manager to lowercase", () => {
    // arrange
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "package-manager") return "PNPM";
      if (name === "package-access") return "public";
      return "";
    });

    // act
    const result = parseInputs();

    //? expect
    expect(result.packageManager).toBe("pnpm");
  });

  it("test: should throw error for invalid package-access", () => {
    // arrange
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "package-manager") return "pnpm";
      if (name === "package-access") return "invalid-access";
      return "";
    });

    // act & expect
    expect(() => {
      parseInputs();
    }).toThrow("Invalid package-access: invalid-access");
  });

  it("test: should parse valid package-access values", () => {
    // arrange
    const validAccess = ["public", "restricted"];

    for (const access of validAccess) {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === "package-access") return access;
        if (name === "package-manager") return "pnpm";
        return "";
      });

      // act
      const result = parseInputs();

      //? expect
      expect(result.packageAccess).toBe(access);
    }
  });

  it("test: should parse pr-number and head-sha from inputs", () => {
    // arrange
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "pr-number") return "123";
      if (name === "head-sha") return "abc123def456";
      if (name === "package-manager") return "pnpm";
      if (name === "package-access") return "public";
      return "";
    });

    // act
    const result = parseInputs();

    //? expect
    expect(result.prNumber).toBe("123");
    expect(result.headSha).toBe("abc123def456");
  });

  it("test: should parse boolean inputs correctly", () => {
    // arrange
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "package-manager") return "pnpm";
      if (name === "package-access") return "public";
      return "";
    });
    mockCore.getBooleanInput.mockImplementation((name: string) => {
      if (name === "commit-and-push") return true;
      if (name === "create-release") return true;
      if (name === "publish-packages") return true;
      return false;
    });

    // act
    const result = parseInputs();

    //? expect
    expect(result.commitAndPush).toBe(true);
    expect(result.createRelease).toBe(true);
    expect(result.publishPackages).toBe(true);
  });

  it("test: should parse commit-message and github-token", () => {
    // arrange
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "commit-message") return "Bump versions and update changelogs";
      if (name === "github-token") return "ghp_token123";
      if (name === "package-manager") return "pnpm";
      if (name === "package-access") return "public";
      return "";
    });

    // act
    const result = parseInputs();

    //? expect
    expect(result.commitMessage).toBe("Bump versions and update changelogs");
    expect(result.githubToken).toBe("ghp_token123");
  });

  it("test: should parse publish-package-tag and publish-extra-args", () => {
    // arrange
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "publish-package-tag") return "beta";
      if (name === "publish-extra-args") return "--dry-run --verbose";
      if (name === "package-manager") return "pnpm";
      if (name === "package-access") return "public";
      return "";
    });

    // act
    const result = parseInputs();

    //? expect
    expect(result.publishPackageTag).toBe("beta");
    expect(result.publishExtraArgs).toBe("--dry-run --verbose");
  });

  it("test: should handle full realistic input set", () => {
    // arrange
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        "release-type": "minor",
        "pr-number": "42",
        "head-sha": "deadbeef1234567890abcdef",
        "commit-message": "chore: bump versions",
        "github-token": "ghp_xxxxx",
        "package-manager": "pnpm",
        "package-access": "public",
        "publish-package-tag": "latest",
        "publish-extra-args": "--access public",
      };
      return inputs[name] ?? "";
    });

    mockCore.getBooleanInput.mockImplementation((name: string) => {
      const boolInputs: Record<string, boolean> = {
        "commit-and-push": true,
        "create-release": true,
        "publish-packages": true,
      };
      return boolInputs[name] ?? false;
    });

    // act
    const result = parseInputs();

    //? expect
    expect(result.releaseType).toBe("minor");
    expect(result.prNumber).toBe("42");
    expect(result.headSha).toBe("deadbeef1234567890abcdef");
    expect(result.commitAndPush).toBe(true);
    expect(result.createRelease).toBe(true);
    expect(result.commitMessage).toBe("chore: bump versions");
    expect(result.githubToken).toBe("ghp_xxxxx");
    expect(result.publishPackages).toBe(true);
    expect(result.packageManager).toBe("pnpm");
    expect(result.packageAccess).toBe("public");
    expect(result.publishPackageTag).toBe("latest");
    expect(result.publishExtraArgs).toBe("--access public");
  });

  it("test: should handle missing required inputs gracefully", () => {
    // arrange
    mockCore.getInput.mockImplementation((name: string) => {
      // Provide defaults for required inputs
      if (name === "package-manager") return "pnpm";
      if (name === "package-access") return "public";
      return ""; // Other inputs can be empty
    });

    // act
    const result = parseInputs();

    //? expect
    expect(result).toBeDefined();
    expect(result.releaseType).toBe("auto"); // Default value
    expect(result.prNumber).toBe("");
  });

  it("test: should call getInput for each input field", () => {
    // arrange
    mockCore.getInput.mockImplementation((name: string) => {
      // Provide defaults for required inputs
      if (name === "package-manager") return "pnpm";
      if (name === "package-access") return "public";
      return "";
    });

    // act
    parseInputs();

    //? expect
    expect(mockCore.getInput).toHaveBeenCalledWith("release-type");
    expect(mockCore.getInput).toHaveBeenCalledWith("package-manager");
    expect(mockCore.getInput).toHaveBeenCalledWith("package-access");
    expect(mockCore.getInput).toHaveBeenCalledWith("pr-number");
    expect(mockCore.getInput).toHaveBeenCalledWith("head-sha");
    expect(mockCore.getInput).toHaveBeenCalledWith("commit-message");
    expect(mockCore.getInput).toHaveBeenCalledWith("github-token");
    expect(mockCore.getInput).toHaveBeenCalledWith("publish-package-tag");
    expect(mockCore.getInput).toHaveBeenCalledWith("publish-extra-args");
  });

  it("test: should call getBooleanInput for boolean fields", () => {
    // arrange
    mockCore.getBooleanInput.mockReturnValue(false);

    // act
    parseInputs();

    //? expect
    expect(mockCore.getBooleanInput).toHaveBeenCalledWith("commit-and-push");
    expect(mockCore.getBooleanInput).toHaveBeenCalledWith("create-release");
    expect(mockCore.getBooleanInput).toHaveBeenCalledWith("publish-packages");
  });
});
