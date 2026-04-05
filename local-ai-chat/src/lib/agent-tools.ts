import { tool } from 'ai';
import { z } from 'zod';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Resolves paths including support for the ~ home directory shortcut.
 */
function resolvePath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.resolve(process.cwd(), filePath);
}

/**
 * Expert Tools for the Intelligence Lab Agent.
 */
export const agentTools = {
  readFile: tool({
    description: 'Read the contents of a file from the local file system.',
    parameters: z.object({
      filePath: z.string().describe('Path to the file to read (supports ~ for home).'),
    }),
    execute: async ({ filePath }) => {
      const fullPath = resolvePath(filePath);
      console.log(`[Tool: readFile] Request: ${filePath}, Resolved: ${fullPath}`);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        return { content };
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`[Tool: readFile] Error: ${err.message}`);
        return { error: `Failed to read file: ${err.message}` };
      }
    },
  }),

  writeFile: tool({
    description: 'Write or overwrite a file on the local file system.',
    parameters: z.object({
      filePath: z.string().describe('Path to the file to write (supports ~ for home).'),
      content: z.string().describe('The content to write into the file.'),
    }),
    execute: async ({ filePath, content }) => {
      const fullPath = resolvePath(filePath);
      console.log(`[Tool: writeFile] Request: ${filePath}, Resolved: ${fullPath}, Content Length: ${content.length}`);
      try {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');
        console.log(`[Tool: writeFile] Success: Written to ${fullPath}`);
        return { success: true, message: `File written to ${filePath}` };
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`[Tool: writeFile] Error: ${err.message}`);
        return { error: `Failed to write file: ${err.message}` };
      }
    },
  }),

  listDirectory: tool({
    description: 'List files and directories in a given path.',
    parameters: z.object({
      dirPath: z.string().optional().default('.').describe('Path to the directory to list (supports ~ for home).'),
    }),
    execute: async ({ dirPath }) => {
      const fullPath = resolvePath(dirPath || '.');
      console.log(`[Tool: listDirectory] Request: ${dirPath}, Resolved: ${fullPath}`);
      try {
        const items = await fs.readdir(fullPath);
        return { items };
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`[Tool: listDirectory] Error: ${err.message}`);
        return { error: `Failed to list directory: ${err.message}` };
      }
    },
  }),

  runCommand: tool({
    description: 'Execute a shell command (e.g. git, grep, npm). Use with extreme caution.',
    parameters: z.object({
      command: z.string().describe('The full shell command to execute.'),
    }),
    execute: async ({ command }) => {
      console.log(`[Tool: runCommand] Executing: ${command}`);
      try {
        if (command.includes('rm -rf /') || command.includes(':(){:|:&};:')) {
          return { error: 'Dangerous command blocked for safety.' };
        }

        const { stdout, stderr } = await execAsync(command, {
          cwd: process.cwd(),
          timeout: 30000,
        });
        
        return {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        };
      } catch (error: unknown) {
        const err = error as Error & { stdout?: string; stderr?: string };
        console.error(`[Tool: runCommand] Error: ${err.message}`);
        return {
          error: err.message,
          stdout: err.stdout?.trim(),
          stderr: err.stderr?.trim(),
        };
      }
    },
  }),
};
