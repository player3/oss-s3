import OSS from 'ali-oss';
import { S3Client, ListObjectsV2Command, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import { config } from './config';

export const ossClient = new OSS({
  region: config.oss.region,
  accessKeyId: config.oss.accessKeyId,
  accessKeySecret: config.oss.accessKeySecret,
  bucket: config.oss.bucket,
});

export const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

export async function listAllOssFiles(): Promise<Map<string, number>> {
  let continuationToken: string | null = null;
  const files = new Map<string, number>();

  do {
    const result: OSS.ListObjectResult = await ossClient.list({
      'max-keys': 1000,
      'marker': continuationToken || undefined,
    }, {});
    
    if (result.objects) {
      for (const obj of result.objects) {
        files.set(obj.name, obj.size);
      }
    }
    
    // @ts-ignore
    continuationToken = result.nextMarker || null;
  } while (continuationToken);

  return files;
}

export async function listAllS3Files(): Promise<Map<string, number>> {
  let continuationToken: string | undefined = undefined;
  const files = new Map<string, number>();

  do {
    const command = new ListObjectsV2Command({
      Bucket: config.aws.bucket,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });

    const response: ListObjectsV2CommandOutput = await s3Client.send(command);
    
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          files.set(obj.Key, obj.Size || 0);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
