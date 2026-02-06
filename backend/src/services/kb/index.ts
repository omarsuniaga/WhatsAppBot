/**
 * Knowledge Base Services - Index
 */

export { MarkdownParser, parseMarkdownDocument, parseFrontmatter, chunkMarkdown } from './MarkdownParser';
export { EmbeddingService } from './EmbeddingService';
export { AskKBService } from './AskKBService';

export type { 
  KBFrontmatter, 
  KBDocParsed, 
  KBChunkParsed, 
  ParseResult
} from './MarkdownParser';

export type {
  EmbeddingProvider,
  VectorSearchResult,
  SearchOptions
} from './EmbeddingService';
