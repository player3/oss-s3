import { GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from './config';
import { ossClient, s3Client, formatBytes } from './utils';
import chalk from 'chalk';
import { Readable } from 'stream';

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

    // Convert S3 stream to buffer for OSS upload
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];

    let downloaded = 0;

    for await (const chunk of stream) {
      chunks.push(chunk);
      downloaded += chunk.length;
      const percent = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
      process.stdout.write(`\rDownloading from S3: ${formatBytes(downloaded)} / ${formatBytes(contentLength)} (${percent}%)`);
    }
    console.log(); // New line after progress

    const buffer = Buffer.concat(chunks);

    // Upload to OSS
    console.log(chalk.gray('Uploading to OSS...'));

    await ossClient.put(fileKey, buffer, {
      headers: {
        'Content-Type': contentType,
      },
    });

    console.log(chalk.green(`✓ Successfully copied ${fileKey} from S3 to OSS`));

  } catch (err: any) {
    if (err.name === 'NoSuchKey') {
      console.error(chalk.red(`✗ File not found in S3: ${fileKey}`));
    } else {
      console.error(chalk.red(`✗ Failed to copy file: ${err.message}`));
    }
    process.exit(1);
  }
}
