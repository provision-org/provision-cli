# Provision CLI

[![npm version](https://img.shields.io/npm/v/@provision-ai/cli.svg)](https://www.npmjs.com/package/@provision-ai/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Teach AI agents new skills from natural language. Create, test, and publish skills for [OpenClaw](https://openclaw.ai) agents through the [Provision](https://provision.ai) platform.

## Quick Start

```bash
npm install -g @provision-ai/cli

provision login
provision teach
provision deploy linkedin-leads
```

## Installation

```bash
npm install -g @provision-ai/cli
```

Requires Node.js 18 or later.

## Authentication

```bash
provision login
```

This opens your browser to authorize the CLI with your Provision account. Once approved, you're logged in automatically.

For CI/CD or environments without a browser, use manual token entry:

```bash
provision login --token
```

To verify:

```bash
provision whoami
```

## Commands

### `provision teach`

Create a new skill by describing what it should do in plain English.

```bash
# Interactive mode (opens your editor)
provision teach

# Inline description
provision teach -d "Search LinkedIn for dental offices in Austin, TX and extract their name, phone, and website"

# With a name
provision teach -d "Monitor Hacker News for AI mentions" -n hn-monitor

# From a screen recording
provision teach --video demo.mp4
```

The CLI sends your input to the Provision API, which breaks it into steps for confirmation, then generates the skill files (SKILL.md, skill.json, README.md).

### Teaching from Video

Record your screen showing the workflow you want the agent to learn, then:

```bash
provision teach --video my-workflow.mp4
```

Supported formats: MP4, WebM, QuickTime (MOV). Max file size: 100MB.

The AI watches your recording and extracts **what** you're doing (not the exact clicks). For example, if you record yourself searching LinkedIn and copying company info into a spreadsheet, it extracts:

```
I think your workflow is:
  1. Search LinkedIn for target companies
  2. Open each company profile
  3. Extract name, size, and contact info
  4. Save results to spreadsheet

Is this correct? [Confirm] [Edit] [Cancel]
```

You confirm or edit the steps, name the skill, and it generates the SKILL.md. The agent figures out the **how** on its own using its browser and tools.

Tips for good recordings:
- Keep it under 5 minutes — focus on the core workflow
- Show the full flow from start to finish
- Don't worry about mistakes — the AI extracts the intent, not the exact steps
- Narrating what you're doing (even silently mouthing) can help the AI understand

### `provision skills list`

List all skills saved locally in `~/.provision/skills/`.

```bash
provision skills list
```

### `provision skills info <name>`

Show details about a local skill.

```bash
provision skills info linkedin-leads
```

### `provision publish <name>`

Publish a local skill to your team on Provision.

```bash
provision publish linkedin-leads
```

### `provision pull <name>`

Download a skill from the Provision marketplace.

```bash
provision pull linkedin-leads
```

### `provision deploy <skill>`

Deploy a skill to a running Provision agent. If no agent is specified, you'll be prompted to choose.

```bash
# Interactive agent selection
provision deploy linkedin-leads

# Specify agent directly
provision deploy linkedin-leads --agent agent_abc123
```

### `provision agents`

List your Provision agents and their status.

```bash
provision agents
```

### `provision logout`

Clear your stored credentials.

```bash
provision logout
```

## Example Workflow

```bash
# 1. Authenticate
provision login

# 2. Create a skill from a description
provision teach -d "Search LinkedIn Sales Navigator for dental offices in Austin, TX. For each result, extract their practice name, phone number, website URL, and write a brief note on why they might need our dental marketing software. Save results to a CSV."

# 3. Review and confirm the generated steps
# The CLI will show you the extracted workflow and ask for confirmation

# 4. Publish to your team
provision publish dental-leads

# 5. Deploy to a running agent
provision deploy dental-leads
```

## Skill Structure

Skills are saved to `~/.provision/skills/<name>/` with the following files:

| File | Purpose |
|------|---------|
| `SKILL.md` | The skill document that OpenClaw agents read and follow |
| `skill.json` | Metadata: name, version, steps, required env vars, tools |
| `README.md` | Human-readable documentation |

## Configuration

The CLI stores configuration in `~/.provision/`:

- **Token**: API authentication token
- **API URL**: Defaults to `https://provision.ai` (override for self-hosted)
- **Skills**: Local skill files in `~/.provision/skills/`

## Development

```bash
git clone https://github.com/provision-ai/cli.git
cd cli
npm install
node bin/provision.js --help
```

## Links

- [Provision Platform](https://provision.ai) -- Create and manage AI agents
- [OpenClaw](https://openclaw.ai) -- The agent runtime
- [Documentation](https://provision.ai/docs) -- Full platform docs

## License

MIT -- see [LICENSE](LICENSE) for details.
