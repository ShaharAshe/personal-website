# The image for npm run test:e2e:linux (Task 2.20): CI's e2e step, mirrored locally on Linux.
# Built by scripts/e2e-linux/run.ts with this folder as the context (the repo is bind-mounted at run time, never copied).
#
# - The official Playwright image at the lockfile's @playwright/test version: its browsers match that version exactly.
# - Node from .nvmrc, like CI's setup-node (the Playwright image ships a newer Node). bookworm's glibc (2.36) is older
#   than noble's (2.39), so the copied binary runs here.
# - fonts-liberation, the font package CI installs, and CI's check that Arial resolves to Liberation Sans.

ARG PLAYWRIGHT_VERSION
ARG NODE_MAJOR

FROM node:${NODE_MAJOR}-bookworm-slim AS node

FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble

ARG NODE_MAJOR

# /usr/local/bin comes before the image's /usr/bin on PATH, so these win.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
  && node --version | grep -q "^v${NODE_MAJOR}\." \
  || { echo "node $(node --version) is not Node ${NODE_MAJOR}"; exit 1; }

# The same packages, retries and timeout as deploy.yml's "Install LibreOffice and Liberation fonts" step, minus
# LibreOffice (only the resume build needs it, and that runs on Windows here).
RUN apt-get update -o Acquire::Retries=3 -o Acquire::http::Timeout=30 \
  && apt-get install -y --no-install-recommends -o Acquire::Retries=3 -o Acquire::http::Timeout=30 fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

# deploy.yml's "Check Arial resolves to Liberation Sans".
RUN match="$(fc-match Arial)" && echo "fc-match Arial: $match" \
  && case "$match" in *'"Liberation Sans"'*) ;; *) echo "Arial must resolve to Liberation Sans"; exit 1 ;; esac
