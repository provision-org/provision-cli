import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { api } from '../api.js';
import { getSkillsDir, getToken, getApiUrl, sanitizeSkillName } from '../config.js';
import {
  getOfflineKey,
  canRunOffline,
  extractSopFromVideo,
  structureSop,
  generateFromText,
} from '../offline.js';

export function teachCommand(program) {
  program
    .command('teach')
    .description('Create a new skill by describing what it should do')
    .option('-d, --describe <description>', 'Describe the workflow in text')
    .option('-v, --video <path>', 'Learn from a screen recording')
    .option('-n, --name <name>', 'Skill name')
    .option('--offline', 'Force local processing with your own API key (never send data to Provision)')
    .action(async (options) => {
      // Determine mode: online (Provision API) or offline (Gemini key)
      const token = getToken();
      const geminiKey = getOfflineKey();
      const isOffline = options.offline ? canRunOffline() : (!token && canRunOffline());

      if (options.offline && !geminiKey) {
        console.error(chalk.red('Offline mode requires GEMINI_API_KEY environment variable.'));
        console.log(chalk.dim('  GEMINI_API_KEY=your-key npx @provision-ai/cli teach --offline -v demo.mp4'));
        process.exit(1);
      }

      if (!token && !geminiKey) {
        console.log(chalk.yellow('Not logged in and no API key found.\n'));
        console.log('Option 1: Log in to Provision');
        console.log(chalk.dim('  npx @provision-ai/cli login\n'));
        console.log('Option 2: Bring your own Gemini API key (free)');
        console.log(chalk.dim('  GEMINI_API_KEY=your-key npx @provision-ai/cli teach -v demo.mp4'));
        console.log(chalk.dim('  GEMINI_API_KEY=your-key npx @provision-ai/cli teach -d "..."\n'));
        console.log(chalk.dim('Get a free key at: https://aistudio.google.com/apikey'));
        process.exit(1);
      }

      if (isOffline) {
        console.log(chalk.dim('Running locally with your own API keys\n'));
      }

      let result;

      if (options.video) {
        const videoPath = options.video;
        if (!existsSync(videoPath)) {
          console.error(chalk.red(`Video file not found: ${videoPath}`));
          process.exit(1);
        }

        if (isOffline) {
          // ── Offline video processing ──
          result = await offlineVideoTeach(videoPath, geminiKey);
        } else {
          // ── Online video processing (upload to Provision → poll) ──
          result = await onlineVideoTeach(videoPath);
        }
      } else {
        // ── Text-based teaching ──
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

        if (isOffline) {
          const spinner = ora('Generating skill...').start();
          try {
            result = await generateFromText(description, geminiKey);
            spinner.succeed('Skill generated');
          } catch (err) {
            spinner.fail('Failed to generate skill');
            console.error(chalk.red(err.message));
            process.exit(1);
          }
        } else {
          const spinner = ora('Understanding your workflow...').start();
          try {
            result = await api.generateSkill(description);
            spinner.succeed('Workflow understood');
          } catch (err) {
            spinner.fail('Failed to understand workflow');
            console.error(chalk.red(err.message));
            process.exit(1);
          }
        }
      }

      // Show extracted steps and confirm
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

      // Get skill name
      let skillName = options.name ? sanitizeSkillName(options.name) : null;
      if (options.name && !skillName) {
        console.error(chalk.red('Invalid skill name. Use lowercase letters, numbers, and hyphens only.'));
        process.exit(1);
      }
      if (!skillName) {
        const { name } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Skill name:',
            default: result.suggested_name || 'my-skill',
            validate: (v) => /^[a-z0-9][a-z0-9_-]*$/.test(v) || 'Use lowercase letters, numbers, and hyphens only',
          },
        ]);
        skillName = name;
      }

      // Generate full skill files if not already present (offline mode usually has them)
      let skillFiles = result;
      if (!result.skill_content) {
        const genDescription = options.video
          ? 'Workflow steps:\n' + finalSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')
          : (options.describe || '') + '\n\nConfirmed steps:\n' + finalSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');

        const genSpinner = ora('Generating skill files...').start();
        try {
          if (isOffline) {
            skillFiles = await generateFromText(genDescription, geminiKey);
          } else {
            skillFiles = await api.generateSkill(genDescription);
          }
          genSpinner.succeed('Skill generated');
        } catch (err) {
          genSpinner.fail('Failed to generate skill');
          console.error(chalk.red(err.message));
          process.exit(1);
        }
      }

      // Save locally
      const skillDir = join(getSkillsDir(), skillName);
      if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true });

      writeFileSync(join(skillDir, 'SKILL.md'), skillFiles.skill_content || '');
      writeFileSync(join(skillDir, 'skill.json'), JSON.stringify({
        name: skillName,
        version: '1.0.0',
        description: skillFiles.description || '',
        steps: finalSteps,
        tools: result.tools || [],
        requires: { env: result.requires_env || [] },
        tags: skillFiles.tags || [],
      }, null, 2));
      writeFileSync(join(skillDir, 'README.md'), skillFiles.readme || `# ${skillName}`);

      console.log(chalk.green(`\n✓ Skill saved to ${chalk.bold(skillDir)}`));

      // Install options
      const installChoices = [
        { name: 'Claude Code (~/.claude/skills/)', value: 'claude-code' },
        { name: 'OpenClaw local (~/.openclaw/skills/)', value: 'openclaw' },
        { name: 'Cursor (.cursor/skills/)', value: 'cursor' },
        { name: 'Codex (.codex/skills/)', value: 'codex' },
      ];

      // Only show Provision options if logged in
      if (token) {
        installChoices.unshift(
          { name: 'Publish to Provision AI', value: 'publish' },
          { name: 'Deploy to a Provision Agent', value: 'deploy-agent' },
        );
      }

      const { targets } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'targets',
          message: 'Where would you like to install this skill?',
          choices: installChoices,
        },
      ]);

      const home = process.env.HOME;
      const skillContent = skillFiles.skill_content || '';
      const readmeContent = skillFiles.readme || `# ${skillName}`;

      function installToDir(baseDir, label) {
        const dir = join(baseDir, skillName);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'SKILL.md'), skillContent);
        writeFileSync(join(dir, 'README.md'), readmeContent);
        console.log(chalk.green(`✓ Installed to ${label} (${dir}/)`));
      }

      if (targets.includes('openclaw')) {
        installToDir(join(home, '.openclaw', 'skills'), 'OpenClaw');
      }
      if (targets.includes('claude-code')) {
        installToDir(join(home, '.claude', 'skills'), 'Claude Code');
      }
      if (targets.includes('cursor')) {
        installToDir(join(process.cwd(), '.cursor', 'skills'), 'Cursor');
      }
      if (targets.includes('codex')) {
        installToDir(join(process.cwd(), '.codex', 'skills'), 'Codex');
      }

      if (targets.includes('publish')) {
        try {
          await api.publishSkill({
            name: skillName,
            description: skillFiles.description || '',
            skill_content: skillContent,
            readme: skillFiles.readme,
            steps: finalSteps,
            tools: result.tools || [],
            requires_env: result.requires_env || [],
            tags: skillFiles.tags || [],
          });
          console.log(chalk.green(`✓ Published to Provision AI!`));
          console.log(chalk.dim(`  View at: https://provision.ai/skills/${skillName}`));
        } catch (err) {
          console.error(chalk.red(`Failed to publish: ${err.message}`));
        }
      }

      if (targets.includes('deploy-agent')) {
        // Auto-publish if not already published in this run
        if (!targets.includes('publish')) {
          try {
            const { publishSkillByName } = await import('../publishHelper.js');
            await publishSkillByName(skillName, { changelog: 'Auto-published for agent deploy', silent: false });
          } catch (err) {
            console.error(chalk.red(`Failed to publish: ${err.message}`));
          }
        }

        // Pick an agent and deploy
        try {
          const agents = await api.listAgents();
          if (agents.length === 0) {
            console.log(chalk.yellow('No agents found. Create one at provision.ai to deploy skills.'));
          } else {
            const { agentId } = await inquirer.prompt([{
              type: 'list',
              name: 'agentId',
              message: 'Deploy to which agent?',
              choices: agents.map(a => ({
                name: `${a.name} (${a.status})`,
                value: a.id,
              })),
            }]);

            const deploySpinner = ora(`Deploying ${chalk.bold(skillName)} to agent...`).start();
            try {
              await api.deploySkill(agentId, skillName);
              deploySpinner.succeed(`${chalk.bold(skillName)} deployed to agent`);
              console.log(chalk.dim('  The agent will pick up the skill on its next session.'));
            } catch (err) {
              deploySpinner.fail(`Failed to deploy: ${err.message}`);
            }
          }
        } catch (err) {
          console.error(chalk.red(`Failed to list agents: ${err.message}`));
        }
      }

      if (targets.length === 0) {
        console.log(chalk.dim('Skill saved locally only.'));
      }

      // Upsell for offline users
      if (isOffline && !targets.includes('publish')) {
        console.log('');
        console.log(chalk.dim('Want to share this skill with your team?'));
        console.log(chalk.dim('  npx @provision-ai/cli login'));
        console.log(chalk.dim('  npx @provision-ai/cli publish ' + skillName));
      }

      console.log('');
    });
}

// ── Online video processing ──

async function onlineVideoTeach(videoPath) {
  const spinner = ora('Uploading video...').start();

  try {
    const videoData = readFileSync(videoPath);
    const ext = basename(videoPath).split('.').pop()?.toLowerCase();
    const mimeTypes = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', qt: 'video/quicktime' };
    const mimeType = mimeTypes[ext] || 'video/mp4';
    const videoFile = new File([videoData], basename(videoPath), { type: mimeType });

    const formData = new FormData();
    formData.append('video', videoFile);

    const baseUrl = getApiUrl();

    if (process.env.PROVISION_DEBUG) {
      console.error(`[DEBUG] Uploading ${basename(videoPath)} (${(videoData.length / 1024 / 1024).toFixed(1)}MB, ${mimeType})`);
    }

    const uploadResponse = await fetch(`${baseUrl}/api/cli/skills/generate-video`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}`, Accept: 'application/json' },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      let err = {};
      try { err = JSON.parse(text); } catch {}
      throw new Error(err.message || `Upload failed: ${uploadResponse.status}`);
    }

    const { generation_id } = await uploadResponse.json();
    spinner.succeed('Video uploaded');

    const pollSpinner = ora('Analyzing video and generating skill (this may take a few minutes)...').start();

    while (true) {
      await new Promise(r => setTimeout(r, 5000));

      const statusResponse = await fetch(`${baseUrl}/api/cli/skills/generations/${generation_id}`, {
        headers: { Authorization: `Bearer ${getToken()}`, Accept: 'application/json' },
      });

      if (!statusResponse.ok) throw new Error('Failed to check generation status');

      const data = await statusResponse.json();

      if (data.status === 'completed') {
        pollSpinner.succeed('Skill generated from video');
        return data.result;
      }
      if (data.status === 'failed') {
        throw new Error(data.error || 'Video analysis failed');
      }
      if (data.status === 'processing') {
        pollSpinner.text = 'Extracting workflow from video...';
      }
    }
  } catch (err) {
    spinner.fail('Failed to analyze video');
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}

// ── Offline video processing ──

async function offlineVideoTeach(videoPath, geminiKey) {
  const videoData = readFileSync(videoPath);
  const ext = basename(videoPath).split('.').pop()?.toLowerCase();
  const mimeTypes = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', qt: 'video/quicktime' };
  const mimeType = mimeTypes[ext] || 'video/mp4';

  console.log(chalk.dim(`  ${basename(videoPath)} (${(videoData.length / 1024 / 1024).toFixed(1)}MB)\n`));

  // Step 1: Gemini extracts SOP
  const sopSpinner = ora('Analyzing video with Gemini...').start();

  let rawSop;
  try {
    rawSop = await extractSopFromVideo(videoData, mimeType, geminiKey);
    sopSpinner.succeed('Video analyzed — SOP extracted');
  } catch (err) {
    sopSpinner.fail('Failed to analyze video');
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  // Step 2: Gemini structures SOP into skill
  const structureSpinner = ora('Structuring skill...').start();

  try {
    const result = await structureSop(rawSop, geminiKey);
    result.raw_sop = rawSop;
    structureSpinner.succeed('Skill generated from video');
    return result;
  } catch (err) {
    structureSpinner.fail('Failed to structure skill');
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}
