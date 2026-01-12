import fs from 'fs';
import path from 'path';

const SYNC_DIR = '.sync';
const SNAPSHOT_FILE = path.join(SYNC_DIR, 'snapshot.json');
const JOURNAL_FILE = path.join(SYNC_DIR, 'journal.log');

interface Snapshot {
  timestamp: number;
  ossFiles: [string, number][];
  s3Files: [string, number][];
}

export class CheckpointManager {
  hasCheckpoint(): boolean {
    return fs.existsSync(SNAPSHOT_FILE);
  }

  saveSnapshot(ossFiles: Map<string, number>, s3Files: Map<string, number>) {
    if (!fs.existsSync(SYNC_DIR)) {
      fs.mkdirSync(SYNC_DIR, { recursive: true });
    }

    const data: Snapshot = {
      timestamp: Date.now(),
      ossFiles: Array.from(ossFiles.entries()),
      s3Files: Array.from(s3Files.entries()),
    };
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(data, null, 2));
    // Clear journal when creating a new snapshot
    if (fs.existsSync(JOURNAL_FILE)) {
      fs.unlinkSync(JOURNAL_FILE);
    }
  }

  loadSnapshot(): { ossFiles: Map<string, number>, s3Files: Map<string, number> } | null {
    if (!this.hasCheckpoint()) return null;

    try {
      const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf-8');
      const data: Snapshot = JSON.parse(raw);
      
      const ossFiles = new Map<string, number>(data.ossFiles);
      const s3Files = new Map<string, number>(data.s3Files);

      // Replay journal
      if (fs.existsSync(JOURNAL_FILE)) {
        const journalContent = fs.readFileSync(JOURNAL_FILE, 'utf-8');
        const lines = journalContent.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const [fileName, sizeStr] = line.split('::');
            if (fileName && sizeStr) {
              s3Files.set(fileName, parseInt(sizeStr, 10));
            }
          } catch (e) {
            // Ignore bad lines
          }
        }
      }

      return { ossFiles, s3Files };
    } catch (error) {
      console.error('Failed to load checkpoint:', error);
      return null;
    }
  }

  appendJournal(fileName: string, size: number) {
    if (!fs.existsSync(SYNC_DIR)) {
      fs.mkdirSync(SYNC_DIR, { recursive: true });
    }
    fs.appendFileSync(JOURNAL_FILE, `${fileName}::${size}\n`);
  }

  clear() {
    if (fs.existsSync(SNAPSHOT_FILE)) fs.unlinkSync(SNAPSHOT_FILE);
    if (fs.existsSync(JOURNAL_FILE)) fs.unlinkSync(JOURNAL_FILE);
  }
  
  getCheckpointAge(): number {
      if (!this.hasCheckpoint()) return 0;
      const stats = fs.statSync(SNAPSHOT_FILE);
      return Date.now() - stats.mtimeMs;
  }
}
