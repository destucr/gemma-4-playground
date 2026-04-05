import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Recursively scans the project directory to build a file list for the @ autocomplete.
 * Ignores common dependency and build folders.
 */
async function getFiles(dir: string, baseDir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    const relativePath = path.relative(baseDir, res);

    // Filter out unwanted directories
    if (dirent.isDirectory()) {
      if (['node_modules', '.next', '.git', 'dist', 'build', '.vscode'].includes(dirent.name)) {
        return [];
      }
      return getFiles(res, baseDir);
    }
    return [relativePath];
  }));
  return files.flat();
}

export async function GET() {
  try {
    const projectRoot = process.cwd();
    // We scan the parent directory as well if needed, 
    // but typically we stay within the project root for safety.
    const fileList = await getFiles(projectRoot, projectRoot);
    
    return NextResponse.json({ files: fileList });
  } catch (error) {
    console.error('File discovery error:', error);
    return NextResponse.json({ error: 'Failed to scan directory' }, { status: 500 });
  }
}
