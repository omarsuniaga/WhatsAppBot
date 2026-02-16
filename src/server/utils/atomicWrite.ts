/**
 * Atomic file write utility
 * Writes to a temporary file first, then renames to the target path.
 * This prevents data corruption if the process crashes mid-write.
 */
import { writeFileSync, renameSync, unlinkSync } from 'fs';

export function writeFileSyncAtomic(filePath: string, data: string): void {
    const tmpPath = `${filePath}.tmp.${process.pid}`;
    try {
        writeFileSync(tmpPath, data, 'utf-8');
        renameSync(tmpPath, filePath);
    } catch (error) {
        // Clean up temp file on failure
        try { unlinkSync(tmpPath); } catch (_) { /* ignore */ }
        throw error;
    }
}
