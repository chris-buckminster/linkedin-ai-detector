# LinkedIn AI Post Detector — Chrome Extension

A Chrome extension that analyzes LinkedIn feed posts and scores them for likelihood of being AI-generated using heuristic pattern matching.

## What It Does

As you scroll your LinkedIn feed, the extension automatically analyzes each post and adds a small colored badge showing an AI probability score (0–100%). Click any badge to see a detailed breakdown of which signals were detected.

### Score Scale

| Score | Color  | Meaning                |
|-------|--------|------------------------|
| 70–100 | 🔴 Red    | Very likely AI-generated |
| 50–69  | 🟠 Orange | Likely AI-generated      |
| 30–49  | 🟡 Yellow | Possibly AI-assisted     |
| 15–29  | 🟢 Light green | Mild AI signals    |
| 0–14   | 🟢 Green  | Likely human-written     |

### Detection Signals

The extension checks for:

- **AI Phrases** — Overused LLM phrases like "in today's rapidly evolving", "let's unpack", "delve into", "paradigm shift", etc.
- **Structural Patterns** — Numbered lists, emoji-heavy formatting, hook→list→CTA formulas, one-sentence-per-line "bro-poem" style
- **Sentence Uniformity** — AI text tends to have suspiciously uniform sentence lengths
- **Hedging & Filler** — Excessive qualifiers like "it is worth noting", "broadly speaking"
- **Engagement Bait** — "Agree?", "Thoughts?", "Tag someone who...", "Repost if..."
- **Repetitive Starters** — AI often begins multiple sentences with the same phrase

## Installation

1. Download or clone this folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select this folder (`linkedin-ai-detector`)
6. Navigate to linkedin.com — badges will appear on posts in your feed

## Popup Tool

Click the extension icon in your toolbar to open a text analysis tool. Paste any text to analyze it on the spot — useful for evaluating posts, emails, or content outside of LinkedIn.

## Limitations

This is a **heuristic tool**, not a machine learning classifier. It looks for stylistic patterns commonly associated with LLM-generated text. That means:

- Some human writers who use corporate buzzwords will score high
- Well-edited AI text that avoids common patterns will score low
- It's best treated as a "sniff test," not a verdict

## Files

```
linkedin-ai-detector/
├── manifest.json      # Extension configuration
├── detector.js        # Core heuristic analysis engine
├── content.js         # LinkedIn page integration + badge UI
├── styles.css         # Badge animations
├── popup.html         # Toolbar popup with manual text analyzer
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```
