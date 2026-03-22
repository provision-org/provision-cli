import chalk from 'chalk';
import open from 'open';
import { createServer } from 'http';
import { randomBytes } from 'crypto';
import { setToken, getApiUrl } from '../config.js';
import { api } from '../api.js';
import inquirer from 'inquirer';

export function loginCommand(program) {
  program
    .command('login')
    .description('Authenticate with your Provision account')
    .option('--token', 'Use manual token entry instead of browser')
    .action(async (options) => {
      console.log(chalk.bold('\nProvision Login\n'));

      if (options.token) {
        // Manual token entry
        const { token } = await inquirer.prompt([
          {
            type: 'password',
            name: 'token',
            message: 'Enter your API token:',
            mask: '*',
          },
        ]);

        try {
          setToken(token);
          const user = await api.whoami();
          console.log(chalk.green(`\n✓ Logged in as ${user.name} (${user.email})`));
          if (user.team) console.log(chalk.dim(`  Team: ${user.team}`));
        } catch (err) {
          setToken(null);
          console.error(chalk.red(`\n✗ ${err.message}`));
          process.exit(1);
        }
        return;
      }

      // Browser-based login
      const state = randomBytes(24).toString('hex');
      const port = 9876 + Math.floor(Math.random() * 100);

      // Start local callback server
      const tokenPromise = new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
          const url = new URL(req.url, `http://127.0.0.1:${port}`);

          if (url.pathname === '/callback') {
            const token = url.searchParams.get('token');
            const returnedState = url.searchParams.get('state');

            if (returnedState !== state) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<html><body><h2>Error: Invalid state</h2><p>Please try again.</p></body></html>');
              reject(new Error('State mismatch'));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html><body style="font-family:system-ui;text-align:center;padding:60px"><h2>✓ Authenticated!</h2><p>You can close this window and return to your terminal.</p></body></html>');

            server.close();
            resolve(token);
          } else {
            res.writeHead(404);
            res.end();
          }
        });

        server.listen(port, '127.0.0.1', () => {
          // Server ready
        });

        // Timeout after 2 minutes
        setTimeout(() => {
          server.close();
          reject(new Error('Login timed out. Try again or use `provision login --token`.'));
        }, 120000);
      });

      const apiUrl = getApiUrl();
      const authUrl = `${apiUrl}/auth/cli?state=${state}&port=${port}`;

      console.log(chalk.dim(`Opening browser to ${apiUrl}...`));
      console.log(chalk.dim(`If the browser doesn't open, visit:`));
      console.log(chalk.cyan(`  ${authUrl}\n`));

      try {
        await open(authUrl);
      } catch {
        // Browser open failed — user can manually visit the URL
      }

      console.log('Waiting for authorization...');

      try {
        const token = await tokenPromise;
        setToken(token);

        const user = await api.whoami();
        console.log(chalk.green(`\n✓ Logged in as ${user.name} (${user.email})`));
        if (user.team) console.log(chalk.dim(`  Team: ${user.team}`));
      } catch (err) {
        console.error(chalk.red(`\n✗ ${err.message}`));
        process.exit(1);
      }
    });
}
