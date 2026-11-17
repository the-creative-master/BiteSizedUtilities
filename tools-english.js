import { gEl, gameBtn, gameTabs, gameToggle, gameField, gameFilePill, copyToClipboard } from './ui-kit.js';
import { playPop, playSparkle, playBoing } from './sfx.js';
import { streamWaffleChat, formatWaffleMarkdown } from './waffle-ai.js';
import { createDocxBlob, extractTextFromUpload, triggerFileDownload } from './file-tools-client.js';
import { getAppLanguage } from './i18n.js';

const ENGLISH_IDS = [
  'waffle-translate', 'sentence-corrector', 'tone-rewriter', 'grammar-explainer',
  'summarizer-pro', 'vocab-builder', 'essay-outliner', 'rhyme-poetry',
  'idiom-decoder', 'story-starter', 'email-polisher', 'eli5-explainer',
  'flashcard-maker', 'pronunciation-coach', 'dialogue-practice'
];

const LANGUAGES = [
  'Spanish', 'French', 'German', 'Japanese', 'Korean',
  'Mandarin Chinese', 'Arabic', 'Hindi', 'Portuguese', 'Italian',
  'Russian', 'Dutch', 'Turkish', 'Vietnamese', 'English'
];

const LANG_CODES = {
  'Auto Detect': 'auto',
  English: 'en',
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Japanese: 'ja',
  Korean: 'ko',
  'Mandarin Chinese': 'zh-CN',
  Arabic: 'ar',
  Hindi: 'hi',
  Portuguese: 'pt',
  Italian: 'it',
  Russian: 'ru',
  Dutch: 'nl',
  Turkish: 'tr',
  Vietnamese: 'vi'
};

const CODE_NAMES = Object.fromEntries(
  Object.entries(LANG_CODES).filter(([, v]) => v !== 'auto').map(([k, v]) => [v.toLowerCase(), k])
);
CODE_NAMES.zh = 'Mandarin Chinese';
CODE_NAMES['zh-cn'] = 'Mandarin Chinese';
CODE_NAMES['zh-tw'] = 'Traditional Chinese';

function area(val = '', rows = 5, placeholder = '') {
  const t = gEl('textarea', { class: 'gfield-input eng-area', rows: String(rows), placeholder });
  t.value = val;
  return t;
}

function lineInput(val = '', placeholder = '') {
  const i = gEl('input', { type: 'text', class: 'gfield-input', placeholder });
  i.value = val;
  return i;
}

function createRunner(form) {
  const controller = new AbortController();
  form.addEventListener('tool-dispose', () => controller.abort());

  let activeReq = null;
  let lastText = '';

  const outBox = gEl('div', { class: 'pastel-card cream eng-output-card', hidden: true });
  const outBody = gEl('div', { class: 'eng-output-body' });
  const copyBtn = gameBtn('📋 Copy', 'chip', async () => {
    if (!lastText) return;
    const ok = await copyToClipboard(lastText);
    copyBtn.textContent = ok ? 'Copied!' : 'Copy failed';
    setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1200);
  });
  const docxBtn = gameBtn('⬇ Save .docx', 'chip', () => {
    if (!lastText) return;
    playPop(620);
    triggerFileDownload(createDocxBlob(lastText, 'Waffle Languages'), 'waffle-language-output.docx');
  });
  const mdBtn = gameBtn('⬇ Save .md', 'chip', () => {
    if (!lastText) return;
    playPop(620);
    triggerFileDownload(lastText, 'waffle-language-output.md', 'text/markdown;charset=utf-8');
  });
  const outActions = gEl('div', { class: 'gtabs eng-out-actions', hidden: true }, copyBtn, docxBtn, mdBtn);
  outBox.append(outBody, outActions);

  async function ask({ systemPrompt, userPrompt, temperature = 0.45, maxTokens = 560, skipSpeakHint = false, onDone }) {
    if (activeReq) activeReq.abort();
    const ac = new AbortController();
    activeReq = ac;
    const onDispose = () => ac.abort();
    controller.signal.addEventListener('abort', onDispose, { once: true });

    lastText = '';
    outBox.hidden = false;
    outActions.hidden = true;
    outBody.innerHTML = '<span class="waffle-thinking">Sir Waffle is thinking…</span><span class="waffle-cursor" aria-hidden="true">▌</span>';

    const appLang = getAppLanguage();
    const finalPrompt = skipSpeakHint ? userPrompt : `${userPrompt}\n\n(Speak in ${appLang})`;

    try {
      const full = await streamWaffleChat({
        messages: [{ role: 'user', content: finalPrompt }],
        systemPrompt,
        temperature,
        maxTokens,
        signal: ac.signal,
        onToken(_, acc) {
          lastText = acc;
          outBody.innerHTML = formatWaffleMarkdown(acc, true) + '<span class="waffle-cursor" aria-hidden="true">▌</span>';
        }
      });
      lastText = full || lastText;
      outBody.innerHTML = formatWaffleMarkdown(lastText, false);
      outActions.hidden = !lastText;
      playSparkle();
      onDone?.(lastText);
    } catch (err) {
      if (err.name !== 'AbortError') {
        outBody.innerHTML = `<p class="waffle-md-p">Error: ${String(err.message || err)}</p>`;
      }
    } finally {
      if (activeReq === ac) activeReq = null;
      controller.signal.removeEventListener('abort', onDispose);
    }
  }

  return { outBox, ask, signal: controller.signal, getLastText: () => lastText };
}

function attachUpload(areaEl, label = '📎 Load .docx / .txt / .md') {
  return gameFilePill(label, '.txt,.md,.csv,.docx,.json', false, async files => {
    const f = files?.[0];
    if (!f) return;
    try {
      const text = await extractTextFromUpload(f);
      areaEl.value = text.slice(0, 6000);
      playPop(640);
    } catch (err) {
      alert(`Could not read ${f.name}: ${err.message}`);
    }
  });
}

function mountTranslate(form, run) {
  const srcLang = gameTabs(['Auto Detect', 'English', 'Spanish', 'French', 'German', 'Japanese', 'Korean', 'Mandarin Chinese', 'Arabic', 'Vietnamese'], 'Auto Detect', null, 'From Language');
  const dstLang = gameTabs(LANGUAGES, 'Spanish', null, 'Translate To');
  const engineTabs = gameTabs(['Google Translate', 'Waffle AI (Strict)'], 'Google Translate', null, 'Engine');
  const src = area('Good morning! Where is the coziest waffle bakery nearby?', 4, 'Type or paste text to translate…');
  const uploadPill = attachUpload(src);

  let lastTranslation = '';
  let lastLangCode = 'es';
  let activeAbort = null;
  form.addEventListener('tool-dispose', () => activeAbort?.abort());

  const gCard = gEl('div', { class: 'pastel-card cream eng-output-card', hidden: true });
  const gMeta = gEl('div', { class: 'eng-tr-meta' });
  const gResult = gEl('div', { class: 'eng-tr-result' });
  const gRoman = gEl('div', { class: 'eng-tr-roman', hidden: true });
  const gDict = gEl('div', { class: 'eng-tr-dict', hidden: true });

  const copyBtn = gameBtn('📋 Copy', 'chip', async () => {
    if (!lastTranslation) return;
    const ok = await copyToClipboard(lastTranslation);
    copyBtn.textContent = ok ? 'Copied!' : 'Copy failed';
    setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1200);
  });
  const speakBtn = gameBtn('🔊 Pronounce', 'chip', () => {
    if (!lastTranslation || typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(lastTranslation);
      u.lang = lastLangCode;
      speechSynthesis.speak(u);
      playPop(640);
    } catch {}
  });
  const docxBtn = gameBtn('⬇ Save .docx', 'chip', () => {
    if (!lastTranslation) return;
    playPop(620);
    triggerFileDownload(createDocxBlob(lastTranslation, `Waffle Translate (${dstLang.value})`), 'waffle-translation.docx');
  });
  const gActions = gEl('div', { class: 'gtabs eng-out-actions' }, copyBtn, speakBtn, docxBtn);
  gCard.append(gMeta, gResult, gRoman, gDict, gActions);

  async function translateWithGoogle(text, sl, tl, signal) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&dt=rm&dt=bd&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);
    const data = await res.json();
    const sentences = Array.isArray(data?.[0]) ? data[0] : [];
    const translated = sentences.map(s => (Array.isArray(s) && typeof s[0] === 'string' ? s[0] : '')).join('').trim();
    const romanization = sentences
      .map(s => (Array.isArray(s) && typeof s[2] === 'string' ? s[2] : ''))
      .filter(Boolean)
      .join(' ')
      .trim();
    const detectedCode = typeof data?.[2] === 'string' ? data[2] : sl;
    const dictItems = Array.isArray(data?.[1])
      ? data[1].slice(0, 3).map(entry => ({
          pos: entry[0] || '',
          terms: Array.isArray(entry[1]) ? entry[1].slice(0, 4) : []
        })).filter(e => e.terms.length)
      : [];
    return { translated, romanization, detectedCode, dictItems };
  }

  const runStrictAI = (text, note) => {
    gCard.hidden = true;
    run.ask({
      systemPrompt: 'You are a strict translator. Output ONLY the exact translated text. Never explain, never add notes, never add commentary.',
      userPrompt: `Translate from ${srcLang.value} to ${dstLang.value}:\n${text}`,
      temperature: 0.15,
      maxTokens: 400,
      skipSpeakHint: true,
      onDone(out) {
        lastTranslation = out.trim();
        lastLangCode = LANG_CODES[dstLang.value] || 'en';
        if (note) {
          gMeta.textContent = note;
        }
      }
    });
  };

  const go = async () => {
    const text = src.value.trim();
    if (!text) return;
    playPop(560);

    if (engineTabs.value !== 'Google Translate') {
      runStrictAI(text);
      return;
    }

    activeAbort?.abort();
    const ac = new AbortController();
    activeAbort = ac;
    run.outBox.hidden = true;
    gCard.hidden = false;
    gMeta.textContent = '🌐 Google Translate · Translating…';
    gResult.textContent = '';
    gRoman.hidden = true;
    gDict.hidden = true;

    const sl = LANG_CODES[srcLang.value] || 'auto';
    const tl = LANG_CODES[dstLang.value] || 'es';
    lastLangCode = tl;

    try {
      const res = await translateWithGoogle(text, sl, tl, ac.signal);
      if (!res.translated) throw new Error('Empty response');
      lastTranslation = res.translated;
      const detectedLabel = CODE_NAMES[String(res.detectedCode || '').toLowerCase()] || res.detectedCode;
      gMeta.textContent = sl === 'auto' && detectedLabel
        ? `🌐 Google Translate · Detected: ${detectedLabel} → ${dstLang.value}`
        : `🌐 Google Translate · ${srcLang.value} → ${dstLang.value}`;
      gResult.textContent = res.translated;

      if (res.romanization && res.romanization.toLowerCase() !== res.translated.toLowerCase()) {
        gRoman.textContent = `Pronunciation: ${res.romanization}`;
        gRoman.hidden = false;
      }
      if (res.dictItems.length) {
        gDict.innerHTML = res.dictItems
          .map(d => `<span class="eng-dict-chip"><b>${d.pos}:</b> ${d.terms.join(', ')}</span>`)
          .join('');
        gDict.hidden = false;
      }
      playSparkle();
    } catch (err) {
      if (err.name === 'AbortError') return;
      // Seamless fallback to strict translation-only AI if Google Translate is offline/blocked
      runStrictAI(text, 'Offline fallback · Waffle AI (Strict)');
    } finally {
      if (activeAbort === ac) activeAbort = null;
    }
  };

  const swapBtn = gameBtn('⇄ Swap Languages', 'chip', () => {
    if (srcLang.value !== 'Auto Detect' && LANGUAGES.includes(srcLang.value)) {
      const prevDst = dstLang.value;
      dstLang.value = srcLang.value;
      srcLang.value = prevDst;
      if (lastTranslation) src.value = lastTranslation;
      playBoing();
    }
  });

  form.append(
    engineTabs.el,
    srcLang.el,
    dstLang.el,
    uploadPill.el,
    gameField('Text to Translate', src),
    gEl('div', { class: 'gtabs' }, gameBtn('🌐 Translate', 'primary', go), swapBtn),
    gCard,
    run.outBox
  );
}

function mountCorrector(form, run) {
  const focus = gameTabs(['Full Fix (Grammar + Flow)', 'Light Proofread Only', 'Academic Polish'], 'Full Fix (Grammar + Flow)', null, 'Correction Mode');
  const explainTog = gameToggle('Explain every fix', true);
  const src = area('Me and him goes to the bakery yesterday, and the waffles was really good but expensive alot.', 4);
  const uploadPill = attachUpload(src);

  const go = () => {
    const text = src.value.trim();
    if (!text) return;
    playPop(560);
    run.ask({
      systemPrompt: 'You are Sentence Corrector, an encouraging English & writing editor. Fix grammar, spelling, punctuation, and clarity.',
      userPrompt: [
        `Mode: ${focus.value}.`,
        explainTog.checked
          ? 'Respond in Markdown with:\n### Corrected Version\n<corrected text>\n\n### What Changed\n- concise bullet list of fixes'
          : 'Respond with only the corrected text.',
        `\nOriginal:\n${text}`
      ].join('\n'),
      temperature: 0.25
    });
  };

  form.append(focus.el, explainTog.el, uploadPill.el, gameField('Draft Text', src), gameBtn('✅ Fix & Polish', 'primary', go), run.outBox);
}

function mountFlashcards(form, run) {
  const topic = lineInput('Ordering food at a café', 'Topic or word list…');
  const lang = gameTabs(['Spanish', 'French', 'Japanese', 'German', 'Korean', 'Italian', 'Arabic', 'Mandarin Chinese'], 'Japanese', null, 'Study Language');
  const count = gameTabs(['4', '6', '8'], '6', null, 'Cards');
  const deck = gEl('div', { class: 'flashcard-grid' });

  const go = () => {
    playPop(560);
    deck.replaceChildren();
    run.ask({
      systemPrompt: 'You generate language study flashcards. Output ONLY valid lines in the exact format: FRONT || BACK || HINT (one card per line, no numbering).',
      userPrompt: `Create ${count.value} ${lang.value} study flashcards for the topic: "${topic.value.trim() || 'Everyday greetings'}". Each line MUST be: <${lang.value} phrase> || <English translation> || <pronunciation or example>.`,
      temperature: 0.5,
      onDone(txt) {
        const cards = txt.split('\n').map(l => l.split('||').map(s => s.trim())).filter(p => p.length >= 2 && p[0] && p[1]);
        if (!cards.length) return;
        deck.replaceChildren(...cards.map(([front, back, hint]) => {
          let flipped = false;
          const card = gEl('button', { type: 'button', class: 'flashcard-tile' });
          const render = () => {
            card.classList.toggle('is-flipped', flipped);
            card.innerHTML = flipped
              ? `<span class="fc-kicker">ENGLISH</span><strong>${back}</strong>${hint ? `<small>${hint}</small>` : ''}`
              : `<span class="fc-kicker">${lang.value.toUpperCase()} · TAP TO FLIP</span><strong>${front}</strong>`;
          };
          card.addEventListener('click', () => { flipped = !flipped; playPop(flipped ? 640 : 500); render(); });
          render();
          return card;
        }));
      }
    });
  };

  form.append(lang.el, count.el, gameField('Topic', topic), gameBtn('🃏 Generate Interactive Flashcards', 'primary', go), deck, run.outBox);
}

function mountDialogue(form, run) {
  const lang = gameTabs(['Spanish', 'French', 'Japanese', 'German', 'Italian', 'Korean', 'English'], 'Spanish', null, 'Practice Language');
  const scene = gameTabs(['Cozy Café', 'Airport Check-In', 'Making Friends', 'Bookstore', 'Job Interview'], 'Cozy Café', null, 'Scenario');
  const hintTog = gameToggle('Include English translation hint', true);
  const replyIn = lineInput('Hola! Quisiera un café y un waffle, por favor.', 'Type your reply in the practice language…');
  const historyBox = gEl('div', { class: 'pastel-card cream eng-chat-log' });
  const convo = [];

  const renderLog = () => {
    historyBox.replaceChildren(...convo.map(m =>
      gEl('div', { class: `eng-turn ${m.role === 'user' ? 'is-user' : 'is-bot'}` },
        gEl('strong', {}, m.role === 'user' ? 'You: ' : 'Partner: '),
        gEl('span', {}, m.content)
      )
    ));
  };

  const sendTurn = async (starter = false) => {
    const userMsg = starter
      ? `Start a friendly roleplay in ${lang.value} for the scenario "${scene.value}". Greet me first in 1-2 short sentences.`
      : replyIn.value.trim();
    if (!userMsg) return;
    if (!starter) {
      convo.push({ role: 'user', content: userMsg });
      replyIn.value = '';
    }
    renderLog();
    playPop(560);
    await run.ask({
      systemPrompt: `You are a friendly native ${lang.value} conversation partner in a "${scene.value}" scenario. Reply in natural ${lang.value} (1-3 short sentences), gently encourage the learner${hintTog.checked ? ', and include a brief "(English: ...)" hint at the end' : ''}.`,
      userPrompt: starter ? userMsg : `Conversation so far:\n${convo.map(m => `${m.role}: ${m.content}`).join('\n')}\nRespond to the learner naturally.`,
      temperature: 0.65,
      onDone(txt) {
        convo.push({ role: 'assistant', content: txt });
        renderLog();
      }
    });
  };

  form.append(
    lang.el, scene.el, hintTog.el,
    gEl('div', { class: 'gtabs' },
      gameBtn('▶ Start / Reset Scene', 'chip', () => { convo.length = 0; sendTurn(true); })
    ),
    historyBox,
    gameField('Your Line', replyIn),
    gameBtn('💬 Send Reply', 'primary', () => sendTurn(false)),
    run.outBox
  );
}

export function mountEnglish(id, root) {
  if (!ENGLISH_IDS.includes(id) || !root || typeof root.append !== 'function') return false;
  root.querySelectorAll('.tool-form').forEach(n => n.dispatchEvent(new Event('tool-dispose')));
  root.replaceChildren();

  const form = gEl('section', { class: 'game-panel tool-form' });
  const badgeText = id === 'waffle-translate'
    ? '🌐 Powered by Google Translate API'
    : '✨ Powered by Qwen 2.5 1.5B';
  const badge = gEl('div', { class: 'eng-ai-banner' },
    gEl('span', { class: 'gbadge' }, badgeText)
  );
  form.append(badge);
  root.append(form);

  const run = createRunner(form);

  if (id === 'waffle-translate') { mountTranslate(form, run); return true; }
  if (id === 'sentence-corrector') { mountCorrector(form, run); return true; }
  if (id === 'flashcard-maker') { mountFlashcards(form, run); return true; }
  if (id === 'dialogue-practice') { mountDialogue(form, run); return true; }

  const configs = {
    'tone-rewriter': () => {
      const tone = gameTabs(['Friendly & Warm', 'Professional', 'Academic', 'Super Concise', 'Pirate', 'Cozy Waffle'], 'Friendly & Warm', null, 'Target Tone');
      const src = area('Hey, I need the report by Friday so we can finish the project.', 4);
      const up = attachUpload(src);
      return {
        controls: [tone.el, up.el, gameField('Original Text', src)],
        btn: '🎭 Rewrite Tone',
        build: () => ({
          systemPrompt: 'You are a skilled tone editor. Rewrite text cleanly in the requested tone while preserving the core meaning.',
          userPrompt: `Rewrite the following text in a "${tone.value}" tone. Give the main rewrite plus 1 short alternative.\n\nText:\n${src.value}`
        })
      };
    },
    'grammar-explainer': () => {
      const src = area('Had I known about the waffle festival, I would have arrived earlier.', 3);
      return {
        controls: [gameField('Sentence to Analyze', src)],
        btn: '🔍 Explain Grammar',
        build: () => ({
          systemPrompt: 'You are a clear, friendly linguistics and English grammar teacher. Use Markdown sections and bullet points.',
          userPrompt: `Analyze the grammar, tense, clause structure, and key parts of speech in this sentence:\n\n"${src.value}"`
        })
      };
    },
    'summarizer-pro': () => {
      const fmt = gameTabs(['Bullet Highlights', 'Short Paragraph', '1-Sentence TL;DR', 'Key Takeaways + Action Items'], 'Bullet Highlights', null, 'Summary Format');
      const src = area('Paste an article, meeting notes, or attach a .docx / .txt file to summarize.', 5);
      const up = attachUpload(src);
      return {
        controls: [fmt.el, up.el, gameField('Source Text or Document', src)],
        btn: '📝 Summarize Now',
        build: () => ({
          systemPrompt: 'You summarize documents accurately and concisely using clean Markdown.',
          userPrompt: `Summarize the text below using the format "${fmt.value}".\n\nContent:\n${src.value}`
        })
      };
    },
    'vocab-builder': () => {
      const word = lineInput('serendipity', 'Enter any word or phrase…');
      const level = gameTabs(['Everyday Learner', 'SAT / Academic', 'Etymology Deep Dive'], 'Everyday Learner', null, 'Depth');
      return {
        controls: [level.el, gameField('Word or Phrase', word)],
        btn: '📚 Explore Word',
        build: () => ({
          systemPrompt: 'You are a lexicographer and vocabulary coach. Format clearly in Markdown.',
          userPrompt: `Create a ${level.value} vocabulary guide for "${word.value}": definition, part of speech, pronunciation, origin, 4 synonyms, 2 antonyms, and 3 example sentences.`
        })
      };
    },
    'essay-outliner': () => {
      const kind = gameTabs(['Persuasive Essay', 'Research Report', 'How-To Guide', 'Book Review'], 'Persuasive Essay', null, 'Document Type');
      const topic = lineInput('Why public libraries make cities stronger', 'Topic or thesis…');
      const draftTog = gameToggle('Also write full starter draft (exportable to .docx)', true);
      return {
        controls: [kind.el, draftTog.el, gameField('Topic / Prompt', topic)],
        btn: '📄 Build Outline & Draft',
        build: () => ({
          systemPrompt: 'You are an expert writing coach. Produce well-structured Markdown headings ready to export as a .docx document.',
          userPrompt: `Create a structured ${kind.value} outline on: "${topic.value}". ${draftTog.checked ? 'Include a complete, polished multi-paragraph starter draft under the outline.' : ''}`,
          maxTokens: 760
        })
      };
    },
    'rhyme-poetry': () => {
      const formPick = gameTabs(['Rhymes & Near-Rhymes', 'Haiku (5-7-5)', 'Limerick', 'Acrostic', 'Short Poem'], 'Haiku (5-7-5)', null, 'Form');
      const prompt = lineInput('Golden waffles on a rainy morning', 'Word to rhyme or poem theme…');
      return {
        controls: [formPick.el, gameField('Word or Theme', prompt)],
        btn: '🪶 Compose',
        build: () => ({
          systemPrompt: 'You are a playful poet and songwriter. Use crisp Markdown formatting.',
          userPrompt: `Mode: ${formPick.value}. Theme or word: "${prompt.value}".`,
          temperature: 0.8
        })
      };
    },
    'idiom-decoder': () => {
      const phrase = lineInput('break the ice', 'Enter an idiom, proverb, or slang phrase…');
      const lang = gameTabs(['English', 'Spanish', 'French', 'Japanese', 'German'], 'English', null, 'Origin / Comparison');
      return {
        controls: [lang.el, gameField('Idiom or Slang', phrase)],
        btn: '💡 Decode Meaning',
        build: () => ({
          systemPrompt: 'You explain idioms, slang, and proverbs clearly with cultural equivalents.',
          userPrompt: `Explain the meaning, literal origin, when to use it, and a natural equivalent in ${lang.value} (or English if non-English) for: "${phrase.value}".`
        })
      };
    },
    'story-starter': () => {
      const genre = gameTabs(['Cozy Mystery', 'Sci-Fi', 'Fantasy', 'Slice of Life', 'Adventure'], 'Cozy Mystery', null, 'Genre');
      const hook = area('A baker discovers a secret map baked inside the morning waffle iron.', 3);
      return {
        controls: [genre.el, gameField('Story Idea or Opening Line', hook)],
        btn: '📖 Write Next Scene',
        build: () => ({
          systemPrompt: 'You are an imaginative fiction co-writer. Write vivid, engaging prose in clean Markdown.',
          userPrompt: `Write a captivating 2-3 paragraph ${genre.value} opening scene based on: "${hook.value}", and end with 2 plot directions the writer could take next.`,
          temperature: 0.82
        })
      };
    },
    'email-polisher': () => {
      const style = gameTabs(['Polite & Clear', 'Friendly Follow-Up', 'Decline Gracefully', 'Urgent Request'], 'Polite & Clear', null, 'Email Type');
      const notes = area('tell prof I was sick tuesday and ask if i can turn in lab 4 tomorrow morning', 4);
      return {
        controls: [style.el, gameField('Rough Notes', notes)],
        btn: '✉ Draft Polished Email',
        build: () => ({
          systemPrompt: 'You write clear, respectful, natural emails with a crisp Subject line.',
          userPrompt: `Turn these rough notes into a ${style.value} email with a Subject line:\n\n${notes.value}`,
          temperature: 0.45
        })
      };
    },
    'eli5-explainer': () => {
      const audience = gameTabs(['Like I’m 5 (ELI5)', 'Middle School', 'Curious Adult'], 'Like I’m 5 (ELI5)', null, 'Reading Level');
      const topic = lineInput('How do airplanes stay in the sky?', 'Any concept, word, or question…');
      return {
        controls: [audience.el, gameField('Topic to Explain', topic)],
        btn: '🧠 Explain Simply',
        build: () => ({
          systemPrompt: 'You explain complex ideas using vivid everyday analogies and simple language.',
          userPrompt: `Explain "${topic.value}" at a "${audience.value}" level using a fun kitchen or everyday analogy.`
        })
      };
    },
    'pronunciation-coach': () => {
      const phrase = lineInput('Croissant / Worcestershire / Schmetterling', 'Word or phrase to pronounce…');
      const accent = gameTabs(['American English', 'British English', 'French', 'Spanish', 'Japanese', 'German'], 'American English', null, 'Accent / Language');
      return {
        controls: [accent.el, gameField('Word or Phrase', phrase)],
        btn: '🗣 Show Pronunciation',
        build: () => ({
          systemPrompt: 'You are a phonetics and pronunciation coach. Break words into clear syllables, stress marks, IPA, and helpful sound analogies.',
          userPrompt: `Give a clear ${accent.value} pronunciation guide for "${phrase.value}" including syllable breakdown, stressed syllable in CAPS, IPA, and mouth/sound tips.`
        })
      };
    }
  };

  const cfg = configs[id]();
  const goBtn = gameBtn(cfg.btn, 'primary', () => {
    const req = cfg.build();
    playPop(560);
    run.ask(req);
  });

  form.append(...cfg.controls, goBtn, run.outBox);
  return true;
}
