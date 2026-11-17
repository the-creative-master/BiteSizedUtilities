import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cupboards, allTools } from '../catalog.js';
import { toolPropSVG } from '../icons-25d.js';

test('Math & Numbers cupboard contains exact 10 utilities and other four cupboards contain 15 each', () => {
  assert.equal(cupboards.length, 5);
  const math = cupboards.find(c => c.id === 'math');
  assert.ok(math);
  assert.deepEqual(
    math.tools.map(t => t[0]),
    [
      'calculator',
      'graphing-calculator',
      'bodily-calculator',
      'fractions',
      'percentage',
      'dice-roller',
      'roman-numerals',
      'number-base',
      'prime-checker',
      'sequence-playground'
    ]
  );
  for (const c of cupboards) {
    if (c.id !== 'math') assert.equal(c.tools.length, 15, c.name);
  }
  assert.equal(allTools.length, 70);
});

test('every single one of the 70 utilities has its own unique 2.5D SVG icon', () => {
  const svgs = allTools.map(t => toolPropSVG(t.id));
  assert.equal(new Set(svgs).size, 70, 'Every tool across all cupboards must have a distinct SVG');
});

test('tool identifiers are unique and every cupboard has its star', () => {
  assert.equal(new Set(allTools.map(t => t.id)).size, 70);
  for (const c of cupboards) assert.ok(c.tools.some(t => t[0] === c.star));
});

test('all utility identifiers have implementation dispatch cases', () => {
  const mathSrc = fs.readFileSync('tools-math-numbers.js', 'utf8');
  const sciSrc = fs.readFileSync('tools-math-science.js', 'utf8');
  const codeSrc = fs.readFileSync('tools-code.js', 'utf8');
  const textArtSrc = fs.readFileSync('tools-text-art.js', 'utf8');
  for (const t of allTools) {
    const source = t.cupboard === 'math'
      ? mathSrc
      : t.cupboard === 'science'
        ? sciSrc
        : t.cupboard === 'code'
          ? codeSrc
          : textArtSrc;
    assert.ok(source.includes(t.id), t.id);
  }
});

test('all games in catalog are real open-source games fetched from GitHub with valid entrypoints and ZIPs', () => {
  const games = JSON.parse(fs.readFileSync('games/catalog.json', 'utf8'));
  assert.equal(games.length, 72);
  assert.ok(!fs.existsSync('games/arcade'));
  assert.ok(!fs.existsSync('games/original'));
  for (const g of games) {
    assert.equal(g.origin, 'github', g.id + ' must come from GitHub');
    assert.ok(g.repo.startsWith('https://github.com/'), g.id + ' repo URL');
    assert.ok(g.title);
    assert.ok(g.license);
    assert.ok(fs.existsSync(g.entrypoint), g.id + ' entrypoint exists');
    assert.ok(fs.existsSync(g.zip), g.id + ' zip exists');
    assert.ok(fs.statSync(g.zip).size > 500, g.id + ' zip nonempty');
  }
});
