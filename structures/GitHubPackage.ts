/*
 * Copyright (C) 2022 - 2026 Pegasus Spiele Verlags- und Medienvertriebsgesellschaft mbH, all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Updated in 2026 by Codex (GPT-5).
 */

import { DAYS_TO_DELETE } from "../constants.ts";
import { gitHubApiJson, gitHubApiRequest } from "../github.ts";

interface GitHubOwner {
  login: string;
}

interface GitHubPackageData {
  name: string;
  owner: GitHubOwner;
}

interface GitHubContainerMetadata {
  container?: {
    tags?: string[];
  };
}

export interface GitHubPackageVersion {
  id: number;
  created_at: string;
  metadata: GitHubContainerMetadata;
}

export class GitHubPackage {
  public readonly name: string;
  public readonly organizationName: string;
  public versions: GitHubPackageVersion[] = [];

  constructor(public readonly data: GitHubPackageData) {
    this.name = data.name;
    this.organizationName = data.owner.login;
  }

  public static async fetchPackagesForOrganization(organizationName: string): Promise<GitHubPackage[]> {
    const allPackages: GitHubPackage[] = [];
    let page = 1;

    while (true) {
      const packagePage = await gitHubApiJson<GitHubPackageData[]>(`/orgs/${organizationName}/packages?package_type=container&per_page=100&page=${page}`);

      if (packagePage.length === 0) {
        break;
      }

      allPackages.push(...packagePage.map((packageData) => new GitHubPackage(packageData)));

      if (packagePage.length < 100) {
        break;
      }

      page += 1;
    }

    return allPackages;
  }

  public async fetchGitHubPackageVersions(): Promise<GitHubPackageVersion[]> {
    this.versions = [];
    let page = 1;

    while (true) {
      console.log(`Batch (${page}) - fetching package versions for package (${this.name})`);

      const versionPage = await gitHubApiJson<GitHubPackageVersion[]>(
        `/orgs/${this.organizationName}/packages/container/${this.name}/versions?per_page=100&page=${page}`,
      );

      this.versions.push(...versionPage);

      if (versionPage.length < 100) {
        break;
      }

      page += 1;
    }

    return this.versions;
  }

  public get deletablePackageVersions(): GitHubPackageVersion[] {
    const now = Date.now();
    const maxAgeInMs = DAYS_TO_DELETE * 24 * 60 * 60 * 1000;
    const deleteBefore = now - maxAgeInMs;

    return this.versions.filter((packageVersion) => {
      const tags = packageVersion.metadata.container?.tags ?? [];
      const isLatest = tags.includes("latest");

      return new Date(packageVersion.created_at).valueOf() < deleteBefore && !isLatest;
    });
  }

  public async deletePackageVersions(deletableVersions: GitHubPackageVersion[]): Promise<void> {
    for (const packageVersion of deletableVersions) {
      try {
        await gitHubApiRequest(`/orgs/${this.organizationName}/packages/container/${this.name}/versions/${packageVersion.id}`, { method: "DELETE" });
        console.log(`successfully deleted version (${packageVersion.id}) of package (${this.name})`);
      } catch (error) {
        console.error(`error during deletion of version (${packageVersion.id}) of package (${this.name})`, error);
      }
    }
  }
}
