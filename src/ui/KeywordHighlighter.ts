const TIMING_KEYWORDS = {
  'ON PLAY': '#0273A2',
  'ON K.O.': '#0273A2',
  'WHEN ATTACKING': '#0273A2',
  'MAIN': '#0273A2',
  'YOUR TURN': '#0273A2',
  "OPPONENT'S TURN": '#0273A2',
  'OPPONENT TURN': '#0273A2',
  'ON YOUR OPPONENTS ATTACK': '#0273A2',
  'ON YOUR OPPONENTS NEXT ATTACK': '#0273A2',
  'ACTIVATE': '#0273A2',
  'END OF YOUR TURN': '#0273A2',
};

const RESTRICTION_KEYWORDS = {
  'COUNTER': '#D74063',
  'ONCE PER TURN': '#D74063',
};

const COST_KEYWORDS = {
  'DON': '#1C0F0D',
};

const TRIGGER_KEYWORDS = {
  'TRIGGER': '#F9E92B',
};

const SPECIAL_KEYWORDS = {
  'BLOCKER': '#EB7624',
  'RUSH': '#EB7624',
  'BANISH': '#EB7624',
  'DOUBLE ATTACK': '#EB7624',
};

const ALL_KEYWORDS = {
  ...COST_KEYWORDS,
  ...TRIGGER_KEYWORDS,
  ...SPECIAL_KEYWORDS,
  ...RESTRICTION_KEYWORDS,
  ...TIMING_KEYWORDS,
};

export function keywordColor(keyword) {
  const key = keyword.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
  for (const [kw, color] of Object.entries(ALL_KEYWORDS)) {
    if (key.includes(kw)) return color;
  }
  return '#FF69B4';
}

export function highlightKeywordsSegment(text) {
  return text.replace(/\[([^\]]+)\]/g, (match, inner) => {
    const upper = inner.toUpperCase();
    const bgColor = keywordColor(inner);
    const textColor = upper.includes('TRIGGER') ? '#000000' : '#ffffff';
    return `<span style="background:${bgColor};color:${textColor};padding:2px 8px;border-radius:4px;font-size:14px;font-family:'Inter',sans-serif;">${inner}</span>`;
  });
}

export function boldNonKeywords(text) {
  const highlighted = highlightKeywordsSegment(text);
  const parts = highlighted.split(/(<span[^>]*>.*?<\/span>)/g);
  return parts.map((part) => {
    if (part.startsWith('<span')) return part;
    return part ? `<b>${part}</b>` : '';
  }).join('');
}

export function highlightKeywords(text) {
  const lines = text.split('<br>');
  const processed = lines.map((line) => {
    const colonIdx = line.indexOf(':');
    let result = highlightKeywordsSegment(line);
    if (colonIdx !== -1) {
      const costText = line.substring(0, colonIdx + 1);
      const effectText = line.substring(colonIdx + 1);
      const costHtml = boldNonKeywords(costText);
      const effectHtml = highlightKeywordsSegment(effectText);
      return costHtml + effectHtml;
    }
    return result;
  });
  return processed.join('<br>');
}
