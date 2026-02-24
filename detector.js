/**
 * LinkedIn AI Post Detector - Heuristic Detection Engine
 *
 * Scores posts on multiple signals commonly associated with AI-generated text.
 * Returns a score from 0-100 and a breakdown of which signals fired.
 */

const AIDetector = (() => {

  // ─── Shared Score Thresholds ────────────────────────────────────────────────
  // Single source of truth for score-to-color/verdict mapping

  const SCORE_TIERS = [
    { min: 70, bg: '#dc2626', text: '#fff', label: 'AI', verdict: 'Very likely AI-generated', confidence: 'high' },
    { min: 50, bg: '#ea580c', text: '#fff', label: 'AI?', verdict: 'Likely AI-generated', confidence: 'medium-high' },
    { min: 30, bg: '#ca8a04', text: '#fff', label: 'Maybe', verdict: 'Possibly AI-assisted', confidence: 'medium' },
    { min: 15, bg: '#65a30d', text: '#fff', label: 'Mild', verdict: 'Mild AI signals', confidence: 'low' },
    { min: 0,  bg: '#16a34a', text: '#fff', label: 'Human', verdict: 'Likely human-written', confidence: 'low' },
  ];

  function getScoreInfo(score) {
    for (const tier of SCORE_TIERS) {
      if (score >= tier.min) return tier;
    }
    return SCORE_TIERS[SCORE_TIERS.length - 1];
  }

  // ─── Signal: Overused AI Phrases ───────────────────────────────────────────
  // Phrases that LLMs use at dramatically higher rates than human writers
  const AI_PHRASES_HIGH = [
    "in today's rapidly evolving",
    "in today's fast-paced",
    "it's not just about",
    "it's about",
    "here's the thing",
    "here's what i've learned",
    "here's why this matters",
    "let that sink in",
    "read that again",
    "let me be clear",
    "i'll say it louder for the people in the back",
    "this is a game-changer",
    "game changer",
    "paradigm shift",
    "at the end of the day",
    "it's not rocket science",
    "the question isn't whether",
    "the real question is",
    "hot take",
    "unpopular opinion",
    "i couldn't agree more",
    "this resonated with me",
    "this hit different",
    "are you leveraging",
    "stop scrolling",
    "if you're not already",
    "the future of",
    "the landscape of",
    "in the realm of",
    "it goes without saying",
    "needless to say",
    "at its core",
    "dive into",
    "deep dive",
    "unpack this",
    "let's unpack",
    "double down",
    "level up",
    "move the needle",
    "lean into",
    "circle back",
    "take it to the next level",
    "unlock the power",
    "unlock your potential",
    "harness the power",
    "navigate the complexities",
    "foster innovation",
    "foster a culture",
    "cultivate a mindset",
    "embrace the journey",
    "embark on",
    "delve into",
    "delve deeper",
    "tapestry of",
    "multifaceted",
    "ever-evolving",
    "cutting-edge",
    "groundbreaking",
    "transformative",
    "revolutionize",
    "spearheading",
    "synergy",
    "holistic approach",
    "robust framework",
    "comprehensive overview",
    "stands as a testament",
    "serves as a reminder",
    "underscores the importance",
    "sheds light on",
    "paves the way",
    "plays a pivotal role",
    "remains to be seen",
    "only time will tell",
  ];

  const AI_PHRASES_MEDIUM_RAW = [
    "leverage",
    "pivot",
    "ecosystem",
    "stakeholders",
    "actionable insights",
    "thought leadership",
    "value proposition",
    "scalable",
    "streamline",
    "optimize",
    "innovative",
    "disruption",
    "agile",
    "proactive",
    "best practices",
    "key takeaways",
    "bottom line",
    "roi",
    "bandwidth",
    "alignment",
    "north star",
    "low-hanging fruit",
    "table stakes",
    "net-net",
    "boil the ocean",
    "ideation",
    "synergize",
    "incentivize",
    "operationalize",
    "furthermore",
    "moreover",
    "additionally",
    "consequently",
    "nevertheless",
    "notwithstanding",
    "in conclusion",
    "to summarize",
    "in summary",
    "it is worth noting",
    "it is important to note",
    "it bears mentioning",
  ];

  // Pre-compile regex patterns once at init (not per-analysis)
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const MEDIUM_PHRASE_REGEXES = AI_PHRASES_MEDIUM_RAW.map(phrase =>
    phrase.includes(' ')
      ? new RegExp(escapeRegex(phrase), 'i')
      : new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i')
  );

  const HEDGE_PHRASES = [
    'it is important to', 'it is worth noting', 'it is crucial',
    'it should be noted', 'one might argue', 'it could be said',
    'in many ways', 'to a certain extent', 'in some respects',
    'broadly speaking', 'generally speaking', 'for the most part',
    'as a matter of fact', 'in point of fact', 'as it turns out',
    'interestingly enough', 'perhaps more importantly',
    'that being said', 'having said that', 'with that in mind',
    'all things considered', 'when all is said and done',
  ];

  const HEDGE_REGEXES = HEDGE_PHRASES.map(h =>
    ({ phrase: h, regex: new RegExp(escapeRegex(h), 'gi') })
  );

  // ─── Signal: Structural Patterns ───────────────────────────────────────────
  // AI posts often follow predictable structures

  function checkStructuralPatterns(text) {
    const signals = [];
    let score = 0;
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    // Pattern: Numbered list format (1. 2. 3. etc.)
    const numberedLines = lines.filter(l => /^\s*\d+[\.\)]\s/.test(l));
    if (numberedLines.length >= 3) {
      score += 12;
      signals.push({ name: 'Numbered list structure', weight: 12 });
    }

    // Pattern: Bullet point heavy
    const bulletLines = lines.filter(l => /^\s*[•\-\*✅🔹🔸▶️➡️✨🚀💡🎯]\s*/.test(l));
    if (bulletLines.length >= 3) {
      score += 10;
      signals.push({ name: 'Heavy bullet point usage', weight: 10 });
    }

    // Pattern: Emoji-heavy formatting (using emojis as bullet points or section headers)
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const emojiMatches = text.match(emojiRegex) || [];
    if (emojiMatches.length >= 5) {
      score += 8;
      signals.push({ name: `Emoji-heavy formatting (${emojiMatches.length} emojis)`, weight: 8 });
    }

    // Pattern: Hook + List + CTA structure
    const hasHook = lines.length > 0 && (
      lines[0].endsWith('?') ||
      lines[0].endsWith(':') ||
      /^(here's|stop|the truth|unpopular|hot take|i've been|most people)/i.test(lines[0])
    );
    const hasList = numberedLines.length >= 3 || bulletLines.length >= 3;
    const lastLines = lines.slice(-3).join(' ').toLowerCase();
    const hasCTA = /\b(agree|thoughts|comment|share|follow|repost|what do you think|drop a|tag someone|like if)\b/i.test(lastLines);

    if (hasHook && hasList && hasCTA) {
      score += 15;
      signals.push({ name: 'Hook → List → CTA formula', weight: 15 });
    } else if (hasHook && hasCTA) {
      score += 8;
      signals.push({ name: 'Hook → CTA formula', weight: 8 });
    }

    // Pattern: One-sentence-per-line (LinkedIn bro-poem style)
    const shortLines = lines.filter(l => l.trim().split(/\s+/).length <= 8 && l.trim().length > 0);
    if (lines.length >= 5 && shortLines.length / lines.length > 0.7) {
      score += 10;
      signals.push({ name: 'One-line-per-sentence style', weight: 10 });
    }

    // Pattern: Excessive line breaks between sentences
    const doubleBreaks = (text.match(/\n\s*\n/g) || []).length;
    if (doubleBreaks >= 4 && lines.length >= 5) {
      score += 5;
      signals.push({ name: 'Excessive paragraph breaks', weight: 5 });
    }

    return { score: Math.min(score, 35), signals };
  }

  // ─── Signal: Sentence Uniformity ───────────────────────────────────────────
  // AI text tends to have more uniform sentence lengths than human writing

  function checkSentenceUniformity(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length < 4) return { score: 0, signals: [] };

    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avg; // coefficient of variation

    // Low CV = very uniform sentence lengths = more likely AI
    if (cv < 0.25 && sentences.length >= 5) {
      return {
        score: 10,
        signals: [{ name: 'Very uniform sentence lengths', weight: 10 }]
      };
    } else if (cv < 0.35) {
      return {
        score: 5,
        signals: [{ name: 'Somewhat uniform sentence lengths', weight: 5 }]
      };
    }

    return { score: 0, signals: [] };
  }

  // ─── Signal: Hedging & Filler ──────────────────────────────────────────────
  // AI tends to over-hedge and use more filler/qualifiers

  function checkHedgingAndFiller(text) {
    const lower = text.toLowerCase();
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 30) return { score: 0, signals: [] };

    let hedgeCount = 0;
    const found = [];
    for (const { phrase, regex } of HEDGE_REGEXES) {
      regex.lastIndex = 0;
      const matches = lower.match(regex);
      if (matches) {
        hedgeCount += matches.length;
        found.push(phrase);
      }
    }

    const hedgeDensity = hedgeCount / (wordCount / 100);
    if (hedgeDensity > 3) {
      return {
        score: 10,
        signals: [{ name: `High hedging density (${found.slice(0, 3).join(', ')}...)`, weight: 10 }]
      };
    } else if (hedgeDensity > 1.5) {
      return {
        score: 5,
        signals: [{ name: `Moderate hedging density`, weight: 5 }]
      };
    }

    return { score: 0, signals: [] };
  }

  // ─── Signal: Phrase Matching ───────────────────────────────────────────────

  function checkAIPhrases(text) {
    const lower = text.toLowerCase();
    const signals = [];
    let score = 0;
    let highHits = 0;
    let medHits = 0;
    const foundPhrases = [];

    for (const phrase of AI_PHRASES_HIGH) {
      if (lower.includes(phrase)) {
        highHits++;
        foundPhrases.push(phrase);
      }
    }

    for (const regex of MEDIUM_PHRASE_REGEXES) {
      if (regex.test(lower)) {
        medHits++;
      }
    }

    if (highHits >= 4) {
      score += 25;
      signals.push({ name: `${highHits} high-signal AI phrases detected`, weight: 25, phrases: foundPhrases.slice(0, 5) });
    } else if (highHits >= 2) {
      score += 15;
      signals.push({ name: `${highHits} high-signal AI phrases detected`, weight: 15, phrases: foundPhrases.slice(0, 5) });
    } else if (highHits === 1) {
      score += 6;
      signals.push({ name: `AI phrase: "${foundPhrases[0]}"`, weight: 6 });
    }

    if (medHits >= 5) {
      score += 12;
      signals.push({ name: `${medHits} corporate/AI buzzwords`, weight: 12 });
    } else if (medHits >= 3) {
      score += 7;
      signals.push({ name: `${medHits} corporate/AI buzzwords`, weight: 7 });
    }

    return { score: Math.min(score, 30), signals };
  }

  // ─── Signal: Engagement Bait ───────────────────────────────────────────────

  function checkEngagementBait(text) {
    const signals = [];
    let score = 0;

    const baitPatterns = [
      { pattern: /agree\s*\?|do you agree/i, name: 'Agree?' },
      { pattern: /thoughts\s*\??$/im, name: 'Thoughts?' },
      { pattern: /what do you think\s*\?/i, name: 'What do you think?' },
      { pattern: /comment below/i, name: 'Comment below' },
      { pattern: /share this/i, name: 'Share this' },
      { pattern: /tag someone/i, name: 'Tag someone' },
      { pattern: /follow me for/i, name: 'Follow me for' },
      { pattern: /repost if/i, name: 'Repost if' },
      { pattern: /like if you/i, name: 'Like if you' },
      { pattern: /drop a .{1,10} if/i, name: 'Drop a [emoji] if' },
      { pattern: /save this for later/i, name: 'Save this' },
      { pattern: /share with your network/i, name: 'Share with network' },
    ];

    let baitCount = 0;
    const foundBait = [];
    for (const { pattern, name } of baitPatterns) {
      if (pattern.test(text)) {
        baitCount++;
        foundBait.push(name);
      }
    }

    if (baitCount >= 3) {
      score += 12;
      signals.push({ name: `Heavy engagement bait (${foundBait.join(', ')})`, weight: 12 });
    } else if (baitCount >= 1) {
      score += 5;
      signals.push({ name: `Engagement bait: ${foundBait.join(', ')}`, weight: 5 });
    }

    return { score, signals };
  }

  // ─── Signal: Repetitive Phrasing ───────────────────────────────────────────
  // AI often repeats key phrases or sentence openers

  function checkRepetition(text) {
    const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 5);
    if (sentences.length < 4) return { score: 0, signals: [] };

    // Check for repeated sentence starters (first 3 words)
    const starters = sentences.map(s => {
      const words = s.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase();
      return words;
    }).filter(s => s.split(/\s+/).length >= 2);

    const starterCounts = {};
    for (const s of starters) {
      starterCounts[s] = (starterCounts[s] || 0) + 1;
    }

    const repeatedStarters = Object.entries(starterCounts).filter(([_, count]) => count >= 3);
    if (repeatedStarters.length > 0) {
      return {
        score: 8,
        signals: [{ name: `Repetitive sentence starters ("${repeatedStarters[0][0]}..." x${repeatedStarters[0][1]})`, weight: 8 }]
      };
    }

    return { score: 0, signals: [] };
  }

  // ─── Main Analysis Function ────────────────────────────────────────────────

  function analyze(text) {
    if (!text || text.trim().length < 50) {
      return {
        score: 0,
        verdict: 'Too short to analyze',
        confidence: 'low',
        signals: [],
        wordCount: text ? text.split(/\s+/).filter(w => w.length > 0).length : 0,
      };
    }

    const results = [
      checkAIPhrases(text),
      checkStructuralPatterns(text),
      checkSentenceUniformity(text),
      checkHedgingAndFiller(text),
      checkEngagementBait(text),
      checkRepetition(text),
    ];

    let totalScore = 0;
    const allSignals = [];

    for (const r of results) {
      totalScore += r.score;
      allSignals.push(...r.signals);
    }

    // Cap at 100
    totalScore = Math.min(totalScore, 100);

    const tier = getScoreInfo(totalScore);

    // Sort signals by weight descending
    allSignals.sort((a, b) => b.weight - a.weight);

    return {
      score: totalScore,
      verdict: tier.verdict,
      confidence: tier.confidence,
      signals: allSignals,
      wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
    };
  }

  return { analyze, getScoreInfo, SCORE_TIERS };
})();
