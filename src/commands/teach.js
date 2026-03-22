import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { api } from '../api.js';
import { getSkillsDir } from '../config.js';

export function teachCommand(program) {
  program
    .command('teach')
    .description('Create a new skill by describing what it should do')
    .option('-d, --describe <description>', 'Describe the workflow in text')
    .option('-n, --name <name>', 'Skill name')
    .action(async (options) => {
      let description = options.describe;

      if (!description) {
        const answers = await inquirer.prompt([
          {
            type: 'editor',
            name: 'description',
            message: 'Describe what this skill should do:',
            default: '# Describe your workflow\n\nExample: Search LinkedIn for dental offices in Austin, TX. For each one, extract their name, phone number, website, and a brief note on why they might need our product.',
          },
        ]);
        description = answers.description;
      }

      if (!description || description.trim().length < 10) {
        console.error(chalk.red('Description is too short. Please provide more detail.'));
        process.exit(1);
      }

      // Step 1: Generate workflow understanding
      const spinner = ora('Understanding your workflow...').start();

      let result;
      try {
        result = await api.generateSkill(description);
        spinner.succeed('Workflow understood');
      } catch (err) {
        spinner.fail('Failed to understand workflow');
        console.error(chalk.red(err.message));
        process.exit(1);
      }

      // Step 2: Show extracted steps and confirm
      console.log(chalk.bold('\nI think your workflow is:\n'));
      result.steps.forEach((step, i) => {
        console.log(chalk.cyan(`  ${i + 1}. ${step}`));
      });

      if (result.requires_env && result.requires_env.length > 0) {
        console.log(chalk.dim(`\n  Requires: ${result.requires_env.join(', ')}`));
      }
      if (result.tools && result.tools.length > 0) {
        console.log(chalk.dim(`  Tools: ${result.tools.join(', ')}`));
      }

      console.log('');

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Is this correct?',
          choices: [
            { name: 'Yes, generate the skill', value: 'confirm' },
            { name: 'Edit the steps', value: 'edit' },
            { name: 'Cancel', value: 'cancel' },
          ],
        },
      ]);

      if (action === 'cancel') {
        console.log(chalk.dim('Cancelled.'));
        return;
      }

      let finalSteps = result.steps;

      if (action === 'edit') {
        const { editedSteps } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'editedSteps',
            message: 'Edit the workflow steps (one per line):',
            default: result.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
          },
        ]);
        finalSteps = editedSteps
          .split('\n')
          .map(l => l.replace(/^\d+\.\s*/, '').trim())
          .filter(l => l.length > 0);
      }

      // Step 3: Get skill name
      let skillName = options.name;
      if (!skillName) {
        const { name } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Skill name:',
            default: result.suggested_name || 'my-skill',
            validate: (v) => /^[a-z0-9-]+$/.test(v) || 'Use lowercase letters, numbers, and hyphens only',
          },
        ]);
        skillName = name;
      }

      // Step 4: Generate full skill files
      const genSpinner = ora('Generating skill files...').start();

      let skillFiles;
      try {
        skillFiles = await api.generateSkill(description + '\n\nConfirmed steps:\n' + finalSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'));
        genSpinner.succeed('Skill generated');
      } catch (err) {
        genSpinner.fail('Failed to generate skill');
        console.error(chalk.red(err.message));
        process.exit(1);
      }

      // Step 5: Save locally
      const skillDir = join(getSkillsDir(), skillName);
      if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true });

      writeFileSync(join(skillDir, 'SKILL.md'), skillFiles.skill_content);
      writeFileSync(join(skillDir, 'skill.json'), JSON.stringify({
        name: skillName,
        version: '1.0.0',
        description: skillFiles.description || description.slice(0, 200),
        steps: finalSteps,
        tools: result.tools || [],
        requires: { env: result.requires_env || [] },
        tags: skillFiles.tags || [],
      }, null, 2));
      writeFileSync(join(skillDir, 'README.md'), skillFiles.readme || `# ${skillName}\n\n${description}`);

      console.log(chalk.green(`\n✓ Skill saved to ${chalk.bold(skillDir)}`));

      // Step 6: Offer install options
      const { install } = await inquirer.prompt([
        {
          type: 'list',
          name: 'install',
          message: 'Where would you like to install this skill?',
          choices: [
            { name: 'Local OpenClaw (~/.openclaw/skills/)', value: 'openclaw' },
            { name: 'Publish to Provision', value: 'publish' },
            { name: 'Just keep it local for now', value: 'none' },
          ],
        },
      ]);

      if (install === 'openclaw') {
        const openClawDir = join(process.env.HOME, '.openclaw', 'skills', skillName);
        mkdirSync(openClawDir, { recursive: true });
        writeFileSync(join(openClawDir, 'SKILL.md'), skillFiles.skill_content);
        console.log(chalk.green(`✓ Installed to ${openClawDir}`));
        console.log(chalk.dim('  Restart OpenClaw to activate the skill.'));
      }

      if (install === 'publish') {
        try {
          await api.publishSkill({
            name: skillName,
            description: skillFiles.description || description.slice(0, 200),
            skill_content: skillFiles.skill_content,
            readme: skillFiles.readme,
            steps: finalSteps,
            tools: result.tools || [],
            requires_env: result.requires_env || [],
            tags: skillFiles.tags || [],
          });
          console.log(chalk.green(`✓ Published to Provision!`));
          console.log(chalk.dim(`  View at: https://provision.ai/skills/${skillName}`));
        } catch (err) {
          console.error(chalk.red(`Failed to publish: ${err.message}`));
        }
      }

      console.log('');
    });
}
