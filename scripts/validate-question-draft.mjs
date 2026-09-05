#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const draftPath = new URL('../docs/product/question-drafts/play-safe-spicy-v1.json', import.meta.url);
const snapshotPath = new URL('../apps/supabase/catalog-snapshots/production-2026-08-28.json', import.meta.url);
const markdownPath = new URL('../docs/product/question-drafts/play-safe-spicy-v1.md', import.meta.url);
const textSourcePath = new URL('../docs/product/question-drafts/text-answer-concept-source.md', import.meta.url);
const audioSourcePath = new URL('../docs/product/question-drafts/audio-concept-source.md', import.meta.url);
const draft = JSON.parse(await readFile(draftPath, 'utf8'));
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const markdown = await readFile(markdownPath, 'utf8');
const textSource = await readFile(textSourcePath, 'utf8');
const audioSource = await readFile(audioSourcePath, 'utf8');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };
const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const questionTypes = new Set(['swipe', 'text_answer', 'audio', 'photo', 'who_likely']);
const banned = /\b(?:anal|anus|asshole|bdsm|bestiality|blowjob|breath play|chok(?:e|ing)|cock|cum|dick|dildo|domination|fetish|fingering|handjob|incest|masturbat|naked|nud(?:e|ity)|oral sex|orgasm|penis|porn|public sex|sex toy|spank(?:ing)?|threesome|vagina|vibrator)\b/i;
const timeBound = /\b(?:today|tonight|right now|\bnow\b)\b/i;
const gendered = /\b(?:boyfriend|girlfriend|husband|wife|him|her|his|hers)\b/i;
const photoUnsafe = /\b(?:body part|lingerie|nude|naked|proof|skin|undress|your body)\b/i;
const artificialSuffix = /\b(?:option|response focus|voice focus|visual cue|variant|version)\s*\d+\b/i;
const malformedOrFallback = /\b(?:let your partner to|as they for|share this private idea|take the complementary role|response focus|voice focus|bolder mood|confident outfit|unfamiliar private dynamic)\b/i;
const genericOutcome = /\b(?:this match reveals whether|specific written starting point|take the complementary role|gains a personal cue for a close conversation)\b/i;
const incompleteSwipe = /^(?:a |an |the |trying |swapping )/i;
const nonActionableSwipe = /^(?:close|private|shared|more|something|anything|it|that)\b/i;
const markdownPackNames = {
  'taking-the-lead': 'Taking the Lead',
  'clothes-confidence': 'Clothes and Confidence',
  'settings-atmosphere': 'Settings and Atmosphere',
  'boundaries-check-ins': 'Boundaries and Check-ins',
  'surprise-novelty': 'Surprise and Novelty',
  'long-distance-desire': 'Long-distance Desire',
  'giving-receiving-attention': 'Giving and Receiving Attention',
  'aftercare-reconnection': 'Aftercare and Reconnection',
};
const sourcePackSlugs = {
  'flirty communication': 'flirty-communication',
  anticipation: 'anticipation',
  'taking the lead': 'taking-the-lead',
  following: 'following',
  'shared control': 'shared-control',
  'sensory cues': 'sensory-cues',
  'private performance': 'private-performance',
  'clothes and confidence': 'clothes-confidence',
  'fantasy exchange': 'fantasy-exchange',
  roleplay: 'roleplay',
  'settings and atmosphere': 'settings-atmosphere',
  'boundaries and check-ins': 'boundaries-check-ins',
  'surprise and novelty': 'surprise-novelty',
  'long-distance desire': 'long-distance-desire',
  'giving and receiving attention': 'giving-receiving-attention',
  'aftercare and reconnection': 'aftercare-reconnection',
};
const parseSource = (source, pattern, type) => [...source.matchAll(pattern)].map((match) => ({
  pack_slug: sourcePackSlugs[match[1].toLowerCase()],
  intensity: Number(match[2]),
  text: match[3],
  intended_outcome: match[4],
  question_type: type,
}));
const textSourceRows = parseSource(textSource, /^\d+\. \*\*Theme:\*\* (.+?) \| \*\*Intensity:\*\* (\d)\s*\r?\n\s*\*\*Prompt:\*\* (.+?)\s*\r?\n\s*\*\*Intended outcome:\*\* (.+?)$/gm, 'text_answer');
const audioSourceRows = parseSource(audioSource, /^\d+\. Theme: (.+?) \| Intensity: (\d)\s*\r?\n\s*Prompt: (.+?)\s*\r?\n\s*Intended outcome: (.+?)$/gm, 'audio');
expect(textSourceRows.length === 100, `expected 100 text source rows, got ${textSourceRows.length}`);
expect(audioSourceRows.length === 70, `expected 70 audio source rows, got ${audioSourceRows.length}`);
const sourceKey = (row) => JSON.stringify([row.pack_slug, row.intensity, row.text, row.intended_outcome]);

expect(Array.isArray(draft.packs) && Array.isArray(draft.questions), 'draft must contain packs and questions arrays');
const questions = draft.questions ?? [];
expect(questions.length === 550, `expected 550 questions, got ${questions.length}`);
expect((draft.packs ?? []).length > 0, 'draft must contain at least one pack');
const ids = new Set();
const byId = new Map();
const typeCounts = Object.fromEntries([...questionTypes].map((type) => [type, 0]));
const intensityCounts = Object.fromEntries([1, 2, 3, 4, 5].map((level) => [level, 0]));
const packCounts = new Map();
const draftTexts = new Map();
const openingCounts = new Map();
const ngramRows = new Map();
const outcomeClusters = new Map();
const responseLeadingVerbs = new Map();
const requiredFormatOpenings = new Set(['share a photo of', 'who is more likely']);
const snapshotTexts = new Set((snapshot.tables?.questions ?? []).map((row) => normalize(row.text)));
for (const [index, question] of questions.entries()) {
  const label = `question ${index + 1}`;
  expect(typeof question.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(question.id), `${label} has invalid UUID`);
  expect(!ids.has(question.id), `${label} duplicates UUID ${question.id}`);
  ids.add(question.id); byId.set(question.id, question);
  expect(typeof question.pack_slug === 'string' && question.pack_slug.length > 0, `${label} has no pack_slug`);
  packCounts.set(question.pack_slug, (packCounts.get(question.pack_slug) ?? 0) + 1);
  expect(typeof question.text === 'string' && question.text.length > 0, `${label} has no text`);
  expect(!artificialSuffix.test(question.text), `${label} contains an artificial template discriminator`);
  expect(!malformedOrFallback.test(question.text), `${label} contains malformed or generic fallback copy`);
  expect(questionTypes.has(question.question_type), `${label} has unsupported type ${question.question_type}`);
  if (questionTypes.has(question.question_type)) typeCounts[question.question_type] += 1;
  expect([2, 3, 4].includes(question.intensity), `${label} has invalid intensity ${question.intensity}`);
  if (Object.hasOwn(intensityCounts, question.intensity)) intensityCounts[question.intensity] += 1;
  expect(question.review_status === 'draft', `${label} must be draft`);
  expect(['low', 'edge'].includes(question.policy_risk), `${label} has invalid policy_risk`);
  expect(typeof question.intended_outcome === 'string' && question.intended_outcome.length > 0, `${label} has no intended_outcome`);
  expect(!genericOutcome.test(question.intended_outcome), `${label} has a generic fallback outcome`);
  expect(question.allowed_couple_genders === null && question.target_user_genders === null && question.required_props === null, `${label} must use null targeting and props`);
  const textFields = [question.text, question.partner_text, question.intended_outcome].filter(Boolean);
  for (const text of textFields) {
    expect(!banned.test(text), `${label} contains banned developer-authored term`);
    expect(!timeBound.test(text), `${label} contains time-bound language`);
    expect(!gendered.test(text), `${label} contains gendered partner language`);
    expect(!text.includes('—'), `${label} contains an em dash`);
  }
  const normalized = normalize(question.text);
  if (question.question_type === 'swipe') {
    expect(!incompleteSwipe.test(question.text) && !nonActionableSwipe.test(question.text), `${label} swipe text must be a complete actionable proposal`);
    if (question.partner_text !== null) {
      expect(question.text !== question.partner_text, `${label} asymmetric swipe must use distinct partner wording`);
      expect(!incompleteSwipe.test(question.partner_text) && !nonActionableSwipe.test(question.partner_text), `${label} asymmetric partner_text must be a complete actionable proposal`);
    }
  }
  if (question.question_type === 'text_answer' || question.question_type === 'audio') {
    const leadingVerb = normalized.split(' ')[0];
    const key = `${question.question_type}:${leadingVerb}`;
    responseLeadingVerbs.set(key, (responseLeadingVerbs.get(key) ?? 0) + 1);
    const outcomeCluster = normalize(question.intended_outcome)
      .replace(/\b(?:your|partner|the|couple|one|a|an|and|or|can|to|with|for|of|that|this|their|them|you)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const rows = outcomeClusters.get(outcomeCluster) ?? [];
    rows.push(label);
    outcomeClusters.set(outcomeCluster, rows);
  }
  const opening = normalized.split(' ').slice(0, 4).join(' ');
  if (!requiredFormatOpenings.has(opening)) {
    openingCounts.set(opening, (openingCounts.get(opening) ?? 0) + 1);
  }
  // An inverse row intentionally repeats its primary row's partner wording.
  // Check only primary and symmetric text here; inverse swap integrity is
  // checked below.
  if (question.inverse_of === null) {
    expect(!draftTexts.has(normalized), `${label} duplicates draft text from ${draftTexts.get(normalized)}`);
    draftTexts.set(normalized, label);
    const words = normalized.split(' ').filter(Boolean);
    for (let start = 0; start <= words.length - 6; start += 1) {
      const ngram = words.slice(start, start + 6).join(' ');
      const rows = ngramRows.get(ngram) ?? [];
      rows.push(label);
      ngramRows.set(ngram, rows);
    }
  }
  expect(!snapshotTexts.has(normalized), `${label} duplicates production snapshot text`);
  if (question.question_type === 'audio') expect(JSON.stringify(question.config) === JSON.stringify({ max_duration_seconds: 60 }), `${label} audio config must be max_duration_seconds 60`);
  if (question.question_type === 'text_answer') expect(JSON.stringify(question.config) === JSON.stringify({ max_length: 500 }), `${label} text_answer config must be max_length 500`);
  if (['swipe', 'photo', 'who_likely'].includes(question.question_type)) expect(JSON.stringify(question.config) === '{}', `${label} ${question.question_type} config must be empty`);
  if (question.question_type !== 'swipe') {
    expect(question.partner_text === null && question.inverse_of === null, `${label} non-swipe must have null partner_text and inverse_of`);
  }
  if (question.question_type === 'photo') expect(!photoUnsafe.test(question.text), `${label} photo prompt is not safely clothed/object/setting based`);
}
for (const [opening, count] of openingCounts) {
  expect(count <= 30, `opening template repeats ${count} times: ${opening}`);
}
for (const [ngram, rows] of ngramRows) {
  expect(rows.length <= 10, `six-word phrase repeats ${rows.length} times across non-inverse rows: ${ngram}`);
}
for (const [type, sourceRows] of [['text_answer', textSourceRows], ['audio', audioSourceRows]]) {
  const catalogueRows = questions.filter((question) => question.question_type === type);
  const sourceKeys = new Set(sourceRows.map(sourceKey));
  expect(sourceKeys.size === sourceRows.length, `${type} source contains duplicate concepts`);
  expect(catalogueRows.length === sourceRows.length, `${type} source and catalogue counts differ`);
  for (const question of catalogueRows) {
    expect(sourceKeys.has(sourceKey(question)), `${type} row ${question.id} differs from the authored source`);
  }
}
for (const [key, count] of responseLeadingVerbs) {
  const [type, leadingVerb] = key.split(':');
  const total = type === 'text_answer' ? 100 : 70;
  expect(count <= Math.ceil(total * 0.6), `${type} leading verb "${leadingVerb}" repeats ${count} times`);
}
for (const [cluster, rows] of outcomeClusters) {
  expect(cluster.length >= 16, `${rows.join(', ')} has an overly generic response outcome`);
  expect(rows.length === 1, `response outcome cluster repeats across ${rows.join(', ')}`);
}
for (const [type, count] of Object.entries({ swipe: 300, text_answer: 100, audio: 70, photo: 40, who_likely: 40 })) expect(typeCounts[type] === count, `expected ${count} ${type}, got ${typeCounts[type]}`);
for (const [level, count] of Object.entries({ 1: 0, 2: 120, 3: 300, 4: 130, 5: 0 })) expect(intensityCounts[level] === count, `expected ${count} intensity ${level}, got ${intensityCounts[level]}`);
const swipes = questions.filter((question) => question.question_type === 'swipe');
const asymmetric = swipes.filter((question) => question.partner_text !== null);
const symmetric = swipes.filter((question) => question.partner_text === null);
expect(asymmetric.length === 240, `expected 240 asymmetric swipe rows, got ${asymmetric.length}`);
expect(symmetric.length === 60, `expected 60 symmetric swipe rows, got ${symmetric.length}`);
const primaries = asymmetric.filter((question) => question.inverse_of === null);
const inverses = asymmetric.filter((question) => question.inverse_of !== null);
expect(primaries.length === 120 && inverses.length === 120, `expected 120 primary and 120 inverse swipe rows, got ${primaries.length} and ${inverses.length}`);
for (const question of inverses) {
  const primary = byId.get(question.inverse_of);
  expect(primary?.question_type === 'swipe' && primary.inverse_of === null, `inverse ${question.id} must reference a primary swipe`);
  if (primary) {
    expect(question.text === primary.partner_text && question.partner_text === primary.text, `inverse ${question.id} must exactly swap text and partner_text`);
    expect(question.intensity === primary.intensity && question.pack_slug === primary.pack_slug, `inverse ${question.id} must keep intensity and pack`);
  }
}
for (const question of symmetric) expect(question.inverse_of === null, `symmetric swipe ${question.id} must have null inverse_of`);
expect([...packCounts.values()].every((count) => count > 0), 'every declared pack must contain questions');
for (const pack of draft.packs ?? []) {
  const expectedLine = `- ${markdownPackNames[pack.slug] ?? pack.name}: ${packCounts.get(pack.slug) ?? 0} questions.`;
  expect(markdown.includes(expectedLine), `markdown pack count is missing or stale: ${expectedLine}`);
}
if (errors.length) {
  process.stderr.write(`Question draft validation failed (${errors.length}):\n${errors.map((error) => `- ${error}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`Question draft valid: ${questions.length} total; types ${JSON.stringify(typeCounts)}; intensities ${JSON.stringify(intensityCounts)}; packs ${JSON.stringify(Object.fromEntries(packCounts))}\n`);
