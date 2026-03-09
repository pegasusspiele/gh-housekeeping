/*
 * Copyright (C) 2022 - 2026 Pegasus Spiele Verlags- und Medienvertriebsgesellschaft mbH, all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Updated in 2026 by Codex (GPT-5).
 */

import { GITHUB_ORG_NAME } from "./constants.ts";
import { GitHubPackage } from "./structures/GitHubPackage.ts";

async function run(): Promise<void> {
  const packages = await GitHubPackage.fetchPackagesForOrganization(GITHUB_ORG_NAME);

  for (const gitHubPackage of packages) {
    const packageVersions = await gitHubPackage.fetchGitHubPackageVersions();
    const deletableVersions = gitHubPackage.deletablePackageVersions;

    console.log(`Found ${packageVersions.length} versions of package (${gitHubPackage.name}). ${deletableVersions.length} versions will be deleted.`);

    await gitHubPackage.deletePackageVersions(deletableVersions);
    console.log("");
  }
}

if (import.meta.main) {
  try {
    await run();
  } catch (error) {
    console.error("housekeeping failed", error);
    Deno.exit(1);
  }
}
