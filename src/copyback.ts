import { GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from './config';
import { ossClient, s3Client, formatBytes } from './utils';
import chalk from 'chalk';
import { Readable, PassThrough } from 'stream';

export async function copyback(fileKey: string) {
  console.log(chalk.blue(`Copying file from S3 to OSS: ${fileKey}`));

  try {
    // Get file from S3
    const command = new GetObjectCommand({
      Bucket: config.aws.bucket,
      Key: fileKey,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body from S3');
    }

    const contentLength = response.ContentLength || 0;
    const contentType = response.ContentType || 'application/octet-stream';

    console.log(chalk.gray(`File size: ${formatBytes(contentLength)}`));
    console.log(chalk.gray(`Content-Type: ${contentType}`));

    // Create a pass-through stream with progress tracking
    const s3Stream = response.Body as Readable;
    const passThrough = new PassThrough();

    let transferred = 0;
    let lastTime = Date.now();
    let lastTransferred = 0;

    s3Stream.on('data', (chunk: Buffer) => {
      transferred += chunk.length;
      const now = Date.now();
      const delta = now - lastTime;

      if (delta > 500 || transferred === contentLength) {
        const speed = delta > 0 ? ((transferred - lastTransferred) / delta) * 1000 : 0;
        const percent = contentLength > 0 ? Math.round((transferred / contentLength) * 100) : 0;
        process.stdout.write(`\rTransferring: ${formatBytes(transferred)} / ${formatBytes(contentLength)} (${percent}%) | ${formatBytes(speed)}/s`);
        lastTime = now;
        lastTransferred = transferred;
      }
    });

    s3Stream.pipe(passThrough);

    // Stream directly to OSS (no buffering)
    // Set timeout based on file size: min 10 minutes, or 1 minute per 100MB
    const timeoutMs = Math.max(10 * 60 * 1000, Math.ceil(contentLength / (100 * 1024 * 1024)) * 60 * 1000);

    await ossClient.putStream(fileKey, passThrough, {
      contentLength,
      mime: contentType,
      timeout: timeoutMs,
    } as any);

    console.log(); // New line after progress
    console.log(chalk.green(`✓ Successfully copied ${fileKey} from S3 to OSS`));

  } catch (err: any) {
    console.log(); // New line in case of error during progress
    if (err.name === 'NoSuchKey') {
      console.error(chalk.red(`✗ File not found in S3: ${fileKey}`));
    } else {
      console.error(chalk.red(`✗ Failed to copy file: ${err.message}`));
    }
    process.exit(1);
  }
}
