/*
 * Copyright (C) 2022 Pegasus Spiele Verlags- und Medienvertriebsgesellschaft mbH, all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 */

import { GITHUB_ORG_NAME } from "../constants.ts";
import { GitHubApiRequest } from "../github.ts";

export async function fetchGitHubPackageVersions(
  GitHubPackageName: string,
  // deno-lint-ignore no-explicit-any
  _GitHubPackageVersions: Record<string, any>[] = [],
  page = 1,
  // deno-lint-ignore no-explicit-any
): Promise<Record<string, any>[]> {
  console.log(`Batch (${page}) - fetching package versions for package (${GitHubPackageName})`);

  const GitHubPackageVersionsResponse = await GitHubApiRequest(
    `https://api.github.com/orgs/${GITHUB_ORG_NAME}/packages/container/${GitHubPackageName}/versions?per_page=100&page=${page}`,
  );

  const GitHubPackageVersions = await GitHubPackageVersionsResponse.json();
  _GitHubPackageVersions.push(...GitHubPackageVersions);

  if (GitHubPackageVersions.length === 100) {
    _GitHubPackageVersions.push(await fetchGitHubPackageVersions(GitHubPackageName, _GitHubPackageVersions, ++page));
  }

  return _GitHubPackageVersions;
}
