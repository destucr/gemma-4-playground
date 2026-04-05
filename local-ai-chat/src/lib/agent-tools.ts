import { tool } from 'ai';
import { z } from 'zod';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Expert Tools for the Intelligence Lab Agent.
 * Enables file system access and shell command execution.
 */
export const agentTools = {
  readFile: tool({
    description: 'Read the contents of a file from the local file system.',
    parameters: z.object({
      filePath: z.string().describe('Relative path to the file to read.'),
    }),
    execute: async ({ filePath }) => {
      try {
        const fullPath = path.resolve(process.cwd(), filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        return { content };
      } catch (error: unknown) {
        const err = error as Error;
        return { error: `Failed to read file: ${err.message}` };
      }
    },
  }),

  writeFile: tool({
    description: 'Write or overwrite a file on the local file system.',
    parameters: z.object({
      filePath: z.string().describe('Relative path to the file to write.'),
      content: z.string().describe('The content to write into the file.'),
    }),
    execute: async ({ filePath, content }) => {
      try {
        const fullPath = path.resolve(process.cwd(), filePath);
        await fs.writeFile(fullPath, content, 'utf-8');
        return { success: true, message: `File written to ${filePath}` };
      } catch (error: unknown) {
        const err = error as Error;
        return { error: `Failed to write file: ${err.message}` };
      }
    },
  }),

  listDirectory: tool({
    description: 'List files and directories in a given path.',
    parameters: z.object({
      dirPath: z.string().optional().default('.').describe('Relative path to the directory to list.'),
    }),
    execute: async ({ dirPath }) => {
      try {
        const fullPath = path.resolve(process.cwd(), dirPath || '.');
        const items = await fs.readdir(fullPath);
        return { items };
      } catch (error: unknown) {
        const err = error as Error;
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
      try {
        // Simple safety check: prevent some obviously dangerous commands
        if (command.includes('rm -rf /') || command.includes(':(){:|:&};:')) {
          return { error: 'Dangerous command blocked for safety.' };
        }

        const { stdout, stderr } = await execAsync(command, {
          cwd: process.cwd(),
          timeout: 30000, // 30 second timeout
        });
        
        return {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        };
      } catch (error: unknown) {
        const err = error as Error & { stdout?: string; stderr?: string };
        return {
          error: err.message,
          stdout: err.stdout?.trim(),
          stderr: err.stderr?.trim(),
        };
      }
    },
  }),
};
