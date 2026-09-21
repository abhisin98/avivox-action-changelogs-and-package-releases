// Tests for src/utils.ts utility functions

import * as fs from "fs";

import { extractChangelogSection, parseVersion, readPackageJson, writePackageJson, normalizeWhitespace, readChangelog } from "../utils";

// Mock fs module completely
jest.mock("fs");
const mockFs = fs as jest.Mocked<typeof fs>;

// ====================================================================
describe("ParseVersion test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("test: should parse a valid semantic version string", () => {
    // arrange
    const version = "1.2.3";

    // act
    const result = parseVersion(version);

    //? expect
    expect(result).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it("test: should parse version with zeros", () => {
    // arrange
    const version = "0.0.0";

    // act
    const result = parseVersion(version);

    //? expect
    expect(result).toEqual({ major: 0, minor: 0, patch: 0 });
  });

  it("test: should parse version with large numbers", () => {
    // arrange
    const version = "10.20.300";

    // act
    const result = parseVersion(version);

    //? expect
    expect(result).toEqual({ major: 10, minor: 20, patch: 300 });
  });

  it("test: should ignore prerelease suffix and return only semver", () => {
    // arrange
    const version = "1.2.3-beta.456";

    // act
    const result = parseVersion(version);

    //? expect
    expect(result).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it("test: should return null for invalid version string", () => {
    // arrange
    const version = "not.a.version";

    // act
    const result = parseVersion(version);

    //? expect
    expect(result).toBeNull();
  });

  it("test: should return null for version with only two components", () => {
    // arrange
    const version = "1.2";

    // act
    const result = parseVersion(version);

    //? expect
    expect(result).toBeNull();
  });

  it("test: should return null for empty string", () => {
    // arrange
    const version = "";

    // act
    const result = parseVersion(version);

    //? expect
    expect(result).toBeNull();
  });

  it("test: should return null when version has non-numeric components", () => {
    // arrange
    const version = "1.2.x";

    // act
    const result = parseVersion(version);

    //? expect
    expect(result).toBeNull();
  });
});

// ====================================================================
describe("NormalizeWhitespace test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("test: should replace tabs with spaces", () => {
    // arrange
    const text = "hello\tworld";

    // act
    const result = normalizeWhitespace(text);

    //? expect
    expect(result).toBe("hello world");
  });

  it("test: should collapse multiple spaces to single space", () => {
    // arrange
    const text = "hello     world";

    // act
    const result = normalizeWhitespace(text);

    //? expect
    expect(result).toBe("hello world");
  });

  it("test: should trim leading and trailing whitespace", () => {
    // arrange
    const text = "   hello world   ";

    // act
    const result = normalizeWhitespace(text);

    //? expect
    expect(result).toBe("hello world");
  });

  it("test: should combine all normalizations together", () => {
    // arrange
    const text = "  \thello \t  world  \n  ";

    // act
    const result = normalizeWhitespace(text);

    //? expect
    expect(result).toBe("hello world");
  });

  it("test: should handle string with no whitespace", () => {
    // arrange
    const text = "helloworld";

    // act
    const result = normalizeWhitespace(text);

    //? expect
    expect(result).toBe("helloworld");
  });

  it("test: should handle empty string", () => {
    // arrange
    const text = "";

    // act
    const result = normalizeWhitespace(text);

    //? expect
    expect(result).toBe("");
  });

  it("test: should handle string with only whitespace", () => {
    // arrange
    const text = "   \t  \t   ";

    // act
    const result = normalizeWhitespace(text);

    //? expect
    expect(result).toBe("");
  });
});

// ====================================================================
describe("ExtractChangelogSection test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("test: should extract changelog section for exact version match", () => {
    // arrange
    const content = `## [1.0.0]
### Features
- New feature

## [0.9.0]
### Features
- Old feature`;
    const version = "1.0.0";

    // act
    const result = extractChangelogSection(content, version);

    //? expect
    expect(result).toContain("## [1.0.0]");
    expect(result).toContain("### Features");
    expect(result).toContain("- New feature");
    expect(result).not.toContain("Old feature");
  });

  it("test: should extract version even when it has prerelease suffix", () => {
    // arrange
    const content = `## [1.0.0]
### Features
- Feature A`;
    const version = "1.0.0-beta.123";

    // act
    const result = extractChangelogSection(content, version);

    //? expect
    expect(result).toContain("## [1.0.0]");
    expect(result).toContain("- Feature A");
  });

  it("test: should extract version for scoped packages", () => {
    // arrange
    const content = `## [@scope/package@1.0.0]
### Features
- Scoped package feature`;
    const version = "1.0.0";

    // act
    const result = extractChangelogSection(content, version);

    //? expect
    expect(result).toContain("## [@scope/package@1.0.0]");
    expect(result).toContain("Scoped package feature");
  });

  it("test: should extract version for unscoped packages with package name", () => {
    // arrange
    const content = `## [my-package@1.0.0]
### Features
- Package feature`;
    const version = "1.0.0";

    // act
    const result = extractChangelogSection(content, version);

    //? expect
    expect(result).toContain("## [my-package@1.0.0]");
    expect(result).toContain("Package feature");
  });

  it("test: should return empty string when version not found", () => {
    // arrange
    const content = `## [1.0.0]
### Features
- Feature A`;
    const version = "2.0.0";

    // act
    const result = extractChangelogSection(content, version);

    //? expect
    expect(result).toBe("");
  });

  it("test: should not match partial version numbers like 1.0.10", () => {
    // arrange
    const content = `## [1.0.10]
### Features
- Feature for 1.0.10

## [1.0.1]
### Features
- Feature for 1.0.1`;
    const version = "1.0.1";

    // act
    const result = extractChangelogSection(content, version);

    //? expect
    expect(result).toContain("Feature for 1.0.1");
    expect(result).not.toContain("1.0.10");
  });

  it("test: should return empty string for invalid version format", () => {
    // arrange
    const content = `## [1.0.0]
### Features`;
    const version = "invalid-version";

    // act
    const result = extractChangelogSection(content, version);

    //? expect
    expect(result).toBe("");
  });

  it("test: should handle multiline changelog sections", () => {
    // arrange
    const content = `## [1.0.0]
### Features
- Feature 1
- Feature 2
- Feature 3

### Bug Fixes
- Bug 1

## [0.9.0]
Other section`;
    const version = "1.0.0";

    // act
    const result = extractChangelogSection(content, version);

    //? expect
    expect(result).toContain("## [1.0.0]");
    expect(result).toContain("Feature 1");
    expect(result).toContain("Bug 1");
    expect(result).not.toContain("[0.9.0]");
  });
});

// ====================================================================
describe("ReadPackageJson test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("test: should read and parse valid package.json file", () => {
    // arrange
    const filePath = "/path/to/package.json";
    const mockContent = '{"name":"my-package","version":"1.0.0"}';
    (mockFs.existsSync as jest.Mock).mockReturnValue(true);
    (mockFs.readFileSync as jest.Mock).mockReturnValue(mockContent);

    // act
    const result = readPackageJson(filePath);

    //? expect
    expect(result).toEqual({ name: "my-package", version: "1.0.0" });
    expect(mockFs.existsSync).toHaveBeenCalledWith(filePath);
    expect(mockFs.readFileSync).toHaveBeenCalledWith(filePath, "utf-8");
  });

  it("test: should return null when file does not exist", () => {
    // arrange
    const filePath = "/nonexistent/package.json";
    (mockFs.existsSync as jest.Mock).mockReturnValue(false);

    // act
    const result = readPackageJson(filePath);

    //? expect
    expect(result).toBeNull();
    expect(mockFs.existsSync).toHaveBeenCalledWith(filePath);
    expect(mockFs.readFileSync).not.toHaveBeenCalled();
  });

  it("test: should return null when file contains invalid JSON", () => {
    // arrange
    const filePath = "/path/to/package.json";
    const mockContent = "{invalid json}";
    (mockFs.existsSync as jest.Mock).mockReturnValue(true);
    (mockFs.readFileSync as jest.Mock).mockReturnValue(mockContent);

    // act
    const result = readPackageJson(filePath);

    //? expect
    expect(result).toBeNull();
  });

  it("test: should handle package.json with complex nested structure", () => {
    // arrange
    const filePath = "/path/to/package.json";
    const mockContent = '{"name":"my-package","version":"1.0.0","scripts":{"test":"jest"},"dependencies":{"lodash":"^4.0.0"}}';
    (mockFs.existsSync as jest.Mock).mockReturnValue(true);
    (mockFs.readFileSync as jest.Mock).mockReturnValue(mockContent);

    // act
    const result = readPackageJson(filePath);

    //? expect
    expect(result).toEqual({
      name: "my-package",
      version: "1.0.0",
      scripts: { test: "jest" },
      dependencies: { lodash: "^4.0.0" },
    });
  });
});

// ====================================================================
describe("WritePackageJson test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("test: should write package.json with 2-space indentation", () => {
    // arrange
    const filePath = "/path/to/package.json";
    const content = { name: "my-package", version: "2.0.0" };

    // act
    writePackageJson(filePath, content);

    //? expect
    const expectedContent = '{\n  "name": "my-package",\n  "version": "2.0.0"\n}\n';
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(filePath, expectedContent, "utf-8");
  });

  it("test: should write complex nested object correctly", () => {
    // arrange
    const filePath = "/path/to/package.json";
    const content = {
      name: "my-package",
      version: "1.0.0",
      scripts: { test: "jest", build: "tsc" },
      dependencies: { lodash: "^4.0.0" },
    };

    // act
    writePackageJson(filePath, content);

    //? expect
    expect(mockFs.writeFileSync).toHaveBeenCalled();
    const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
    expect(writtenContent).toContain('"name": "my-package"');
    expect(writtenContent).toContain('"version": "1.0.0"');
    expect(writtenContent).toContain('"scripts"');
    expect(writtenContent).toContain('"dependencies"');
    expect(writtenContent).toMatch(/\n/); // Should have newlines for formatting
  });

  it("test: should include trailing newline", () => {
    // arrange
    const filePath = "/path/to/package.json";
    const content = { name: "test", version: "1.0.0" };

    // act
    writePackageJson(filePath, content);

    //? expect
    const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
    expect(writtenContent).toMatch(/\n$/);
  });

  it("test: should handle empty object", () => {
    // arrange
    const filePath = "/path/to/package.json";
    const content: Record<string, unknown> = {};

    // act
    writePackageJson(filePath, content);

    //? expect
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(filePath, "{}\n", "utf-8");
  });
});

// ====================================================================
describe("ReadChangelog test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("test: should read changelog file content", () => {
    // arrange
    const filePath = "/path/to/CHANGELOG.md";
    const mockContent = "# Changelog\n\n## [1.0.0]\nFirst release";
    (mockFs.existsSync as jest.Mock).mockReturnValue(true);
    (mockFs.readFileSync as jest.Mock).mockReturnValue(mockContent);

    // act
    const result = readChangelog(filePath);

    //? expect
    expect(result).toBe(mockContent);
    expect(mockFs.existsSync).toHaveBeenCalledWith(filePath);
    expect(mockFs.readFileSync).toHaveBeenCalledWith(filePath, "utf-8");
  });

  it("test: should return empty string when file does not exist", () => {
    // arrange
    const filePath = "/nonexistent/CHANGELOG.md";
    (mockFs.existsSync as jest.Mock).mockReturnValue(false);

    // act
    const result = readChangelog(filePath);

    //? expect
    expect(result).toBe("");
    expect(mockFs.readFileSync).not.toHaveBeenCalled();
  });

  it("test: should handle large changelog files", () => {
    // arrange
    const filePath = "/path/to/CHANGELOG.md";
    const largeContent = "## [1.0.0]\n" + "- Item\n".repeat(1000);
    (mockFs.existsSync as jest.Mock).mockReturnValue(true);
    (mockFs.readFileSync as jest.Mock).mockReturnValue(largeContent);

    // act
    const result = readChangelog(filePath);

    //? expect
    expect(result).toBe(largeContent);
    expect(result.split("\n").length).toBeGreaterThan(1000);
  });
});
