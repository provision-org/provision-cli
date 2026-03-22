import chalk from 'chalk';
import { api } from '../api.js';

export function agentsCommand(program) {
  program
    .command('agents')
    .description('List your Provision agents')
    .action(async () => {
      try {
        const agents = await api.listAgents();

        if (agents.length === 0) {
          console.log(chalk.dim('No agents. Create one at provision.ai'));
          return;
        }

        console.log(chalk.bold(`\n${agents.length} agent(s):\n`));
        agents.forEach(a => {
          const status = a.status === 'active'
            ? chalk.green('● active')
            : chalk.dim(`○ ${a.status}`);
          console.log(`  ${chalk.bold(a.name)} ${status}`);
          if (a.role) console.log(chalk.dim(`    ${a.role}`));
        });
        console.log('');
      } catch (err) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}
