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

Get your API token from [provision.ai/settings/api](https://provision.ai/settings/api), then:

```bash
provision login
```

You'll be prompted to paste your token. To verify:

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
```

The CLI sends your description to the Provision API, which breaks it into steps for confirmation, then generates the skill files (SKILL.md, skill.json, README.md).

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
