import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { api } from '../api.js';
import { getSkillsDir, getToken, getApiUrl } from '../config.js';

export function teachCommand(program) {
  program
    .command('teach')
    .description('Create a new skill by describing what it should do')
    .option('-d, --describe <description>', 'Describe the workflow in text')
    .option('-v, --video <path>', 'Learn from a screen recording')
    .option('-n, --name <name>', 'Skill name')
    .action(async (options) => {
      let result;

      if (options.video) {
        // Video-based teaching (async: upload → poll for completion)
        const videoPath = options.video;
        if (!existsSync(videoPath)) {
          console.error(chalk.red(`Video file not found: ${videoPath}`));
          process.exit(1);
        }

        const spinner = ora('Uploading video...').start();

        try {
          const videoData = readFileSync(videoPath);
          const ext = basename(videoPath).split('.').pop()?.toLowerCase();
          const mimeTypes = {
            mp4: 'video/mp4',
            webm: 'video/webm',
            mov: 'video/quicktime',
            qt: 'video/quicktime',
          };
          const mimeType = mimeTypes[ext] || 'video/mp4';

          const videoFile = new File([videoData], basename(videoPath), { type: mimeType });

          const formData = new FormData();
          formData.append('video', videoFile);

          const baseUrl = getApiUrl();

          if (process.env.PROVISION_DEBUG) {
            console.error(`[DEBUG] Uploading ${basename(videoPath)} (${(videoData.length / 1024 / 1024).toFixed(1)}MB, ${mimeType})`);
            console.error(`[DEBUG] POST ${baseUrl}/api/cli/skills/generate-video`);
          }

          const uploadResponse = await fetch(`${baseUrl}/api/cli/skills/generate-video`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${getToken()}`,
              'Accept': 'application/json',
            },
            body: formData,
          });

          if (!uploadResponse.ok) {
            const text = await uploadResponse.text();
            if (process.env.PROVISION_DEBUG) {
              console.error(`[DEBUG] Status: ${uploadResponse.status}`);
              console.error(`[DEBUG] Body: ${text.slice(0, 500)}`);
            }
            let err = {};
            try { err = JSON.parse(text); } catch {}
            throw new Error(err.message || `Upload failed: ${uploadResponse.status}`);
          }

          const { generation_id } = await uploadResponse.json();
          spinner.succeed('Video uploaded');

          // Poll for completion
          const pollSpinner = ora('Analyzing video and generating skill (this may take a few minutes)...').start();

          const poll = async () => {
            while (true) {
              await new Promise(r => setTimeout(r, 5000));

              const statusResponse = await fetch(`${baseUrl}/api/cli/skills/generations/${generation_id}`, {
                headers: {
                  'Authorization': `Bearer ${getToken()}`,
                  'Accept': 'application/json',
                },
              });

              if (!statusResponse.ok) {
                throw new Error('Failed to check generation status');
              }

              const data = await statusResponse.json();

              if (data.status === 'completed') {
                return data.result;
              }

              if (data.status === 'failed') {
                throw new Error(data.error || 'Video analysis failed');
              }

              // Still processing — update spinner
              if (data.status === 'processing') {
                pollSpinner.text = 'Extracting workflow from video...';
              }
            }
          };

          result = await poll();
          pollSpinner.succeed('Skill generated from video');
        } catch (err) {
          spinner.fail('Failed to analyze video');
          console.error(chalk.red(err.message));
          process.exit(1);
        }
      } else {
        // Text-based teaching
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

        try {
          result = await api.generateSkill(description);
          spinner.succeed('Workflow understood');
        } catch (err) {
          spinner.fail('Failed to understand workflow');
          console.error(chalk.red(err.message));
          process.exit(1);
        }
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
      const genDescription = options.video
        ? 'Workflow steps:\n' + finalSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')
        : (options.describe || '') + '\n\nConfirmed steps:\n' + finalSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');

      const genSpinner = ora('Generating skill files...').start();

      let skillFiles;
      try {
        skillFiles = await api.generateSkill(genDescription);
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
        description: skillFiles.description || genDescription.slice(0, 200),
        steps: finalSteps,
        tools: result.tools || [],
        requires: { env: result.requires_env || [] },
        tags: skillFiles.tags || [],
      }, null, 2));
      writeFileSync(join(skillDir, 'README.md'), skillFiles.readme || `# ${skillName}\n\n${genDescription}`);

      console.log(chalk.green(`\n✓ Skill saved to ${chalk.bold(skillDir)}`));

      // Step 6: Offer install options (multi-select)
      const { targets } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'targets',
          message: 'Where would you like to install this skill?',
          choices: [
            { name: 'Publish to Provision', value: 'publish' },
            { name: 'Claude Code (~/.claude/skills/)', value: 'claude-code' },
            { name: 'OpenClaw local (~/.openclaw/skills/)', value: 'openclaw' },
            { name: 'Cursor (.cursor/skills/)', value: 'cursor' },
            { name: 'Codex (.codex/skills/)', value: 'codex' },
          ],
        },
      ]);

      const home = process.env.HOME;
      const skillContent = skillFiles.skill_content;
      const readmeContent = skillFiles.readme || `# ${skillName}\n\n${genDescription}`;

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
            description: skillFiles.description || genDescription.slice(0, 200),
            skill_content: skillContent,
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

      if (targets.length === 0) {
        console.log(chalk.dim('Skill saved locally only.'));
      }

      console.log('');
    });
}
