import { Upload } from '@aws-sdk/lib-storage';
import { config } from './config';
import { ossClient, s3Client, listAllOssFiles, listAllS3Files } from './utils';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { CheckpointManager } from './checkpoint';

export async function sync() {
  console.log(chalk.blue('Starting sync process...'));
  
  const checkpointManager = new CheckpointManager();
  let ossFiles: Map<string, number>;
  let s3Files: Map<string, number>;

  try {
    const loaded = checkpointManager.loadSnapshot();
    if (loaded) {
      console.log(chalk.cyan('Found unfinished sync checkpoint. Resuming...'));
      ossFiles = loaded.ossFiles;
      s3Files = loaded.s3Files;
    } else {
      console.log('Fetching file lists...');
      [ossFiles, s3Files] = await Promise.all([
        listAllOssFiles(),
        listAllS3Files()
      ]);
      checkpointManager.saveSnapshot(ossFiles, s3Files);
    }
    
    console.log(chalk.blue(`Found ${ossFiles.size} files in OSS bucket ${config.oss.bucket}`));
    console.log(chalk.blue(`Found ${s3Files.size} files in S3 bucket ${config.aws.bucket}`));

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    const progressBar = new cliProgress.SingleBar({
      format: 'Syncing |' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} Files || ETA: {eta_formatted} || {status}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    }, cliProgress.Presets.shades_classic);

    progressBar.start(ossFiles.size, 0, {
      status: 'Starting...'
    });

    let processedFiles = 0;

    for (const [fileName, size] of ossFiles) {
      // Check if file exists in S3 and has same size
      if (s3Files.has(fileName)) {
        const s3Size = s3Files.get(fileName);
        if (s3Size === size) {
          skipCount++;
          processedFiles++;
          progressBar.increment(1, {
            status: chalk.gray(`Skipped: ${fileName}`)
          });
          continue;
        } else {
          progressBar.update(processedFiles, {
            status: chalk.yellow(`Updating: ${fileName}`)
          });
        }
      } else {
        progressBar.update(processedFiles, {
          status: chalk.yellow(`Syncing: ${fileName}`)
        });
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
        successCount++;
        processedFiles++;
        // Update checkpoint
        checkpointManager.appendJournal(fileName, size);
        s3Files.set(fileName, size); // Update memory map too for consistency
        
        progressBar.increment(1, {
          status: chalk.green(`Synced: ${fileName}`)
        });
      } catch (err: any) {
        failCount++;
        processedFiles++;
        progressBar.increment(1, {
          status: chalk.red(`Failed: ${fileName}`)
        });
      }
    }

    progressBar.stop();
    
    // Only clear checkpoint if everything succeeded? 
    // Or if we finished the loop?
    // If we finished the loop, we processed everything we knew about.
    // If there were failures, we might want to keep the checkpoint to retry failures?
    // But failures are counted. If we re-run, we probably want to re-list to see if they were fixed?
    // Actually, if we finish the loop, we should probably clear the checkpoint so next run is fresh.
    // Unless there were failures?
    // Standard "Resume" logic: If we finished the iteration, the "job" is done.
    if (failCount === 0) {
        checkpointManager.clear();
    } else {
        console.log(chalk.yellow(`\nSync finished with ${failCount} failures. Checkpoint preserved for retry.`));
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