// =============================================================================
// BACKWARDS COMPATIBILITY LAYER
// This file re-exports from the new modular AI structure
// All imports from '@/lib/openai' will continue to work
// =============================================================================

// Re-export everything from the new AI module
export * from './ai';

// Note: The AI module has been split into focused files:
// - ./ai/types.ts        - All type definitions
// - ./ai/client.ts       - OpenAI client initialization
// - ./ai/config.ts       - Configuration and constants
// - ./ai/generators/     - Question, pack, category generation
// - ./ai/review.ts       - Council review functions
// - ./ai/analyzers/      - Text and target analysis
// - ./ai/tools/          - Polish and topic extraction
