import chalk from 'chalk';
import ora from 'ora';
import { api } from '../api.js';

export function deployCommand(program) {
  program
    .command('deploy <skill>')
    .description('Deploy a skill to a running Provision agent')
    .option('-a, --agent <id>', 'Agent ID to deploy to')
    .action(async (skill, options) => {
      let agentId = options.agent;

      if (!agentId) {
        // List agents and let user pick
        try {
          const agents = await api.listAgents();
          if (agents.length === 0) {
            console.error(chalk.red('No agents found. Create one at provision.ai'));
            process.exit(1);
          }

          const inquirer = await import('inquirer');
          const { selected } = await inquirer.default.prompt([
            {
              type: 'list',
              name: 'selected',
              message: 'Deploy to which agent?',
              choices: agents.map(a => ({
                name: `${a.name} (${a.status})`,
                value: a.id,
              })),
            },
          ]);
          agentId = selected;
        } catch (err) {
          console.error(chalk.red(err.message));
          process.exit(1);
        }
      }

      const spinner = ora(`Deploying ${skill} to agent...`).start();

      try {
        await api.deploySkill(agentId, skill);
        spinner.succeed(`${chalk.bold(skill)} deployed to agent`);
        console.log(chalk.dim('  The agent will pick up the skill on its next session.'));
      } catch (err) {
        spinner.fail('Failed to deploy');
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}
