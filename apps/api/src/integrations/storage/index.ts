import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';

export interface StorageProvider {
  save(file: Express.Multer.File, folder: string): Promise<string>;
  remove(url: string): Promise<void>;
}

const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

class LocalStorage implements StorageProvider {
  private root = path.resolve(process.cwd(), env.UPLOAD_DIR);

  get rootDir() {
    return this.root;
  }

  async save(file: Express.Multer.File, folder: string) {
    const safeFolder = folder.replace(/[^a-z0-9-_]/gi, '');
    const name = `${Date.now()}-${randomBytes(6).toString('hex')}${EXT[file.mimetype] ?? ''}`;
    const dir = path.join(this.root, safeFolder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), file.buffer);
    return `${env.APP_URL}/uploads/${safeFolder}/${name}`;
  }

  async remove(url: string) {
    const marker = '/uploads/';
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const rel = url.slice(idx + marker.length);
    const target = path.resolve(this.root, rel);
    if (!target.startsWith(this.root)) return; // cegah path traversal
    await unlink(target).catch(() => undefined);
  }
}

/** Ganti implementasi ini (S3, GCS, dsb.) tanpa mengubah modul lain */
export const storage = new LocalStorage();
