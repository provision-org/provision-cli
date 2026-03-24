# Provision CLI

[![npm version](https://img.shields.io/npm/v/@provision-ai/cli.svg)](https://www.npmjs.com/package/@provision-ai/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Turn your workflows into reusable AI skills. Record your screen or describe a task — the CLI generates structured skills that any AI tool can follow.

## The Problem

You know the best way to do your job. But every time you use an AI tool, you have to re-explain the same processes — the URLs, the filters, the steps, the preferences. That knowledge lives in your head, and it doesn't scale.

## What This CLI Does

The Provision CLI extracts your expertise into **skills** — structured instructions that AI tools follow exactly. Two ways to create them:

1. **Record your screen** doing the task → the CLI analyzes the video and extracts every step, URL, click, and decision
2. **Describe the workflow** in text → the CLI generates a structured skill definition

Skills install into **Claude Code**, **Cursor**, **Codex**, and **OpenClaw** agents. Create once, use everywhere.

## What is Provision AI?

[Provision AI](https://provision.ai) is the team layer on top of this CLI. While the CLI works standalone with a free Gemini API key, Provision adds:

- **Team skill library** — publish skills and share them across your team
- **Version control** — track changes, iterate together
- **Cloud agents** — deploy AI agents that run your skills 24/7 in Slack, Telegram, and Discord
- **Web UI** — create skills from your browser without a terminal

The CLI is free and open source. Team features require a [Provision account](https://provision.ai).

## Quick Start

```bash
# No account needed — just a free Gemini API key
GEMINI_API_KEY=your-key npx @provision-ai/cli teach -v my-workflow.mp4
GEMINI_API_KEY=your-key npx @provision-ai/cli teach -d "Search LinkedIn for leads"

# With a Provision account (for team sharing)
npx @provision-ai/cli login
npx @provision-ai/cli teach -v my-workflow.mp4
npx @provision-ai/cli publish linkedin-leads
```

## Installation

### Option 1: Use directly with npx (recommended)

No installation required — just prefix commands with `npx @provision-ai/cli`:

```bash
npx @provision-ai/cli teach -d "Monitor Hacker News for AI mentions"
```

### Option 2: Install globally

```bash
npm install -g @provision-ai/cli
```

Requires Node.js 18 or later.

## Offline Mode (No Account Needed)

Use the CLI without a Provision account — just set your Gemini API key:

```bash
# Video-to-skill
GEMINI_API_KEY=your-key npx @provision-ai/cli teach -v demo.mp4

# Text-to-skill
GEMINI_API_KEY=your-key npx @provision-ai/cli teach -d "Describe your workflow"
```

Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

Skills created offline are saved locally. To share with your team, log in and publish:

```bash
npx @provision-ai/cli login
npx @provision-ai/cli publish my-skill
```

---

## Authentication (For Team Features)

### Browser Login (default)

```bash
provision login
```

Opens your browser to authorize the CLI with your Provision account. Once you click "Authorize," the CLI is logged in automatically.

### Manual Token Entry

For CI/CD or environments without a browser:

```bash
provision login --token
```

Generate a token at [provision.ai/settings/api](https://provision.ai/settings/api).

### Verify

```bash
provision whoami
```

### Log Out

```bash
provision logout
```

## Commands

> All commands below use `provision` (globally installed). You can also use `npx @provision-ai/cli` instead.

### `provision teach`

Create a new skill by describing what it should do.

```bash
# Interactive mode (opens your editor)
provision teach

# From a text description
provision teach -d "Search LinkedIn for dental offices in Austin, TX and extract their name, phone, and website"

# With a specific name
provision teach -d "Monitor Hacker News for AI mentions" -n hn-monitor

# From a screen recording
provision teach -v demo.mp4
```

**Options:**

| Flag | Description |
|------|-------------|
| `-d, --describe <text>` | Describe the workflow in plain text |
| `-v, --video <path>` | Learn from a screen recording (MP4, WebM, MOV) |
| `-n, --name <name>` | Set the skill name (lowercase, hyphens) |

When logged in, the CLI uses the Provision API. In offline mode (with your own API keys), everything runs locally.

After generation, you can choose to:
- Publish to your team on Provision AI (requires login)
- Install to Claude Code (`~/.claude/skills/`)
- Install to OpenClaw (`~/.openclaw/skills/`)
- Install to Cursor (`.cursor/skills/`)
- Install to Codex (`.codex/skills/`)
- Keep it local only (`~/.provision/skills/`)

### Teaching from Video

Record your screen showing the workflow you want the agent to learn:

```bash
provision teach -v my-workflow.mp4
```

Supported formats: MP4, WebM, QuickTime (MOV). Max file size: 100MB.

The AI extracts every URL, click, filter, and form input — not just a summary. Add a voice over to capture your reasoning and preferences. For example:

```
I think your workflow is:

  1. Navigate to linkedin.com/sales/home. If not logged in, sign in.
  2. Click 'Lead filters' to open the search interface.
  3. Click 'Company Headcount' filter, select '11-50'.
  4. Click 'Current Job Title', type 'VP of Sales'.
  5. Click 'Geography' filter, select 'United States'.
  ...+27 more steps

Is this correct? [Confirm] [Edit] [Cancel]
```

Tips for good recordings:
- Add a voice over explaining what you're doing and why
- Show the full flow from start to finish
- Don't worry about mistakes — the AI understands your intent
- Longer videos produce more detailed skills

---

### `provision skills list`

List all skills saved locally.

```bash
provision skills list
```

### `provision skills info <name>`

Show details about a local skill — steps, tools, required env vars.

```bash
provision skills info linkedin-leads
```

### `provision skills edit <name>`

Edit an existing skill. Three modes:

```bash
# Modify with natural language (AI applies the change)
provision skills edit linkedin-leads -d "Also extract the company's tech stack from their careers page"

# Re-teach from a new video
provision skills edit linkedin-leads -v updated-workflow.mp4

# Open SKILL.md in your editor ($EDITOR or nano)
provision skills edit linkedin-leads -e
```

**Options:**

| Flag | Description |
|------|-------------|
| `-d, --describe <prompt>` | Modify the skill with natural language instructions |
| `-v, --video <path>` | Re-teach from a new screen recording |
| `-e, --editor` | Open SKILL.md in your text editor |

Each edit automatically bumps the patch version (e.g., 1.0.0 → 1.0.1).

---

### `provision publish <name>`

Publish a local skill to your team's library on Provision.

```bash
provision publish linkedin-leads
```

If the skill already exists on the server, the version is automatically bumped:

```
Updating linkedin-leads v1.0.0 → v1.0.1
✓ Published linkedin-leads to Provision
  View at: https://provision.ai/skills/linkedin-leads
```

**Options:**

| Flag | Description |
|------|-------------|
| `-c, --changelog <message>` | Add a changelog message for this version |

Every publish creates a version history record on the server for auditing.

---

### `provision install <name>`

Install a skill from the Provision marketplace to your local tools. Shows a multi-select menu to choose where to install.

```bash
provision install linkedin-leads
```

```
? Where would you like to install this skill?
  ◻ Claude Code (~/.claude/skills/)
  ◻ OpenClaw local (~/.openclaw/skills/)
  ◻ Cursor (.cursor/skills/)
  ◻ Codex (.codex/skills/)
```

Each target gets a proper skill folder with `SKILL.md` and `README.md`.

---

### `provision pull <name>`

Download a skill to `~/.provision/skills/` without installing to any tool.

```bash
provision pull linkedin-leads
```

Saves to `~/.provision/skills/<name>/`.

---

### `provision deploy <skill>`

Deploy a skill to a running Provision agent. The skill is pushed to the agent's server and available immediately.

```bash
# Interactive agent selection
provision deploy linkedin-leads

# Specify agent directly
provision deploy linkedin-leads -a agent_id_here
```

**Options:**

| Flag | Description |
|------|-------------|
| `-a, --agent <id>` | Agent ID to deploy to (skips selection prompt) |

---

### `provision agents`

List your Provision agents and their status.

```bash
provision agents
```

---

## Example Workflow

```bash
# 1. Log in
provision login

# 2. Create a skill
provision teach -d "Search LinkedIn Sales Navigator for dental offices in Austin. Extract practice name, phone, website, and a note on why they need our product."

# 3. Review the generated steps, confirm, and name it
# → Skill saved to ~/.provision/skills/dental-leads/

# 4. Publish to your team
provision publish dental-leads

# 5. Install to Claude Code
provision install dental-leads

# 6. Or deploy to a running Provision agent
provision deploy dental-leads

# 7. Later, iterate on the skill
provision skills edit dental-leads -d "Also check if they have a website form for demo requests"

# 8. Re-publish the updated version
provision publish dental-leads -c "Added website form check"
```

## Skill Structure

Skills are saved to `~/.provision/skills/<name>/` with:

| File | Purpose |
|------|---------|
| `SKILL.md` | Instructions the agent reads and follows ([OpenClaw skill standard](https://docs.openclaw.ai/skills)) |
| `skill.json` | Metadata: name, version, steps, required env vars, tools |
| `README.md` | Human-readable documentation |

## Configuration

The CLI stores config in `~/.provision/`:

| File | Purpose |
|------|---------|
| `config.json` | API token and settings |
| `skills/` | Local skill files |

To point to a different API (self-hosted or development):

```bash
# Edit ~/.provision/config.json and set "apiUrl"
```

## Development

```bash
git clone https://github.com/provision-org/provision-cli.git
cd provision-cli
npm install
node bin/provision.js --help
```

## Links

- [Provision AI](https://provision.ai) — Build and share AI skills for your team
- [API Tokens](https://provision.ai/settings/api) — Generate CLI tokens

## License

MIT — see [LICENSE](LICENSE) for details.
