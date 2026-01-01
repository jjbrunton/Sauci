---
description: Security check, commit with sensible message, and push
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git branch:*)
---

## Context

- Current branch: !`git branch --show-current`
- Git status: !`git status --short`
- Staged changes: !`git diff --cached --stat`
- Unstaged changes: !`git diff --stat`

## Your Task

Perform a secure commit and push with the following steps:

### Step 1: Security Check
Before committing, scan the staged changes for potential secrets or sensitive data:
- API keys, tokens, or credentials (patterns like `sk-`, `api_key`, `secret`, `password`, `token`, `bearer`)
- `.env` files or environment variable files with actual values
- Private keys or certificates
- Database connection strings with credentials
- Hardcoded URLs with authentication parameters

Run `git diff --cached` to inspect what will be committed. If you find ANY potential secrets:
1. STOP immediately
2. List the specific files and lines containing potential secrets
3. Do NOT proceed with the commit
4. Suggest how to fix (use environment variables, add to .gitignore, etc.)

### Step 2: Stage All Changes
If security check passes, stage all changes with `git add -A`.

### Step 3: Generate Commit Message
Analyze the changes and create a concise, meaningful commit message that:
- Summarizes what changed (not how)
- Uses imperative mood ("Add feature" not "Added feature")
- Is 50 chars or less for the subject line
- Includes the standard Claude Code footer

Look at recent commits with `git log --oneline -5` to match the repository's commit style.

### Step 4: Commit and Push
1. Create the commit with the generated message
2. Push to the remote repository

If any step fails, report the error and stop.
