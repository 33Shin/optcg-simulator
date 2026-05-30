import { highlightKeywords } from './KeywordHighlighter';

const CARD_STYLE = 'width:300px;height:420px;object-fit:contain;border-radius:10px;flex-shrink:0;';
const FALLBACK_STYLE = 'width:300px;height:420px;background:#1a1a3a;border:2px solid #334466;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#cccccc;font-size:13px;padding:10px;text-align:center;word-break:break-word;flex-shrink:0;';

function cardImageSection(card) {
  if (card.imgPath) {
    return `<img src="${card.imgPath}" style="${CARD_STYLE}">`;
  }
  const name = card.name || '';
  return `<div style="${FALLBACK_STYLE}">${name}</div>`;
}

function cardAttrs(card) {
  const attrs = [];
  const catLabel = (card.category || '').charAt(0).toUpperCase() + (card.category || '').slice(1);
  if (card.category) attrs.push(`<span style="color:#88aaff;">Category:</span> ${catLabel}`);
  if (card.set) attrs.push(`<span style="color:#88aaff;">Set:</span> ${card.set}`);
  if (card.number) attrs.push(`<span style="color:#88aaff;">Number:</span> ${card.number}`);
  if (card.color) attrs.push(`<span style="color:#88aaff;">Color:</span> ${card.color}`);
  if (card.attribute) attrs.push(`<span style="color:#88aaff;">Attribute:</span> ${card.attribute}`);
  if (card.rarity) attrs.push(`<span style="color:#88aaff;">Rarity:</span> ${card.rarity}`);
  if (card.type) attrs.push(`<span style="color:#88aaff;">Type:</span> ${card.type}`);
  return attrs;
}

function cardStats(card) {
  const stats = [];
  if (card.cost !== null && card.cost !== undefined) stats.push(`<span style="color:#88aaff;">Cost:</span> ${card.cost}`);
  if (card.power !== null && card.power !== undefined) stats.push(`<span style="color:#ffd700;">Power:</span> ${card.power}`);
  if (card.counter !== null && card.counter !== undefined) stats.push(`<span style="color:#ff8844;">Counter:</span> ${card.counter}`);
  if (card.life !== null && card.life !== undefined) stats.push(`<span style="color:#44ff88;">Life:</span> ${card.life}`);
  return stats;
}

function effectBlocks(card) {
  let html = '';
  if (card.effect) {
    const highlighted = highlightKeywords(card.effect.replace(/\n/g, '<br>'));
    html += `<div style="margin-top:16px;padding:12px;background:#f3f2de;border-radius:8px;color:#000000;line-height:1.6;font-family:'Inter',sans-serif;font-size:14px;">
      ${highlighted}
    </div>`;
  }
  if (card.trigger) {
    const highlighted = highlightKeywords(card.trigger.replace(/\n/g, '<br>'));
    html += `<div style="margin-top:12px;padding:12px;background:#0f0400;border-radius:8px;color:#ffffff;line-height:1.6;font-family:'Inter',sans-serif;font-size:14px;">
      ${highlighted}
    </div>`;
  }
  return html;
}

export function buildCardInfoHtml(card, playButtonHtml = '') {
  const attrs = cardAttrs(card);
  const stats = cardStats(card);
  const effectBlock = effectBlocks(card);

  return `
    <div style="padding:24px 16px;color:#aabbdd;font-family:'Inter',sans-serif;">
      <div style="display:flex;gap:20px;align-items:flex-start;">
        ${cardImageSection(card)}
        <div style="min-width:180px;">
          <h2 style="color:#ffffff;margin:0 0 12px;font-size:20px;font-weight:500;">${card.name || ''}</h2>
          <div style="line-height:1.8;font-size:13px;">
            ${attrs.map(a => `<p style="margin:6px 0;">${a}</p>`).join('')}
            ${stats.map(s => `<p style="margin:6px 0;">${s}</p>`).join('')}
          </div>
        </div>
      </div>
      ${effectBlock}
      ${playButtonHtml}
    </div>
  `;
}

export function buildPlayButtonHtml(canPlay, state, card, getFieldCount, canPay, pid) {
  if (pid !== 1 && (card.category !== 'character' && card.category !== 'event' && card.category !== 'stage')) {
    return '';
  }

  const checkPlay = () => {
    if (state.phaseLocked || state.currentPhase !== 'main') return false;
    if (pid !== 1) return false;
    if (card.category === 'character') {
      if (getFieldCount(pid) >= 5) return false;
      return canPay(pid, card.cost || 0);
    }
    if (card.category === 'event' || card.category === 'stage') {
      return canPay(pid, card.cost || 0);
    }
    return false;
  };

  const ok = checkPlay();
  let btnText = 'Play';
  if (!ok) {
    if (state.phaseLocked) btnText = 'Phase Locked';
    else if (state.currentPhase !== 'main') btnText = 'Not Main Phase';
    else if (card.category === 'character' && getFieldCount(pid) >= 5) btnText = 'Field Full';
    else btnText = 'Not Enough DON!!';
  }

  const btnStyle = ok
    ? 'background:#4CAF50;color:#fff;cursor:pointer;'
    : 'background:#444;color:#888;cursor:not-allowed;';

  return `<button id="play-card-btn" style="margin-top:16px;padding:10px 20px;border:none;border-radius:8px;font-weight:bold;font-size:14px;font-family:'Inter',sans-serif;width:100%;${btnStyle}" ${!ok ? 'disabled' : ''}>${btnText}</button>`;
}
