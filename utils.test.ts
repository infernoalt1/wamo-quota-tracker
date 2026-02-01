import { describe, expect, test } from 'bun:test';
import {
  extractMetadata,
  parseBulkLatex,
  isValidStatus,
  normalizeDifficulty
} from './utils';

describe('extractMetadata', () => {
  test('extracts solution from LaTeX', () => {
    const content = `
      Find the value of $x$.
      \\begin{solution}
      The answer is $x = 5$.
      \\end{solution}
    `;
    const result = extractMetadata(content);
    expect(result.solution).toBe('The answer is $x = 5$.');
    expect(result.statement).toContain('Find the value of $x$.');
    expect(result.statement).not.toContain('\\begin{solution}');
  });

  test('extracts answer from LaTeX', () => {
    const content = `Find $2 + 2$. \\answer{4}`;
    const result = extractMetadata(content);
    expect(result.answer).toBe('4');
    expect(result.statement).toBe('Find $2 + 2$.');
  });

  test('handles content with both solution and answer', () => {
    const content = `
      Problem statement.
      \\begin{solution}Full solution here.\\end{solution}
      \\answer{42}
    `;
    const result = extractMetadata(content);
    expect(result.statement.trim()).toBe('Problem statement.');
    expect(result.solution).toBe('Full solution here.');
    expect(result.answer).toBe('42');
  });

  test('handles content with no metadata', () => {
    const content = 'Just a plain problem statement.';
    const result = extractMetadata(content);
    expect(result.statement).toBe('Just a plain problem statement.');
    expect(result.solution).toBe('');
    expect(result.answer).toBe('');
  });
});

describe('parseBulkLatex', () => {
  test('parses problem blocks', () => {
    const text = `
      \\begin{problem}
      First problem statement.
      \\end{problem}
      \\begin{problem}
      Second problem.
      \\begin{solution}Solution here.\\end{solution}
      \\end{problem}
    `;
    const problems = parseBulkLatex(text);
    expect(problems).toHaveLength(2);
    expect(problems[0].title).toBe('Imported Problem 1');
    expect(problems[0].statement).toBe('First problem statement.');
    expect(problems[1].solution).toBe('Solution here.');
  });

  test('parses item-based lists', () => {
    const text = `
      \\begin{enumerate}
      \\item First item problem.
      \\item Second item problem.
      \\end{enumerate}
    `;
    const problems = parseBulkLatex(text);
    expect(problems).toHaveLength(2);
    expect(problems[0].statement).toContain('First item problem.');
  });

  test('applies default topics and difficulty', () => {
    const text = `\\begin{problem}Test.\\end{problem}`;
    const problems = parseBulkLatex(text, ['Algebra', 'Geometry'], 7);
    expect(problems[0].topics).toEqual(['Algebra', 'Geometry']);
    expect(problems[0].difficulty).toBe(7);
  });

  test('returns empty array for invalid input', () => {
    const problems = parseBulkLatex('No problems here.');
    expect(problems).toHaveLength(0);
  });

  test('filters out short items', () => {
    const text = `\\item x \\item This is a real problem statement.`;
    const problems = parseBulkLatex(text);
    expect(problems).toHaveLength(1);
    expect(problems[0].statement).toContain('real problem');
  });
});

describe('isValidStatus', () => {
  test('accepts valid statuses', () => {
    expect(isValidStatus('pending')).toBe(true);
    expect(isValidStatus('approved')).toBe(true);
    expect(isValidStatus('accepted')).toBe(true);
  });

  test('rejects invalid statuses', () => {
    expect(isValidStatus('invalid')).toBe(false);
    expect(isValidStatus('')).toBe(false);
    expect(isValidStatus('PENDING')).toBe(false);
  });
});

describe('normalizeDifficulty', () => {
  test('returns valid numbers as-is within range', () => {
    expect(normalizeDifficulty(5)).toBe(5);
    expect(normalizeDifficulty(0)).toBe(0);
    expect(normalizeDifficulty(10)).toBe(10);
  });

  test('clamps values to 0-10 range', () => {
    expect(normalizeDifficulty(-5)).toBe(0);
    expect(normalizeDifficulty(15)).toBe(10);
  });

  test('returns 0 for non-numeric values', () => {
    expect(normalizeDifficulty('five')).toBe(0);
    expect(normalizeDifficulty(null)).toBe(0);
    expect(normalizeDifficulty(undefined)).toBe(0);
    expect(normalizeDifficulty(NaN)).toBe(0);
  });
});
