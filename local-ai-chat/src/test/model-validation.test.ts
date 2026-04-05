import { describe, it, expect } from 'vitest';
import { validateModel, normalizeOllamaUrl } from '../lib/utils';

describe('Model and URL Validation', () => {
  describe('validateModel', () => {
    it('should migrate old "gemma4:4b" to "gemma4:e4b"', () => {
      expect(validateModel('gemma4:4b')).toBe('gemma4:e4b');
    });
  });

  describe('normalizeOllamaUrl', () => {
    it('should return default URL with /api', () => {
      expect(normalizeOllamaUrl('')).toBe('http://localhost:11434/api');
    });

    it('should keep the /api suffix if present', () => {
      expect(normalizeOllamaUrl('http://localhost:11434/api')).toBe('http://localhost:11434/api');
    });

    it('should add /api if it is missing', () => {
      expect(normalizeOllamaUrl('http://localhost:11434')).toBe('http://localhost:11434/api');
    });

    it('should handle trailing slashes and still end with /api', () => {
      expect(normalizeOllamaUrl('http://localhost:11434/')).toBe('http://localhost:11434/api');
    });
  });
});
