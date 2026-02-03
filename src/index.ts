import { checkConfig } from './config';
import { sync } from './sync';
import { verify } from './verify';
import { copyback } from './copyback';
import chalk from 'chalk';

async function main() {
  checkConfig();

  const command = process.argv[2];
  const fileKey = process.argv[3];

  if (!command) {
    console.log(chalk.red('Please provide a command: sync [file], verify, all, or copyback <file>'));
    process.exit(1);
  }

  switch (command) {
    case 'sync':
      await sync(fileKey);
      break;
    case 'verify':
      await verify();
      break;
    case 'all':
      await sync();
      console.log('---');
      await verify();
      break;
    case 'copyback':
      if (!fileKey) {
        console.log(chalk.red('Please provide a file key for copyback command'));
        console.log('Usage: copyback <file-key>');
        process.exit(1);
      }
      await copyback(fileKey);
      break;
    default:
      console.log(chalk.red(`Unknown command: ${command}`));
      console.log('Available commands: sync [file], verify, all, copyback <file>');
      process.exit(1);
  }
}

main().catch(err => {
  console.error(chalk.red('Unexpected error:'), err);
  process.exit(1);
});
