/**
 * LinkedIn AI Post Detector - Content Script
 *
 * Runs on linkedin.com, finds posts in the feed, analyzes them,
 * and injects a visual score badge on each post.
 */

(() => {
  const PROCESSED_ATTR = 'data-ai-detector-processed';
  const BADGE_CLASS = 'ai-detector-badge';
  const DETAIL_CLASS = 'ai-detector-detail';

  // Post container selectors (ordered by specificity)
  const POST_SELECTORS = [
    '.feed-shared-update-v2',
    '[data-urn^="urn:li:activity"]',
    '.occludable-update',
  ];

  // Post text selectors (ordered by specificity)
  const TEXT_SELECTORS = [
    '.feed-shared-update-v2__description',
    '.feed-shared-text',
    '.feed-shared-inline-show-more-text',
    '.update-components-text',
    '[data-ad-preview="message"]',
    '.break-words',
  ];

  // ─── Post Text Extraction ──────────────────────────────────────────────────

  function extractPostText(postElement) {
    let text = '';
    for (const sel of TEXT_SELECTORS) {
      const el = postElement.querySelector(sel);
      if (el) {
        text = el.innerText || el.textContent || '';
        if (text.trim().length > 30) break;
      }
    }

    // Fallback: grab any substantial text block within the post
    if (text.trim().length < 30) {
      const spans = postElement.querySelectorAll('span.break-words');
      for (const span of spans) {
        const t = span.innerText || '';
        if (t.length > text.length) text = t;
      }
    }

    return text.trim();
  }

  // ─── SVG Score Gauge ──────────────────────────────────────────────────────

  function createScoreGauge(score, color) {
    const size = 56;
    const strokeWidth = 5;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.classList.add('ai-detector-detail__gauge');

    // Background ring
    const bgCircle = document.createElementNS(ns, 'circle');
    bgCircle.setAttribute('cx', size / 2);
    bgCircle.setAttribute('cy', size / 2);
    bgCircle.setAttribute('r', radius);
    bgCircle.setAttribute('stroke-width', strokeWidth);
    bgCircle.classList.add('ai-detector-detail__gauge-ring', 'ai-detector-detail__gauge-bg');
    svg.appendChild(bgCircle);

    // Score arc
    const scoreCircle = document.createElementNS(ns, 'circle');
    scoreCircle.setAttribute('cx', size / 2);
    scoreCircle.setAttribute('cy', size / 2);
    scoreCircle.setAttribute('r', radius);
    scoreCircle.setAttribute('stroke-width', strokeWidth);
    scoreCircle.setAttribute('stroke', color);
    scoreCircle.setAttribute('stroke-dasharray', circumference);
    scoreCircle.setAttribute('stroke-dashoffset', offset);
    scoreCircle.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
    scoreCircle.classList.add('ai-detector-detail__gauge-ring');
    svg.appendChild(scoreCircle);

    // Center text
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', size / 2);
    text.setAttribute('y', size / 2);
    text.setAttribute('font-size', '14');
    text.classList.add('ai-detector-detail__gauge-text');
    text.textContent = `${score}%`;
    svg.appendChild(text);

    return svg;
  }

  // ─── Badge Creation ────────────────────────────────────────────────────────

  function createBadge(result) {
    const tier = AIDetector.getScoreInfo(result.score);

    const badge = document.createElement('button');
    badge.className = BADGE_CLASS;
    badge.type = 'button';
    badge.style.background = tier.bg;
    badge.setAttribute('aria-label', `AI detection score: ${result.score}%. ${result.verdict}`);
    badge.setAttribute('aria-expanded', 'false');

    const scoreSpan = document.createElement('span');
    scoreSpan.textContent = `${tier.label} ${result.score}%`;
    badge.appendChild(scoreSpan);

    // Detail panel
    const detail = document.createElement('div');
    detail.className = `${DETAIL_CLASS} ai-detector-detail--below`;
    detail.setAttribute('aria-hidden', 'true');
    detail.style.setProperty('--tier-color', tier.bg);
    detail.appendChild(buildDetailContent(result, tier));
    badge.appendChild(detail);

    // Toggle detail on click
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isOpen = badge.getAttribute('aria-expanded') === 'true';
      closeAllDetails();
      if (!isOpen) {
        positionDetail(badge, detail);
        badge.setAttribute('aria-expanded', 'true');
        detail.setAttribute('aria-hidden', 'false');
      }
    });

    // Toggle on Enter/Space
    badge.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        badge.click();
      }
    });

    return badge;
  }

  function positionDetail(badge, detail) {
    // Check if panel would overflow viewport bottom
    const rect = badge.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const panelHeight = 300; // estimated

    detail.classList.remove('ai-detector-detail--below', 'ai-detector-detail--above');
    if (spaceBelow < panelHeight && rect.top > panelHeight) {
      detail.classList.add('ai-detector-detail--above');
    } else {
      detail.classList.add('ai-detector-detail--below');
    }
  }

  function buildDetailContent(result, tier) {
    const frag = document.createDocumentFragment();

    // Header: gauge + verdict
    const header = document.createElement('div');
    header.className = 'ai-detector-detail__header';

    header.appendChild(createScoreGauge(result.score, tier.bg));

    const info = document.createElement('div');
    info.className = 'ai-detector-detail__header-info';
    const verdictEl = document.createElement('div');
    verdictEl.className = 'ai-detector-detail__verdict';
    verdictEl.textContent = result.verdict;
    const wordcount = document.createElement('div');
    wordcount.className = 'ai-detector-detail__wordcount';
    wordcount.textContent = `${result.wordCount} words analyzed`;
    info.appendChild(verdictEl);
    info.appendChild(wordcount);
    header.appendChild(info);

    frag.appendChild(header);

    // Signals
    if (result.signals.length > 0) {
      const label = document.createElement('div');
      label.className = 'ai-detector-detail__section-label';
      label.textContent = 'Signals Detected';
      frag.appendChild(label);

      for (const sig of result.signals.slice(0, 8)) {
        const signal = document.createElement('div');
        signal.className = 'ai-detector-detail__signal';

        const sigHeader = document.createElement('div');
        sigHeader.className = 'ai-detector-detail__signal-header';
        const name = document.createElement('span');
        name.className = 'ai-detector-detail__signal-name';
        name.textContent = sig.name;
        const weight = document.createElement('span');
        weight.className = 'ai-detector-detail__signal-weight';
        weight.textContent = `+${sig.weight}`;
        sigHeader.appendChild(name);
        sigHeader.appendChild(weight);
        signal.appendChild(sigHeader);

        const bar = document.createElement('div');
        bar.className = 'ai-detector-detail__signal-bar';
        const fill = document.createElement('div');
        fill.className = 'ai-detector-detail__signal-fill';
        fill.style.width = `${Math.min(sig.weight * 4, 100)}%`;
        fill.style.background = tier.bg;
        bar.appendChild(fill);
        signal.appendChild(bar);

        frag.appendChild(signal);

        if (sig.phrases && sig.phrases.length > 0) {
          const phrases = document.createElement('div');
          phrases.className = 'ai-detector-detail__signal-phrases';
          phrases.textContent = `"${sig.phrases.slice(0, 3).join('", "')}"`;
          frag.appendChild(phrases);
        }
      }
    } else {
      const empty = document.createElement('div');
      empty.className = 'ai-detector-detail__empty';
      empty.textContent = 'No significant AI signals detected.';
      frag.appendChild(empty);
    }

    const footer = document.createElement('div');
    footer.className = 'ai-detector-detail__footer';
    footer.textContent = 'Heuristic analysis only \u2014 not definitive.';
    frag.appendChild(footer);

    return frag;
  }

  // ─── Single Delegated Close Handler ────────────────────────────────────────

  function closeAllDetails() {
    const openBadges = document.querySelectorAll(`.${BADGE_CLASS}[aria-expanded="true"]`);
    for (const badge of openBadges) {
      badge.setAttribute('aria-expanded', 'false');
      const detail = badge.querySelector(`.${DETAIL_CLASS}`);
      if (detail) {
        detail.classList.add('ai-detector-detail--closing');
        detail.addEventListener('animationend', () => {
          detail.classList.remove('ai-detector-detail--closing');
          detail.setAttribute('aria-hidden', 'true');
        }, { once: true });
      }
    }
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest(`.${BADGE_CLASS}`)) {
      closeAllDetails();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllDetails();
  });

  // ─── Post Processing ──────────────────────────────────────────────────────

  function processPost(postElement) {
    if (postElement.hasAttribute(PROCESSED_ATTR)) return;
    postElement.setAttribute(PROCESSED_ATTR, 'true');

    const text = extractPostText(postElement);
    if (!text || text.length < 50) return;

    const result = AIDetector.analyze(text);

    // Find a good place to inject the badge
    const textContainer = postElement.querySelector(
      TEXT_SELECTORS.slice(0, 4).join(', ')
    ) || postElement.querySelector('.break-words');

    if (textContainer && textContainer.parentNode) {
      const badge = createBadge(result);
      textContainer.parentNode.insertBefore(badge, textContainer.nextSibling);
    }
  }

  // ─── Feed Scanning ─────────────────────────────────────────────────────────

  function isFeedPage() {
    const path = window.location.pathname;
    return path === '/' || path === '/feed/' || path.startsWith('/feed');
  }

  function scanFeed() {
    if (!isFeedPage()) return;

    for (const sel of POST_SELECTORS) {
      const posts = document.querySelectorAll(`${sel}:not([${PROCESSED_ATTR}])`);
      posts.forEach(processPost);
    }
  }

  // ─── Mutation Observer (for infinite scroll) ───────────────────────────────

  let scanTimeout = null;

  function debouncedScan() {
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scanFeed, 300);
  }

  function startObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          debouncedScan();
          break;
        }
      }
    });

    // Try to scope to the feed container for performance
    const feedContainer = document.querySelector('.scaffold-finite-scroll, [role="main"]') || document.body;
    observer.observe(feedContainer, {
      childList: true,
      subtree: true,
    });
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    setTimeout(scanFeed, 1500);
    startObserver();
    console.log('[AI Detector] LinkedIn AI Post Detector initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
