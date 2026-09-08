import fs from "fs";
import path from "path";

/**
 * Resolves a reliable storage directory for data persistence.
 * Handles Railway Volumes (/data), relative folders ("data"), or process.cwd().
 * Automatically tests write permissions and creates parent folders recursively.
 */
function resolveStorageDirectory(): string {
  const envDir = process.env.STORAGE_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;

  if (envDir && envDir.trim()) {
    const candidate = path.isAbsolute(envDir.trim())
      ? envDir.trim()
      : path.resolve(process.cwd(), envDir.trim());

    try {
      if (!fs.existsSync(candidate)) {
        fs.mkdirSync(candidate, { recursive: true });
      }

      // Verify write capability
      const testFile = path.join(candidate, `.perm_test_${Date.now()}`);
      fs.writeFileSync(testFile, "test", "utf-8");
      fs.unlinkSync(testFile);

      console.log(`[Storage] Persistent storage directory active at: ${candidate}`);
      return candidate;
    } catch (err: any) {
      console.warn(
        `[Storage] Warning: Cannot write to candidate dir "${candidate}" (${err?.message || err}). Falling back to local directory.`
      );
    }
  }

  // Fallback to project root or local storage folder
  const fallback = process.cwd();
  try {
    const dataSubdir = path.join(fallback, "data");
    if (!fs.existsSync(dataSubdir)) {
      fs.mkdirSync(dataSubdir, { recursive: true });
    }
  } catch (e) {
    // Ignore error, fallback is cwd
  }

  console.log(`[Storage] Using storage directory: ${fallback}`);
  return fallback;
}

export const STORAGE_DIR = resolveStorageDirectory();
export const DATA_FILE = path.join(STORAGE_DIR, "data-store.json");

/**
 * Safely writes a file, automatically creating parent directories if they don't exist.
 * Includes a fallback in case the primary destination is temporarily unavailable.
 */
export function safeWriteFileSync(filePath: string, data: string | Buffer): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data, "utf-8");
  } catch (err: any) {
    console.error(`[Storage] Failed to write file "${filePath}":`, err?.message || err);

    // If writing data-store.json failed, attempt emergency write to cwd
    if (filePath.endsWith("data-store.json")) {
      try {
        const emergencyPath = path.join(process.cwd(), "data-store.json");
        if (emergencyPath !== filePath) {
          fs.writeFileSync(emergencyPath, data, "utf-8");
          console.warn(`[Storage] Emergency copy saved to: ${emergencyPath}`);
        }
      } catch (fallbackErr: any) {
        console.error(`[Storage] Emergency save failed:`, fallbackErr?.message || fallbackErr);
      }
    }
  }
}

/**
 * Safely reads a file with fallback support.
 */
export function safeReadFileSync(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }

    // Check emergency file in process.cwd() if primary not found
    if (filePath.endsWith("data-store.json")) {
      const emergencyPath = path.join(process.cwd(), "data-store.json");
      if (fs.existsSync(emergencyPath)) {
        return fs.readFileSync(emergencyPath, "utf-8");
      }
    }
  } catch (err: any) {
    console.error(`[Storage] Failed to read file "${filePath}":`, err?.message || err);
  }
  return null;
}
