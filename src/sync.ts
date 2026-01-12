import { Upload } from '@aws-sdk/lib-storage';
import { config } from './config';
import { ossClient, s3Client, listAllOssFiles, listAllS3Files } from './utils';
import chalk from 'chalk';

export async function sync() {
  console.log(chalk.blue('Starting sync process...'));
  
  try {
    console.log('Fetching file lists...');
    const [ossFiles, s3Files] = await Promise.all([
      listAllOssFiles(),
      listAllS3Files()
    ]);
    
    console.log(chalk.blue(`Found ${ossFiles.size} files in OSS bucket ${config.oss.bucket}`));
    console.log(chalk.blue(`Found ${s3Files.size} files in S3 bucket ${config.aws.bucket}`));

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const [fileName, size] of ossFiles) {
      // Check if file exists in S3 and has same size
      if (s3Files.has(fileName)) {
        const s3Size = s3Files.get(fileName);
        if (s3Size === size) {
          console.log(chalk.gray(`Skipping: ${fileName} (Already exists and size matches)`));
          skipCount++;
          continue;
        } else {
          console.log(chalk.yellow(`Updating: ${fileName} (Size mismatch: OSS=${size}, S3=${s3Size})`));
        }
      } else {
        console.log(chalk.yellow(`Syncing: ${fileName} (${size} bytes)`));
      }

      try {
        // Get stream from OSS
        const result = await ossClient.getStream(fileName);
        const stream = result.stream;

        // Upload to S3
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: config.aws.bucket,
            Key: fileName,
            Body: stream,
            ContentType: (result.res as any).headers['content-type']
          },
        });

        await upload.done();
        console.log(chalk.green(`✓ Synced: ${fileName}`));
        successCount++;
      } catch (err: any) {
        console.error(chalk.red(`✗ Failed to sync ${fileName}: ${err.message}`));
        failCount++;
      }
    }

    console.log(chalk.blue('Sync completed.'));
    console.log(chalk.green(`Synced: ${successCount}`));
    console.log(chalk.gray(`Skipped: ${skipCount}`));
    if (failCount > 0) {
      console.log(chalk.red(`Failed: ${failCount}`));
    }

  } catch (error: any) {
    console.error(chalk.red(`Sync failed with error: ${error.message}`));
  }
}