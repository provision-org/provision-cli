import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { api } from '../api.js';
import { getSkillsDir, sanitizeSkillName } from '../config.js';

export function installCommand(program) {
  program
    .command('install <name>')
    .description('Install a skill from Provision marketplace')
    .action(async (rawName) => {
      const name = sanitizeSkillName(rawName);
      if (!name) {
        console.error(chalk.red('Invalid skill name. Use lowercase letters, numbers, and hyphens only.'));
        process.exit(1);
      }

      const spinner = ora(`Fetching ${name}...`).start();

      let skill;
      try {
        skill = await api.pullSkill(name);
        spinner.succeed(`Found ${chalk.bold(skill.name)}`);
      } catch (err) {
        spinner.fail('Skill not found');
        console.error(chalk.red(err.message));
        process.exit(1);
      }

      // Save to local provision skills directory
      const skillDir = join(getSkillsDir(), name);
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'SKILL.md'), skill.skill_content);
      writeFileSync(join(skillDir, 'skill.json'), JSON.stringify({
        name: skill.name,
        version: skill.version,
        description: skill.description,
        steps: skill.steps,
        tools: skill.tools,
        requires: { env: skill.requires_env || [] },
        tags: skill.tags || [],
      }, null, 2));
      if (skill.readme) {
        writeFileSync(join(skillDir, 'README.md'), skill.readme);
      }

      // Show skill info
      if (skill.description) {
        console.log(chalk.dim(`  ${skill.description}`));
      }
      if (skill.steps && skill.steps.length > 0) {
        console.log('');
        skill.steps.forEach((step, i) => {
          console.log(chalk.dim(`  ${i + 1}. ${step}`));
        });
      }
      console.log('');

      // Multi-select install targets
      const { targets } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'targets',
          message: 'Where would you like to install this skill?',
          choices: [
            { name: 'Claude Code (~/.claude/skills/)', value: 'claude-code' },
            { name: 'OpenClaw local (~/.openclaw/skills/)', value: 'openclaw' },
            { name: 'Cursor (.cursor/skills/)', value: 'cursor' },
            { name: 'Codex (.codex/skills/)', value: 'codex' },
          ],
        },
      ]);

      const home = process.env.HOME;
      const skillContent = skill.skill_content;

      function installToDir(baseDir, label) {
        const dir = join(baseDir, name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'SKILL.md'), skillContent);
        if (skill.readme) {
          writeFileSync(join(dir, 'README.md'), skill.readme);
        }
        console.log(chalk.green(`✓ Installed to ${label} (${dir}/)`));
      }

      if (targets.includes('claude-code')) {
        installToDir(join(home, '.claude', 'skills'), 'Claude Code');
      }

      if (targets.includes('openclaw')) {
        installToDir(join(home, '.openclaw', 'skills'), 'OpenClaw');
      }

      if (targets.includes('cursor')) {
        installToDir(join(process.cwd(), '.cursor', 'skills'), 'Cursor');
      }

      if (targets.includes('codex')) {
        installToDir(join(process.cwd(), '.codex', 'skills'), 'Codex');
      }

      if (targets.length === 0) {
        console.log(chalk.dim(`Saved to ${skillDir}`));
      }

      console.log('');
    });
}
