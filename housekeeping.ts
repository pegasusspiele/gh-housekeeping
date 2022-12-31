/*
 * Copyright (C) 2022 - 2023 Pegasus Spiele Verlags- und Medienvertriebsgesellschaft mbH, all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 */

import "https://deno.land/x/dotenv@v3.2.0/load.ts";
import { GITHUB_ORG_NAME } from "./constants.ts";
import { GitHubPackage } from "./structures/GitHubPackage.ts";

const GitHubPackages = await GitHubPackage.fetchPackagesForOrganization(GITHUB_ORG_NAME);

for (const _GitHubPackage of GitHubPackages) {
  const GitHubPackageVersions = await _GitHubPackage.fetchGitHubPackageVersions();
  const deletableGitHubPackgeVersions = _GitHubPackage.deletablePackageVersions;

  console.log(
    `Found ${GitHubPackageVersions.length} versions of package (${_GitHubPackage.name}). ${deletableGitHubPackgeVersions.length} versions will be deleted.`,
  );

  await _GitHubPackage.deletePackageVersions(deletableGitHubPackgeVersions);

  console.log("\n\n");
}
