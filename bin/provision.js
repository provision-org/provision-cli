#!/usr/bin/env node
import { program } from 'commander';
import { loginCommand } from '../src/commands/login.js';
import { logoutCommand } from '../src/commands/logout.js';
import { whoamiCommand } from '../src/commands/whoami.js';
import { teachCommand } from '../src/commands/teach.js';
import { skillsCommand } from '../src/commands/skills.js';
import { publishCommand } from '../src/commands/publish.js';
import { pullCommand } from '../src/commands/pull.js';
import { installCommand } from '../src/commands/install.js';
import { deployCommand } from '../src/commands/deploy.js';
import { agentsCommand } from '../src/commands/agents.js';

program
  .name('provision')
  .description('Teach AI agents new skills')
  .version('0.1.0');

loginCommand(program);
logoutCommand(program);
whoamiCommand(program);
teachCommand(program);
skillsCommand(program);
publishCommand(program);
pullCommand(program);
installCommand(program);
deployCommand(program);
agentsCommand(program);

program.parse();
