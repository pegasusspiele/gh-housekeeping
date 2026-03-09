/*
 * Copyright (C) 2022 - 2026 Pegasus Spiele Verlags- und Medienvertriebsgesellschaft mbH, all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Updated in 2026 by Codex (GPT-5).
 */

const GITHUB_API_BASE_URL = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

function createDefaultHeaders(): HeadersInit {
  const token = Deno.env.get("GITHUB_ACCESS_TOKEN");

  if (!token) {
    throw new Error("Missing environment variable: GITHUB_ACCESS_TOKEN");
  }

  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function gitHubApiRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${GITHUB_API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...createDefaultHeaders(),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new GitHubApiError(`GitHub API request failed: ${options.method ?? "GET"} ${url}`, response.status, details);
  }

  return response;
}

export async function gitHubApiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await gitHubApiRequest(path, options);
  return (await response.json()) as T;
}
