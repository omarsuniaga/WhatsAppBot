/**
 * MarkdownParser - Parse markdown files with frontmatter and chunk into segments
 */

import * as crypto from 'crypto';

// ============================================================
// TYPES
// ============================================================

export type KBAudience = 'padre' | 'alumno' | 'docente' | 'admin' | 'publico';
export type KBDocStatus = 'draft' | 'active' | 'deprecated' | 'indexing' | 'error';

export interface KBFrontmatter {
  id?: string;
  title?: string;
  audience?: KBAudience[];
  tags?: string[];
  version?: string;
  status?: KBDocStatus;
  updated_at?: string;
  source?: string;
}

export interface KBDocParsed {
  id: string;
  filename: string;
  title: string;
  rawMd: string;
  checksum: string;
  audience: KBAudience[];
  tags: string[];
  version: string;
  source: string;
  status: KBDocStatus;
}

export interface KBChunkParsed {
  chunkIndex: number;
  headingPath: string[];
  text: string;
  tokenCount: number;
  audience: KBAudience[];
  tags: string[];
}

export interface ParseResult {
  doc: KBDocParsed;
  chunks: KBChunkParsed[];
}

// ============================================================
// CONSTANTS
// ============================================================

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const HEADING_REGEX = /^(#{1,3})\s+(.+)$/gm;
const MIN_CHUNK_TOKENS = 100;
const TARGET_CHUNK_TOKENS = 600;
const MAX_CHUNK_TOKENS = 800;
const CHARS_PER_TOKEN = 4; // Approximate

// ============================================================
// HELPERS
// ============================================================

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}${random}`;
}

function calculateChecksum(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function parseYamlSimple(yaml: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = yaml.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = trimmed.substring(0, colonIndex).trim();
    let value = trimmed.substring(colonIndex + 1).trim();
    
    // Handle arrays: ["item1", "item2"] or - item format
    if (value.startsWith('[') && value.endsWith(']')) {
      const arrayContent = value.slice(1, -1);
      result[key] = arrayContent
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(s => s.length > 0);
    } else if (value.startsWith('"') && value.endsWith('"')) {
      result[key] = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      result[key] = value.slice(1, -1);
    } else if (value === 'true') {
      result[key] = true;
    } else if (value === 'false') {
      result[key] = false;
    } else if (!isNaN(Number(value)) && value !== '') {
      result[key] = Number(value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// ============================================================
// FRONTMATTER PARSER
// ============================================================

export function parseFrontmatter(markdown: string): { frontmatter: KBFrontmatter; content: string } {
  const match = markdown.match(FRONTMATTER_REGEX);
  
  if (!match) {
    return { frontmatter: {}, content: markdown };
  }
  
  const yamlContent = match[1];
  const content = markdown.substring(match[0].length);
  
  try {
    const parsed = parseYamlSimple(yamlContent);
    
    const frontmatter: KBFrontmatter = {
      id: parsed.id as string | undefined,
      title: parsed.title as string | undefined,
      audience: Array.isArray(parsed.audience) ? parsed.audience as KBAudience[] : undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
      version: parsed.version as string | undefined,
      status: parsed.status as KBDocStatus | undefined,
      updated_at: parsed.updated_at as string | undefined,
      source: parsed.source as string | undefined,
    };
    
    return { frontmatter, content };
  } catch (error) {
    console.warn('Failed to parse frontmatter:', error);
    return { frontmatter: {}, content: markdown };
  }
}

// ============================================================
// HEADING EXTRACTOR
// ============================================================

interface HeadingNode {
  level: number;
  text: string;
  startIndex: number;
  endIndex: number;
  content: string;
}

function extractHeadings(content: string): HeadingNode[] {
  const headings: HeadingNode[] = [];
  let match;
  
  // Reset regex
  HEADING_REGEX.lastIndex = 0;
  
  const matches: { level: number; text: string; index: number }[] = [];
  
  while ((match = HEADING_REGEX.exec(content)) !== null) {
    matches.push({
      level: match[1].length,
      text: match[2].trim(),
      index: match.index
    });
  }
  
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    
    const startIndex = current.index;
    const endIndex = next ? next.index : content.length;
    const fullContent = content.substring(startIndex, endIndex);
    
    // Remove the heading line from content
    const headingLineEnd = fullContent.indexOf('\n');
    const sectionContent = headingLineEnd !== -1 
      ? fullContent.substring(headingLineEnd + 1).trim()
      : '';
    
    headings.push({
      level: current.level,
      text: current.text,
      startIndex,
      endIndex,
      content: sectionContent
    });
  }
  
  return headings;
}

// ============================================================
// CHUNKER
// ============================================================

function buildHeadingPath(headings: HeadingNode[], currentIndex: number): string[] {
  const path: string[] = [];
  const currentHeading = headings[currentIndex];
  
  // Walk backwards to build path
  for (let i = currentIndex; i >= 0; i--) {
    const h = headings[i];
    if (h.level < (path.length > 0 ? headings.find(hh => hh.text === path[0])?.level || 99 : 99)) {
      path.unshift(h.text);
    } else if (i === currentIndex) {
      path.unshift(h.text);
    }
  }
  
  // Simpler approach: track the current path based on levels
  const simplePath: string[] = [];
  const levelStack: { level: number; text: string }[] = [];
  
  for (let i = 0; i <= currentIndex; i++) {
    const h = headings[i];
    
    // Pop items from stack that are same level or deeper
    while (levelStack.length > 0 && levelStack[levelStack.length - 1].level >= h.level) {
      levelStack.pop();
    }
    
    levelStack.push({ level: h.level, text: h.text });
  }
  
  return levelStack.map(s => s.text);
}

function splitTextIntoChunks(
  text: string, 
  headingPath: string[],
  audience: KBAudience[],
  tags: string[]
): KBChunkParsed[] {
  const chunks: KBChunkParsed[] = [];
  const tokens = estimateTokens(text);
  
  if (tokens <= MAX_CHUNK_TOKENS) {
    // Text fits in one chunk
    if (text.trim().length > 0) {
      chunks.push({
        chunkIndex: 0,
        headingPath,
        text: text.trim(),
        tokenCount: tokens,
        audience,
        tags
      });
    }
    return chunks;
  }
  
  // Need to split - try by paragraphs
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);
    
    if (currentTokens + paraTokens > MAX_CHUNK_TOKENS && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        chunkIndex: chunks.length,
        headingPath,
        text: currentChunk.trim(),
        tokenCount: currentTokens,
        audience,
        tags
      });
      currentChunk = para;
      currentTokens = paraTokens;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
      currentTokens += paraTokens;
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      chunkIndex: chunks.length,
      headingPath,
      text: currentChunk.trim(),
      tokenCount: currentTokens,
      audience,
      tags
    });
  }
  
  return chunks;
}

export function chunkMarkdown(
  content: string,
  audience: KBAudience[],
  tags: string[]
): KBChunkParsed[] {
  const headings = extractHeadings(content);
  
  if (headings.length === 0) {
    // No headings - chunk the entire content
    return splitTextIntoChunks(content, [], audience, tags);
  }
  
  const allChunks: KBChunkParsed[] = [];
  
  // Check if there's content before the first heading
  const firstHeadingIndex = headings[0].startIndex;
  if (firstHeadingIndex > 0) {
    const preContent = content.substring(0, firstHeadingIndex).trim();
    if (preContent.length > 0) {
      const preChunks = splitTextIntoChunks(preContent, [], audience, tags);
      allChunks.push(...preChunks);
    }
  }
  
  // Process each heading section
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const headingPath = buildHeadingPath(headings, i);
    
    if (heading.content.length > 0) {
      const sectionChunks = splitTextIntoChunks(
        heading.content,
        headingPath,
        audience,
        tags
      );
      allChunks.push(...sectionChunks);
    }
  }
  
  // Re-index all chunks
  return allChunks.map((chunk, index) => ({
    ...chunk,
    chunkIndex: index
  }));
}

// ============================================================
// MAIN PARSER
// ============================================================

export function parseMarkdownDocument(
  rawMd: string,
  filename: string
): ParseResult {
  // Extract frontmatter
  const { frontmatter, content } = parseFrontmatter(rawMd);
  
  // Extract title from frontmatter or first heading
  let title = frontmatter.title || '';
  if (!title) {
    const firstHeadingMatch = content.match(/^#\s+(.+)$/m);
    if (firstHeadingMatch) {
      title = firstHeadingMatch[1].trim();
    } else {
      title = filename.replace(/\.md$/i, '');
    }
  }
  
  // Build document
  const doc: KBDocParsed = {
    id: frontmatter.id || generateId('kb_doc'),
    filename,
    title,
    rawMd,
    checksum: calculateChecksum(rawMd),
    audience: frontmatter.audience || ['publico'],
    tags: frontmatter.tags || [],
    version: frontmatter.version || '1.0',
    source: frontmatter.source || '',
    status: frontmatter.status || 'draft'
  };
  
  // Chunk content
  const chunks = chunkMarkdown(content, doc.audience, doc.tags);
  
  return { doc, chunks };
}

// ============================================================
// EXPORTS
// ============================================================

export const MarkdownParser = {
  parse: parseMarkdownDocument,
  parseFrontmatter,
  chunkMarkdown,
  estimateTokens,
  calculateChecksum
};

export default MarkdownParser;
