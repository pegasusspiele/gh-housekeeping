/*
 * Copyright (C) 2022 - 2023 Pegasus Spiele Verlags- und Medienvertriebsgesellschaft mbH, all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 */

import { DAYS_TO_DELETE } from "../constants.ts";
import { GitHubApiRequest } from "../github.ts";

/* TYPINGS */
// deno-lint-ignore no-explicit-any
type GitHubPackageData = Record<string, any>;
// deno-lint-ignore no-explicit-any
type GitHubPackageVersion = Record<string, any>;

export class GitHubPackage {
  name: string;
  versions: GitHubPackageVersion[] = [];

  constructor(public data: GitHubPackageData) {
    this.name = data.name;
  }

  public static async fetchPackagesForOrganization(_organizationName: string): Promise<GitHubPackage[]> {
    const GitHubApiResponse = await GitHubApiRequest(`https://api.github.com/orgs/${_organizationName}/packages?package_type=container`);

    return (await GitHubApiResponse.json()).map((_GitHubPackageData: GitHubPackageData) => new GitHubPackage(_GitHubPackageData));
  }

  public async fetchGitHubPackageVersions(page = 1): Promise<GitHubPackageVersion[]> {
    console.log(`Batch (${page}) - fetching package versions for package (${this.name})`);

    const GitHubPackageVersionsResponse = await GitHubApiRequest(
      `https://api.github.com/orgs/${this.data.owner.login}/packages/container/${this.name}/versions?per_page=100&page=${page}`,
    );

    const GitHubPackageVersions = await GitHubPackageVersionsResponse.json();
    this.versions.push(...GitHubPackageVersions);

    if (GitHubPackageVersions.length === 100) {
      this.versions.push(await this.fetchGitHubPackageVersions(++page));
    }

    return this.versions;
  }

  public get deletablePackageVersions() {
    return this.versions.filter((_GitHubPackageVersion) => {
      const currentDate = new Date();

      const currentDateInMs = currentDate.valueOf();
      const ThirtyDaysInMs = 1000 * 60 * 60 * 24 * DAYS_TO_DELETE;
      const calculatedDate = new Date(currentDateInMs - ThirtyDaysInMs);

      return new Date(_GitHubPackageVersion.created_at as string) < calculatedDate && !_GitHubPackageVersion.metadata.container.tags.includes("latest");
    });
  }

  public async deletePackageVersions(_deletableGitHubPackgeVersions: GitHubPackageVersion[]): Promise<void> {
    for (const deletableGitHubPackgeVersion of _deletableGitHubPackgeVersions) {
      const GitHubApiResponse = await GitHubApiRequest(
        `https://api.github.com/orgs/${this.data.owner.login}/packages/container/${this.name}/versions/${deletableGitHubPackgeVersion.id}`,
        {
          method: "DELETE",
        },
      );

      if (GitHubApiResponse.status !== 204) {
        console.log(`error during deletion of version (${deletableGitHubPackgeVersion.id}) of package (${this.name}). error ${await GitHubApiResponse.text()}`);
        continue;
      }

      console.log(`successfully deleted version (${deletableGitHubPackgeVersion.id}) of package (${this.name})`);
    }
  }
}
