import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { api } from '../api.js';
import { getToken, sanitizeSkillName } from '../config.js';
import { readLocalSkill, getServerSkill, publishSkillByName } from '../publishHelper.js';

export function deployCommand(program) {
  program
    .command('deploy <skill>')
    .description('Deploy a skill to a running Provision agent')
    .option('-a, --agent <id>', 'Agent ID to deploy to')
    .option('-f, --force', 'Auto-publish if local version is newer (skip prompt)')
    .action(async (rawSkill, options) => {
      const skill = sanitizeSkillName(rawSkill);
      if (!skill) {
        console.error(chalk.red('Invalid skill name. Use lowercase letters, numbers, and hyphens only.'));
        process.exit(1);
      }

      // 1. Require login
      if (!getToken()) {
        console.error(chalk.red('Not logged in. Run `npx @provision-ai/cli login` first.'));
        process.exit(1);
      }

      // 2. Check skill exists locally
      const local = readLocalSkill(skill);
      if (!local) {
        console.error(chalk.red(`Skill "${skill}" not found locally. Run \`provision teach\` first.`));
        process.exit(1);
      }

      console.log(chalk.green(`✔ Found local skill: ${chalk.bold(skill)} v${local.meta.version || '1.0.0'}`));

      // 3. Check if published on server
      const checkSpinner = ora('Checking if published...').start();
      const serverSkill = await getServerSkill(skill);

      if (!serverSkill) {
        // Not published — auto-publish first
        checkSpinner.info('Not published yet. Publishing first...');

        try {
          await publishSkillByName(skill, { changelog: 'Auto-published for agent deploy' });
        } catch (err) {
          console.error(chalk.red(`Failed to publish: ${err.message}`));
          process.exit(1);
        }
      } else {
        // Published — check if local version is newer
        const localVersion = local.meta.version || '1.0.0';
        const serverVersion = serverSkill.version || '1.0.0';
        const localParts = localVersion.split('.').map(Number);
        const serverParts = serverVersion.split('.').map(Number);
        let localNewer = false;

        for (let i = 0; i < 3; i++) {
          if ((localParts[i] || 0) > (serverParts[i] || 0)) { localNewer = true; break; }
          if ((localParts[i] || 0) < (serverParts[i] || 0)) break;
        }

        if (localNewer) {
          checkSpinner.info(`Local v${localVersion} is newer than published v${serverVersion}`);

          let shouldUpdate = options.force;
          if (!shouldUpdate) {
            const { update } = await inquirer.prompt([{
              type: 'confirm',
              name: 'update',
              message: 'Update the published version before deploying?',
              default: true,
            }]);
            shouldUpdate = update;
          }

          if (shouldUpdate) {
            try {
              await publishSkillByName(skill, { changelog: 'Updated before agent deploy' });
            } catch (err) {
              console.error(chalk.red(`Failed to update: ${err.message}`));
              process.exit(1);
            }
          } else {
            checkSpinner.succeed(`Deploying published v${serverVersion}`);
          }
        } else {
          checkSpinner.succeed(`Published v${serverVersion} is up to date`);
        }
      }

      // 4. Select agent
      let agentId = options.agent;

      if (!agentId) {
        try {
          const agents = await api.listAgents();
          if (agents.length === 0) {
            console.error(chalk.red('No agents found. Create one at provision.ai'));
            process.exit(1);
          }

          const { selected } = await inquirer.prompt([{
            type: 'list',
            name: 'selected',
            message: 'Deploy to which agent?',
            choices: agents.map(a => ({
              name: `${a.name} (${a.status})`,
              value: a.id,
            })),
          }]);
          agentId = selected;
        } catch (err) {
          console.error(chalk.red(err.message));
          process.exit(1);
        }
      }

      // 5. Deploy
      const spinner = ora(`Deploying ${chalk.bold(skill)} to agent...`).start();

      try {
        const result = await api.deploySkill(agentId, skill);
        spinner.succeed(`${chalk.bold(skill)} deployed to ${result.agent_name || 'agent'}`);
        console.log(chalk.dim('  The agent will pick up the skill on its next session.'));
      } catch (err) {
        spinner.fail('Failed to deploy');
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}
