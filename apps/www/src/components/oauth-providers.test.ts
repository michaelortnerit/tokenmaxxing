import { describe, expect, it } from "vitest";

import { oauthProviderLinks } from "./oauth-providers";

describe("oauthProviderLinks", () => {
  it("builds provider links without a redirect", () => {
    const [github, google] = oauthProviderLinks();
    if (github === undefined) {
      throw new Error("expected GitHub provider");
    }
    if (google === undefined) {
      throw new Error("expected Google provider");
    }

    expect(github.id).toBe("github");
    expect(github.label).toBe("Continue with GitHub");
    expect(google.id).toBe("google");
    expect(google.label).toBe("Continue with Google");

    const githubUrl = new URL(github.href);
    expect(githubUrl.pathname).toBe("/auth/github/start");
    expect(githubUrl.searchParams.get("redirect")).toBeNull();

    const googleUrl = new URL(google.href);
    expect(googleUrl.pathname).toBe("/auth/google/start");
    expect(googleUrl.searchParams.get("redirect")).toBeNull();
  });

  it("keeps the CLI login redirect on provider links", () => {
    const [github, google] = oauthProviderLinks({ redirect: "/login/cli?code=ABCD-1234" });
    if (github === undefined) {
      throw new Error("expected GitHub provider");
    }
    if (google === undefined) {
      throw new Error("expected Google provider");
    }

    const githubUrl = new URL(github.href);
    const googleUrl = new URL(google.href);

    expect(githubUrl.pathname).toBe("/auth/github/start");
    expect(githubUrl.searchParams.get("redirect")).toBe("/login/cli?code=ABCD-1234");
    expect(googleUrl.pathname).toBe("/auth/google/start");
    expect(googleUrl.searchParams.get("redirect")).toBe("/login/cli?code=ABCD-1234");
  });
});
