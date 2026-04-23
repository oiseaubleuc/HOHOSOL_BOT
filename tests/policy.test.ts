import { describe, expect, it } from "vitest";
import { policyForAction } from "../src/modules/developer-control/policy.js";

describe("developer-control policy", () => {
  it("requires approval for installs and git push class actions", () => {
    expect(policyForAction("INSTALL_DEPENDENCIES")).toBe("requires_approval");
    expect(policyForAction("GIT_COMMIT")).toBe("requires_approval");
    expect(policyForAction("KILL_PORT")).toBe("requires_approval");
    expect(policyForAction("CREATE_FOLDER")).toBe("requires_approval");
  });

  it("allows read-only style actions", () => {
    expect(policyForAction("GIT_STATUS")).toBe("allow");
    expect(policyForAction("GIT_DIFF")).toBe("allow");
    expect(policyForAction("OPEN_MAC_APP")).toBe("allow");
    expect(policyForAction("LIST_PROJECTS")).toBe("allow");
  });
});
