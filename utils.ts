import type { Topic } from './types';

export interface ParsedProblem {
  statement: string;
  solution: string;
  answer: string;
}

export interface ImportedProblem {
  title: string;
  statement: string;
  solution: string;
  answerKey: string;
  topics: Topic[];
  difficulty: number;
}

/**
 * Extracts metadata (solution, answer) from LaTeX problem content
 */
export function extractMetadata(content: string): ParsedProblem {
  let cleanContent = content;
  let solution = "";
  let answer = "";

  const solMatch = content.match(/\\begin\{solution\}([\s\S]*?)\\end\{solution\}/);
  if (solMatch) {
    solution = solMatch[1].trim();
    cleanContent = cleanContent.replace(solMatch[0], '');
  }

  const ansMatch = content.match(/\\answer\{(.*?)\}/);
  if (ansMatch) {
    answer = ansMatch[1].trim();
    cleanContent = cleanContent.replace(ansMatch[0], '');
  }

  return { statement: cleanContent.trim(), solution, answer };
}

/**
 * Parses bulk LaTeX text into individual problems
 */
export function parseBulkLatex(
  text: string,
  defaultTopics: Topic[] = [],
  defaultDifficulty: number = 3
): ImportedProblem[] {
  const problems: ImportedProblem[] = [];

  // Strategy 1: Look for \begin{problem}...\end{problem} blocks
  const blockRegex = /\\begin\{problem\}([\s\S]*?)\\end\{problem\}/g;
  let match;

  while ((match = blockRegex.exec(text)) !== null) {
    const raw = match[1];
    const { statement, solution, answer } = extractMetadata(raw);

    problems.push({
      title: `Imported Problem ${problems.length + 1}`,
      statement: statement,
      solution: solution,
      answerKey: answer,
      topics: defaultTopics,
      difficulty: defaultDifficulty
    });
  }

  // Strategy 2: If no blocks, look for \item
  if (problems.length === 0) {
    const items = text.split(/\\item\s/);
    if (items.length > 1) {
      items.shift(); // remove preamble
      items.forEach((item, idx) => {
        const { statement, solution, answer } = extractMetadata(item);
        if (statement.length > 5) {
          problems.push({
            title: `Imported Problem ${idx + 1}`,
            statement: statement,
            solution: solution,
            answerKey: answer,
            topics: defaultTopics,
            difficulty: defaultDifficulty
          });
        }
      });
    }
  }

  return problems;
}

/**
 * Validates problem status transitions
 */
export function isValidStatus(status: string): status is 'pending' | 'approved' | 'accepted' {
  return ['pending', 'approved', 'accepted'].includes(status);
}

/**
 * Validates difficulty value
 */
export function normalizeDifficulty(difficulty: unknown): number {
  if (typeof difficulty === 'number' && !isNaN(difficulty)) {
    return Math.max(0, Math.min(10, difficulty));
  }
  return 0;
}
