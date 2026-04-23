import { describe, expect, it } from "vitest";
import { sanitizeBrowserUrl, youtubeSearchResultsUrl, githubSearchResultsUrl } from "../src/modules/system/sanitizeUrl.js";

describe("sanitizeUrl + search builders", () => {
  it("accepts YouTube results URL from builder", () => {
    const u = youtubeSearchResultsUrl("rust wasm");
    expect(sanitizeBrowserUrl(u)).toContain("youtube.com/results");
    expect(sanitizeBrowserUrl(u)).toContain("search_query");
  });

  it("accepts GitHub search URL from builder", () => {
    const u = githubSearchResultsUrl("vitest");
    expect(sanitizeBrowserUrl(u)).toContain("github.com/search");
  });
});
