/*
 * Copyright (C) 2022 Pegasus Spiele Verlags- und Medienvertriebsgesellschaft mbH, all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 */

export const GitHubApiRequest = (path: string, options?: RequestInit) => {
  return fetch(path, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${Deno.env.get("GITHUB_ACCESS_TOKEN")}`,
    },
    ...options,
  });
};
