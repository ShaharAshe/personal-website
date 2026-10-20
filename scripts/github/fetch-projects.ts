// Fetches the public GitHub repos for the GitHub profile in src/data/resume.yaml and writes the
// portfolio tiers to src/data/projects.json (generated, gitignored). Exits non-zero on an API error,
// a missing description on a featured/portfolio repo, or a missing/unparseable GitHub profile URL,
// so a bad fetch fails the build and the live site stays.
//
// Usage: node scripts/github/fetch-projects.ts [path/to/projects.json]
// Env:   GITHUB_TOKEN   optional; used if set (CI), unauthenticated otherwise (60 requests/hour)
//        GITHUB_API_URL optional; defaults to https://api.github.com (tests point it at a fake server)

import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_API_URL,
  GitHubApiError,
  GitHubProfileError,
  MissingDescriptionError,
  fetchProjects,
  readGitHubUser,
} from './projects.ts';
import type { ProjectsData } from './projects.ts';

const outputPath = process.argv[2] || path.join(import.meta.dirname, '..', '..', 'src', 'data', 'projects.json');
const token = process.env.GITHUB_TOKEN || undefined;

let user: string;
let data: ProjectsData;
try {
  user = readGitHubUser();
  if (!token) console.log('GITHUB_TOKEN not set; calling the GitHub API unauthenticated.');
  data = await fetchProjects(user, { token, apiUrl: process.env.GITHUB_API_URL || DEFAULT_API_URL });
} catch (error) {
  if (
    error instanceof GitHubProfileError ||
    error instanceof GitHubApiError ||
    error instanceof MissingDescriptionError
  ) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const total = data.featured.length + data.portfolio.length + data.practice.length;
if (total === 0) {
  console.warn(
    `Warning: no repos for ${user} have a portfolio-featured, portfolio or portfolio-practice topic. ` +
      'Writing an empty project list.',
  );
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);

console.log(`Wrote ${outputPath} (GitHub user ${user}, from resume.yaml)`);
for (const tier of ['featured', 'portfolio', 'practice'] as const) {
  console.log(`  ${tier}: ${data[tier].map((repo) => repo.name).join(', ') || '(none)'}`);
}
