#!/usr/bin/env node

import fs from "node:fs";

const allowedTypes = new Set([
  "feat",
  "fix",
  "docs",
  "refactor",
  "test",
  "chore",
  "build",
  "ci",
  "perf",
  "revert",
]);

const commitMessagePath = process.argv[2];

if (!commitMessagePath) {
  console.error("Usage: check-commit-message.mjs <commit-message-file>");
  process.exit(1);
}

const rawMessage = fs.readFileSync(commitMessagePath, "utf8");
const firstLine = rawMessage
  .split("\n")
  .map((line) => line.trim())
  .find((line) => line.length > 0 && !line.startsWith("#"));

if (!firstLine) {
  console.error("Commit message is empty.");
  process.exit(1);
}

const conventionalCommitPattern =
  /^(?<type>[a-z]+)(\((?<scope>[a-z0-9-_/]+)\))?(?<breaking>!)?: (?<summary>.+)$/;

const match = firstLine.match(conventionalCommitPattern);
if (!match?.groups) {
  console.error(
    "Commit message must follow Conventional Commits: type(scope): summary",
  );
  process.exit(1);
}

const { type, summary } = match.groups;

if (!allowedTypes.has(type)) {
  console.error(
    `Commit type "${type}" is not allowed. Use one of: ${[...allowedTypes].join(", ")}`,
  );
  process.exit(1);
}

if (summary.length < 5) {
  console.error("Commit summary is too short.");
  process.exit(1);
}

if (/^[A-Z]/.test(summary)) {
  console.error("Commit summary should start with lowercase for consistency.");
  process.exit(1);
}
