import { Upload } from '@aws-sdk/lib-storage';
import { config } from './config';
import { ossClient, s3Client, listAllOssFiles, listAllS3Files, formatBytes } from './utils';
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

    const multiBar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: '{bar} | {percentage}% | {value}/{total} | {data}',
    }, cliProgress.Presets.shades_classic);

    const totalBar = multiBar.create(ossFiles.size, 0, {
      data: 'Starting...'
    });
    
    // Format: [Bar] 50% | filename | 5MB/10MB | 1MB/s
    const fileBar = multiBar.create(100, 0, {
      data: 'Waiting...'
    });
    
    // Customize fileBar format to include filename and speed
    // We update the format dynamically or use a generic payload '{data}'
    // Let's use a specific format for fileBar if possible, but MultiBar shares options usually?
    // Actually MultiBar.create takes options.
    // Let's rely on the generic 'format' defined in MultiBar constructor but use 'data' heavily,
    // OR just use a wide 'data' field.
    // Better: Define specific format for each bar?
    // cli-progress 3.x MultiBar create() signature: create(total, startValue, payload, options)
    
    // Re-create bars with specific formats
    multiBar.remove(totalBar);
    multiBar.remove(fileBar);

    const mainBar = multiBar.create(ossFiles.size, 0, {
      status: 'Starting...'
    }, {
      format: 'Total:  ' + chalk.cyan('{bar}') + ' {percentage}% | {value}/{total} Files | ETA: {eta_formatted} | {status}'
    });

    const currentFileBar = multiBar.create(0, 0, {
      filename: 'Waiting...',
      transfer: '0/0',
      speed: '0/0',
    }, {
      format: 'Current: ' + chalk.green('{bar}') + ' {percentage}% | {filename} | {transfer} | {speed}'
    });


    let processedFiles = 0;

    for (const [fileName, size] of ossFiles) {
      // Check if file exists in S3 and has same size
      if (s3Files.has(fileName)) {
        const s3Size = s3Files.get(fileName);
        if (s3Size === size) {
          skipCount++;
          processedFiles++;
          mainBar.increment(1, {
            status: chalk.gray(`Skipped: ${fileName}`)
          });
          continue;
        } else {
          mainBar.update(processedFiles, {
            status: chalk.yellow(`Updating: ${fileName}`)
          });
        }
      } else {
        mainBar.update(processedFiles, {
          status: chalk.yellow(`Syncing: ${fileName}`)
        });
      }

      try {
        currentFileBar.start(size, 0, {
            filename: fileName,
            transfer: `0 / ${formatBytes(size)}`,
            speed: '0 B/s'
        });

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

        let lastLoaded = 0;
        let lastTime = Date.now();
        
        upload.on('httpUploadProgress', (progress) => {
          if (progress.loaded) {
            const now = Date.now();
            const delta = now - lastTime;
            
            // Update speed every 500ms or so to avoid flickering? 
            // Or just every event (events might be frequent)
            if (delta > 500 || progress.loaded === progress.total) {
                const loadedDelta = progress.loaded - lastLoaded;
                const speed = (loadedDelta / delta) * 1000; // bytes per second
                
                currentFileBar.update(progress.loaded, {
                    transfer: `${formatBytes(progress.loaded)} / ${formatBytes(size)}`,
                    speed: `${formatBytes(speed)}/s`
                });
                
                lastLoaded = progress.loaded;
                lastTime = now;
            } else {
                 currentFileBar.update(progress.loaded, {
                    transfer: `${formatBytes(progress.loaded)} / ${formatBytes(size)}`
                });
            }
          }
        });

        await upload.done();
        
        currentFileBar.update(size, {
            transfer: `${formatBytes(size)} / ${formatBytes(size)}`,
            speed: 'Done'
        });
        
        successCount++;
        processedFiles++;
        
        // Update checkpoint
        checkpointManager.appendJournal(fileName, size);
        s3Files.set(fileName, size);
        
        mainBar.increment(1, {
          status: chalk.green(`Synced: ${fileName}`)
        });
        
      } catch (err: any) {
        failCount++;
        processedFiles++;
        mainBar.increment(1, {
          status: chalk.red(`Failed: ${fileName}`)
        });
        // Log error below bars
        multiBar.log(chalk.red(`\n✗ Failed to sync ${fileName}: ${err.message}\n`));
      }
    }

    multiBar.stop();
    
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