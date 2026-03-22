import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { api } from '../api.js';
import { getSkillsDir, getToken, getApiUrl } from '../config.js';

function bumpVersion(version) {
  const parts = (version || '1.0.0').split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

export function skillsCommand(program) {
  const cmd = program
    .command('skills')
    .description('Manage local skills');

  cmd
    .command('list')
    .description('List local skills')
    .action(() => {
      const dir = getSkillsDir();
      const skills = readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => {
          const jsonPath = join(dir, d.name, 'skill.json');
          if (existsSync(jsonPath)) {
            const meta = JSON.parse(readFileSync(jsonPath, 'utf8'));
            return { name: d.name, ...meta };
          }
          return { name: d.name, description: '(no metadata)' };
        });

      if (skills.length === 0) {
        console.log(chalk.dim('No local skills. Run `provision teach` to create one.'));
        return;
      }

      console.log(chalk.bold(`\n${skills.length} local skill(s):\n`));
      skills.forEach(s => {
        console.log(`  ${chalk.cyan(s.name)} ${chalk.dim(`v${s.version || '?'}`)}`);
        if (s.description) console.log(`  ${chalk.dim(s.description)}`);
        console.log('');
      });
    });

  cmd
    .command('info <name>')
    .description('Show skill details')
    .action((name) => {
      const skillDir = join(getSkillsDir(), name);
      const jsonPath = join(skillDir, 'skill.json');

      if (!existsSync(jsonPath)) {
        console.error(chalk.red(`Skill "${name}" not found locally.`));
        process.exit(1);
      }

      const meta = JSON.parse(readFileSync(jsonPath, 'utf8'));
      console.log(chalk.bold(`\n${meta.name} v${meta.version || '1.0.0'}\n`));
      if (meta.description) console.log(`  ${meta.description}\n`);
      if (meta.steps) {
        console.log(chalk.dim('  Steps:'));
        meta.steps.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
      }
      if (meta.requires?.env?.length) {
        console.log(chalk.dim(`\n  Requires: ${meta.requires.env.join(', ')}`));
      }
      if (meta.tools?.length) {
        console.log(chalk.dim(`  Tools: ${meta.tools.join(', ')}`));
      }
      console.log('');
    });

  cmd
    .command('edit <name>')
    .description('Edit an existing skill')
    .option('-d, --describe <prompt>', 'Modify with natural language instructions')
    .option('-v, --video <path>', 'Re-teach from a video')
    .option('-e, --editor', 'Open SKILL.md in your editor')
    .action(async (name, options) => {
      const skillDir = join(getSkillsDir(), name);
      const jsonPath = join(skillDir, 'skill.json');
      const skillPath = join(skillDir, 'SKILL.md');

      if (!existsSync(jsonPath) || !existsSync(skillPath)) {
        console.error(chalk.red(`Skill "${name}" not found locally. Run \`provision teach\` first.`));
        process.exit(1);
      }

      const meta = JSON.parse(readFileSync(jsonPath, 'utf8'));
      const existingContent = readFileSync(skillPath, 'utf8');

      if (options.editor) {
        // --editor: open SKILL.md in $EDITOR
        const editor = process.env.EDITOR || process.env.VISUAL || 'nano';
        console.log(chalk.dim(`Opening ${skillPath} in ${editor}...`));

        try {
          execSync(`${editor} "${skillPath}"`, { stdio: 'inherit' });
        } catch (err) {
          console.error(chalk.red(`Editor exited with error: ${err.message}`));
          process.exit(1);
        }

        // Bump version
        const oldVersion = meta.version || '1.0.0';
        meta.version = bumpVersion(oldVersion);
        writeFileSync(jsonPath, JSON.stringify(meta, null, 2));

        console.log(chalk.green(`\nVersion bumped: ${chalk.dim(oldVersion)} -> ${chalk.bold(meta.version)}`));
        console.log(chalk.green(`Skill "${name}" updated.`));
      } else if (options.describe) {
        // --describe: send to API for AI-powered editing
        const spinner = ora('Modifying skill...').start();

        try {
          const result = await api.editSkill(existingContent, options.describe);
          spinner.succeed('Skill modified');

          if (result.changes_summary) {
            console.log(chalk.dim(`\n  Changes: ${result.changes_summary}\n`));
          }

          // Show preview
          console.log(chalk.bold('Updated SKILL.md:\n'));
          const lines = (result.skill_content || '').split('\n').slice(0, 20);
          lines.forEach(line => console.log(chalk.dim(`  ${line}`)));
          if ((result.skill_content || '').split('\n').length > 20) {
            console.log(chalk.dim('  ...'));
          }
          console.log('');

          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Save these changes?',
              default: true,
            },
          ]);

          if (!confirm) {
            console.log(chalk.dim('Cancelled.'));
            return;
          }

          // Save
          writeFileSync(skillPath, result.skill_content);

          const oldVersion = meta.version || '1.0.0';
          meta.version = bumpVersion(oldVersion);
          writeFileSync(jsonPath, JSON.stringify(meta, null, 2));

          console.log(chalk.green(`\nVersion bumped: ${chalk.dim(oldVersion)} -> ${chalk.bold(meta.version)}`));
          console.log(chalk.green(`Skill "${name}" updated.`));
        } catch (err) {
          spinner.fail('Failed to modify skill');
          console.error(chalk.red(err.message));
          process.exit(1);
        }
      } else if (options.video) {
        // --video: re-teach from a video, keeping the same name
        const videoPath = options.video;
        if (!existsSync(videoPath)) {
          console.error(chalk.red(`Video file not found: ${videoPath}`));
          process.exit(1);
        }

        const spinner = ora('Uploading and analyzing video...').start();

        try {
          const FormData = (await import('undici')).FormData;
          const { Blob } = await import('buffer');
          const videoData = readFileSync(videoPath);

          const formData = new FormData();
          formData.append('video', new Blob([videoData]), basename(videoPath));

          const baseUrl = getApiUrl();
          const response = await fetch(`${baseUrl}/api/cli/skills/generate-video`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${getToken()}`,
              'Accept': 'application/json',
            },
            body: formData,
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Upload failed: ${response.status}`);
          }

          const result = await response.json();
          spinner.succeed('Video analyzed');

          // Generate the full skill from extracted steps
          const genDescription = 'Workflow steps:\n' + result.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
          const genSpinner = ora('Regenerating skill files...').start();

          const skillFiles = await api.generateSkill(genDescription);
          genSpinner.succeed('Skill regenerated');

          // Overwrite SKILL.md
          writeFileSync(skillPath, skillFiles.skill_content);

          // Update metadata but keep the name
          const oldVersion = meta.version || '1.0.0';
          meta.version = bumpVersion(oldVersion);
          meta.steps = result.steps || meta.steps;
          meta.tools = result.tools || meta.tools;
          if (result.requires_env) {
            meta.requires = { ...meta.requires, env: result.requires_env };
          }
          if (skillFiles.tags) {
            meta.tags = skillFiles.tags;
          }
          writeFileSync(jsonPath, JSON.stringify(meta, null, 2));

          // Update README if generated
          if (skillFiles.readme) {
            writeFileSync(join(skillDir, 'README.md'), skillFiles.readme);
          }

          console.log(chalk.green(`\nVersion bumped: ${chalk.dim(oldVersion)} -> ${chalk.bold(meta.version)}`));
          console.log(chalk.green(`Skill "${name}" updated from video.`));
        } catch (err) {
          spinner.fail('Failed to process video');
          console.error(chalk.red(err.message));
          process.exit(1);
        }
      } else {
        console.error(chalk.red('Please specify one of: --editor, --describe, or --video'));
        process.exit(1);
      }
    });
}
