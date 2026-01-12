# OSS to S3 Sync Tool

A robust TypeScript command-line utility to synchronize files from Aliyun Object Storage Service (OSS) to AWS S3.

## Features

- **Smart Sync**: Only uploads new or modified files (checked by size).
- **Resume Capability**: Automatically saves progress. If the process is interrupted, it resumes from where it left off without re-scanning or re-uploading completed files.
- **Visual Progress**: 
  - Overall progress bar with ETA.
  - Individual file transfer progress with real-time speed calculation.
- **Verification**: Verifies consistency between OSS and S3 after sync.
- **Type-Safe**: Built with TypeScript.

## Prerequisites

- Node.js (v16 or higher recommended)
- `npm` or `yarn`

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd oss-s3
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

1. Create a `.env` file in the root directory based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Aliyun OSS and AWS S3 credentials:

   ```ini
   # Aliyun OSS Configuration
   OSS_REGION=oss-cn-hangzhou
   OSS_ACCESS_KEY_ID=your_oss_access_key
   OSS_ACCESS_KEY_SECRET=your_oss_secret
   OSS_BUCKET=your_oss_bucket_name

   # AWS S3 Configuration
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret
   AWS_BUCKET=your_aws_bucket_name
   ```

## Usage

Build the project:
```bash
npm run build
```

### Sync Files
Start the synchronization process:
```bash
npm start sync
```
This command will:
1. Fetch file lists from both buckets (or load from a checkpoint).
2. specific files that are missing or have size mismatches in S3.
3. Display real-time progress.

### Verify Sync
Check for discrepancies between the source and destination:
```bash
npm start verify
```
This will report:
- Files missing in S3.
- Size mismatches.
- Extra files in S3 (that are not in OSS).

### Sync and Verify
Run both operations in sequence:
```bash
npm start all
```

## Development

Run in development mode (using `ts-node`):
```bash
npm run dev sync
```

## License

ISC
