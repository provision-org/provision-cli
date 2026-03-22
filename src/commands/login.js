import chalk from 'chalk';
import open from 'open';
import { setToken } from '../config.js';
import { api } from '../api.js';
import inquirer from 'inquirer';

export function loginCommand(program) {
  program
    .command('login')
    .description('Authenticate with your Provision account')
    .action(async () => {
      console.log(chalk.bold('\nProvision Login\n'));

      // For now: simple token-based auth
      // Future: browser-based OAuth flow
      const { token } = await inquirer.prompt([
        {
          type: 'password',
          name: 'token',
          message: 'Enter your API token (from provision.ai/settings/api):',
          mask: '*',
        },
      ]);

      try {
        setToken(token);
        const user = await api.whoami();
        console.log(chalk.green(`\n✓ Logged in as ${user.name} (${user.email})`));
        if (user.team) {
          console.log(chalk.dim(`  Team: ${user.team}`));
        }
      } catch (err) {
        setToken(null);
        console.error(chalk.red(`\n✗ ${err.message}`));
        process.exit(1);
      }
    });
}
