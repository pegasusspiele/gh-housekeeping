/*
 * Copyright (C) 2022 Pegasus Spiele Verlags- und Medienvertriebsgesellschaft mbH, all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 */

import "https://deno.land/x/dotenv@v3.2.0/load.ts";
import { DAYS_TO_DELETE, GITHUB_ORG_NAME } from "./constants.ts";
import { GitHubApiRequest } from "./github.ts";
import { fetchGitHubPackageVersions } from "./utils/fetchGitHubPackageVersions.ts";

const GitHubPackagesResponse = await GitHubApiRequest(`https://api.github.com/orgs/${GITHUB_ORG_NAME}/packages?package_type=container`, {
  method: "GET",
});

const GitHubPackages: Record<string, unknown>[] = await GitHubPackagesResponse.json();

for (const GitHubPackage of GitHubPackages) {
  const GitHubPackageVersions = await fetchGitHubPackageVersions(GitHubPackage.name as string);

  const deletableGitHubPackgeVersions = GitHubPackageVersions.filter((GitHubPackageVersion) => {
    const currentDate = new Date();

    const currentDateInMs = currentDate.valueOf();
    const ThirtyDaysInMs = 1000 * 60 * 60 * 24 * DAYS_TO_DELETE;
    const calculatedDate = new Date(currentDateInMs - ThirtyDaysInMs);

    return new Date(GitHubPackageVersion.created_at as string) < calculatedDate && !GitHubPackageVersion.metadata.container.tags.includes("latest");
  });

  console.log(
    `Found ${GitHubPackageVersions.length} versions of package (${GitHubPackage.name}). ${deletableGitHubPackgeVersions.length} versions will be deleted.`,
  );

  for (const GitHubPackdeletableGitHubPackgeVersion of deletableGitHubPackgeVersions) {
    console.log(GitHubPackdeletableGitHubPackgeVersion);
    const GitHubApiResponse = await GitHubApiRequest(
      `https://api.github.com/orgs/${GITHUB_ORG_NAME}/packages/container/${GitHubPackage.name}/versions/${GitHubPackdeletableGitHubPackgeVersion.id}`,
      {
        method: "DELETE",
      },
    );

    if (GitHubApiResponse.status !== 204) {
      console.log(
        `error during deletion of version (${GitHubPackdeletableGitHubPackgeVersion.id}) of package (${
          GitHubPackage.name
        }). error ${await GitHubApiResponse.text()}`,
      );
      continue;
    }

    console.log(`successfully deleted version (${GitHubPackdeletableGitHubPackgeVersion.id}) of package (${GitHubPackage.name})`);
  }
  console.log("\n\n");
}
