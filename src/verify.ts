import { listAllOssFiles, listAllS3Files } from './utils';
import chalk from 'chalk';

export async function verify() {
  console.log(chalk.blue('Starting verification...'));

  try {
    console.log('Listing OSS files...');
    const ossFiles = await listAllOssFiles();
    console.log(`OSS: ${ossFiles.size} files`);

    console.log('Listing S3 files...');
    const s3Files = await listAllS3Files();
    console.log(`S3: ${s3Files.size} files`);

    const missingInS3: string[] = [];
    const sizeMismatch: string[] = [];
    const extraInS3: string[] = [];

    // Check OSS files against S3
    for (const [name, size] of ossFiles) {
      if (!s3Files.has(name)) {
        missingInS3.push(name);
      } else {
        const s3Size = s3Files.get(name);
        if (s3Size !== size) {
          sizeMismatch.push(name + ` (OSS: ${size}, S3: ${s3Size})`);
        }
        // Remove found files to identify extras later
        s3Files.delete(name);
      }
    }

    // Remaining S3 files are extras
    for (const name of s3Files.keys()) {
      extraInS3.push(name);
    }

    if (missingInS3.length === 0 && sizeMismatch.length === 0) {
      console.log(chalk.green('✓ Verification Passed: All files match (ignoring extras in S3).'));
    } else {
      console.error(chalk.red('✗ Verification Failed.'));
    }

    if (missingInS3.length > 0) {
      console.log(chalk.red(`Missing in S3 (${missingInS3.length}):`));
      missingInS3.slice(0, 10).forEach(f => console.log(`  - ${f}`));
      if (missingInS3.length > 10) console.log(`  ...and ${missingInS3.length - 10} more`);
    }

    if (sizeMismatch.length > 0) {
      console.log(chalk.red(`Size Mismatch (${sizeMismatch.length}):`));
      sizeMismatch.slice(0, 10).forEach(f => console.log(`  - ${f}`));
      if (sizeMismatch.length > 10) console.log(`  ...and ${sizeMismatch.length - 10} more`);
    }

    if (extraInS3.length > 0) {
      console.log(chalk.yellow(`Extra files in S3 (not in OSS) (${extraInS3.length}):`));
      extraInS3.slice(0, 10).forEach(f => console.log(`  - ${f}`));
      if (extraInS3.length > 10) console.log(`  ...and ${extraInS3.length - 10} more`);
    }

  } catch (error: any) {
    console.error(chalk.red(`Verification failed with error: ${error.message}`));
  }
}