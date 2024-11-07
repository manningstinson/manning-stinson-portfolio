import { execSync } from 'child_process';
import { createInterface } from 'readline';
import path from 'path';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function runGitCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' });
  } catch (error) {
    console.error(`Error executing git command: ${command}`);
    console.error(error.message);
    throw error;
  }
}

async function executeRestructuring() {
  try {
    // Get the current working directory
    const currentDir = process.cwd();
    const componentsDir = path.join(currentDir, 'src', 'components');

    // 1. Check for clean working directory
    const status = await runGitCommand('git status --porcelain');
    if (status.length > 0) {
      console.error('Error: Working directory is not clean. Please commit or stash changes first.');
      process.exit(1);
    }

    // 2. Get current branch name
    const currentBranch = (await runGitCommand('git rev-parse --abbrev-ref HEAD')).trim();
    console.log(`Current branch: ${currentBranch}`);

    // 3. Create and checkout new branch
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newBranchName = `refactor/component-restructure-${timestamp}`;
    
    console.log(`\nCreating new branch: ${newBranchName}`);
    await runGitCommand(`git checkout -b ${newBranchName}`);

    // 4. Run the restructuring scripts
    console.log('\nStarting component restructuring...');
    
    // First script - restructure components
    const { restructureComponents } = await import('./restructure-components.js');
    await restructureComponents(componentsDir);
    
    // Wait for confirmation before cleanup
    await question('\nPress Enter to proceed with cleanup...');
    
    // Second script - cleanup
    const { cleanupComponents } = await import('./cleanup-components.js');
    await cleanupComponents(componentsDir);

    // 5. Stage changes
    console.log('\nStaging changes...');
    await runGitCommand('git add .');

    // 6. Show diff for review
    console.log('\nChanges to be committed:');
    const diff = await runGitCommand('git diff --cached');
    console.log(diff);

    // 7. Ask for confirmation
    const shouldCommit = await question('\nWould you like to commit these changes? (yes/no): ');
    
    if (shouldCommit.toLowerCase() === 'yes') {
      const commitMessage = `refactor: Restructure component files

- Standardize component file naming
- Clean up directory structure
- Update import paths
- Remove unused files and directories`;

      await runGitCommand(`git commit -m "${commitMessage}"`);
      console.log('\nChanges committed successfully!');
      
      // Ask about pushing
      const shouldPush = await question('\nWould you like to push this branch? (yes/no): ');
      if (shouldPush.toLowerCase() === 'yes') {
        await runGitCommand(`git push -u origin ${newBranchName}`);
        console.log('\nBranch pushed successfully!');
      }
    } else {
      // Offer to reset if they don't want to commit
      const shouldReset = await question('\nWould you like to reset the changes? (yes/no): ');
      if (shouldReset.toLowerCase() === 'yes') {
        await runGitCommand('git reset --hard');
        await runGitCommand(`git checkout ${currentBranch}`);
        await runGitCommand(`git branch -D ${newBranchName}`);
        console.log('\nAll changes have been reset and the branch has been deleted.');
      }
    }

    console.log('\nNext steps:');
    console.log('1. Review the changes in your code editor');
    console.log('2. Test the application thoroughly');
    console.log('3. Create a pull request if everything looks good');
    console.log(`4. To rollback, use: git checkout ${currentBranch} && git branch -D ${newBranchName}`);

  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
executeRestructuring().catch(console.error);