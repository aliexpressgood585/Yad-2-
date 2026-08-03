/**
 * סצנות SVG לתמונות הדמו.
 *
 * למה בכלל: הרשת של סביבת הפיתוח חוסמת הורדת תמונות, ולכן תמונות הדמו
 * מיוצרות מקומית. הגרסה הראשונה ציירה גרדיאנט עם המילה "תמונת דמו"
 * במרכז — מה שגרם לכל הלוח להיראות כאילו התמונות לא נטענו.
 *
 * כאן מצוירת סצנה מזוהה לכל נושא: צללית רכב, חדר עם ספה, מכשיר על
 * שולחן. זו עדיין איור ולא צילום, אבל היא נקראת כתמונה של מוצר ולא
 * כשגיאה — וזה ההבדל בין לוח שנראה עובד לבין לוח שנראה שבור.
 *
 * שום סצנה לא כוללת טקסט. תמונה עם מילים עליה קוראת כ-placeholder.
 */

const W = 1200;
const H = 900;

/** רקע: שמיים/קיר בגרדיאנט + רצפה, בסיס לכל הסצנות. */
function backdrop(sky, floor, floorY = 0.72) {
  return `
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect y="${H * floorY}" width="${W}" height="${H * (1 - floorY)}" fill="${floor}"/>`;
}

/** שמש/מקור אור רך, נותן עומק בלי להסיח */
function glow(cx = 0.78, cy = 0.2, r = 0.28) {
  return `<circle cx="${W * cx}" cy="${H * cy}" r="${H * r}" fill="#ffffff" opacity="0.10"/>`;
}

const SCENES = {
  /** צללית רכב בפרופיל */
  car: (c) => `
    ${backdrop(c.sky, c.floor)}
    ${glow()}
    <g transform="translate(${W * 0.12},${H * 0.34})">
      <path d="M0,300 L30,180 Q45,140 95,132 L250,112 Q300,50 400,44 L620,44
               Q700,50 760,120 L900,150 Q960,165 965,225 L968,300 Z"
            fill="${c.body}"/>
      <path d="M280,112 Q320,66 400,62 L560,62 Q620,68 668,116 Z" fill="${c.glass}"/>
      <path d="M590,62 L668,116 L760,124 Q712,70 660,62 Z" fill="${c.glass}" opacity="0.82"/>
      <rect x="0" y="286" width="968" height="24" rx="12" fill="#000000" opacity="0.18"/>
      <circle cx="200" cy="300" r="82" fill="#1b1f24"/>
      <circle cx="200" cy="300" r="40" fill="${c.rim}"/>
      <circle cx="760" cy="300" r="82" fill="#1b1f24"/>
      <circle cx="760" cy="300" r="40" fill="${c.rim}"/>
    </g>`,

  /** אופנוע — גלגלים גדולים, מסגרת משולשת */
  motorcycle: (c) => `
    ${backdrop(c.sky, c.floor)}
    ${glow(0.24, 0.22)}
    <g transform="translate(${W * 0.18},${H * 0.36})">
      <circle cx="130" cy="290" r="112" fill="none" stroke="#1b1f24" stroke-width="26"/>
      <circle cx="640" cy="290" r="112" fill="none" stroke="#1b1f24" stroke-width="26"/>
      <circle cx="130" cy="290" r="46" fill="${c.rim}"/>
      <circle cx="640" cy="290" r="46" fill="${c.rim}"/>
      <path d="M130,290 L330,150 L520,150 L640,290 L400,250 Z" fill="${c.body}"/>
      <path d="M300,150 Q380,96 500,104 L540,150 Z" fill="${c.glass}"/>
      <rect x="330" y="120" width="210" height="36" rx="18" fill="#1b1f24"/>
      <path d="M150,180 L300,140" stroke="#1b1f24" stroke-width="18" stroke-linecap="round"/>
    </g>`,

  /** חדר: חלון, קיר, רצפת פרקט */
  apartment: (c) => `
    ${backdrop(c.sky, c.floor, 0.68)}
    <rect x="${W * 0.08}" y="${H * 0.14}" width="${W * 0.34}" height="${H * 0.4}"
          rx="8" fill="${c.glass}" stroke="${c.body}" stroke-width="14"/>
    <line x1="${W * 0.25}" y1="${H * 0.14}" x2="${W * 0.25}" y2="${H * 0.54}"
          stroke="${c.body}" stroke-width="10"/>
    <rect x="${W * 0.56}" y="${H * 0.3}" width="${W * 0.3}" height="${H * 0.38}"
          rx="10" fill="${c.body}"/>
    <rect x="${W * 0.6}" y="${H * 0.36}" width="${W * 0.22}" height="${H * 0.06}"
          rx="6" fill="${c.rim}" opacity="0.5"/>
    <rect y="${H * 0.68}" width="${W}" height="10" fill="#000000" opacity="0.12"/>`,

  /** מגרש: אדמה, גבעות, עצים */
  land: (c) => `
    ${backdrop(c.sky, c.floor, 0.6)}
    ${glow(0.2, 0.18, 0.16)}
    <path d="M0,${H * 0.6} Q${W * 0.25},${H * 0.44} ${W * 0.52},${H * 0.6} T${W},${H * 0.58}
             L${W},${H} L0,${H} Z" fill="${c.body}"/>
    <g fill="${c.rim}">
      <circle cx="${W * 0.2}" cy="${H * 0.56}" r="46"/>
      <rect x="${W * 0.195}" y="${H * 0.56}" width="12" height="60"/>
      <circle cx="${W * 0.74}" cy="${H * 0.52}" r="58"/>
      <rect x="${W * 0.735}" y="${H * 0.52}" width="14" height="72"/>
    </g>`,

  /** משרד: שולחן, מסך, כיסא */
  office: (c) => `
    ${backdrop(c.sky, c.floor, 0.74)}
    <rect x="${W * 0.18}" y="${H * 0.52}" width="${W * 0.64}" height="26" rx="8" fill="${c.body}"/>
    <rect x="${W * 0.22}" y="${H * 0.57}" width="18" height="${H * 0.17}" fill="${c.body}"/>
    <rect x="${W * 0.76}" y="${H * 0.57}" width="18" height="${H * 0.17}" fill="${c.body}"/>
    <rect x="${W * 0.38}" y="${H * 0.26}" width="${W * 0.26}" height="${H * 0.19}"
          rx="10" fill="${c.glass}" stroke="#1b1f24" stroke-width="12"/>
    <rect x="${W * 0.49}" y="${H * 0.45}" width="24" height="${H * 0.07}" fill="#1b1f24"/>
    <rect x="${W * 0.44}" y="${H * 0.515}" width="${W * 0.12}" height="14" rx="7" fill="#1b1f24"/>`,

  /** ספה */
  furniture: (c) => `
    ${backdrop(c.sky, c.floor, 0.76)}
    <g transform="translate(${W * 0.16},${H * 0.3})">
      <rect x="0" y="120" width="840" height="200" rx="34" fill="${c.body}"/>
      <rect x="30" y="40" width="780" height="130" rx="30" fill="${c.rim}"/>
      <rect x="60" y="72" width="340" height="96" rx="20" fill="${c.glass}" opacity="0.5"/>
      <rect x="440" y="72" width="340" height="96" rx="20" fill="${c.glass}" opacity="0.5"/>
      <rect x="40" y="316" width="40" height="60" rx="10" fill="#1b1f24" opacity="0.6"/>
      <rect x="760" y="316" width="40" height="60" rx="10" fill="#1b1f24" opacity="0.6"/>
    </g>`,

  /** מכשיר: טלפון/טאבלט */
  electronics: (c) => `
    ${backdrop(c.sky, c.floor, 0.78)}
    ${glow(0.72, 0.26, 0.2)}
    <rect x="${W * 0.37}" y="${H * 0.16}" width="${W * 0.26}" height="${H * 0.6}"
          rx="46" fill="#1b1f24"/>
    <rect x="${W * 0.395}" y="${H * 0.2}" width="${W * 0.21}" height="${H * 0.52}"
          rx="30" fill="${c.glass}"/>
    <rect x="${W * 0.465}" y="${H * 0.185}" width="${W * 0.07}" height="14" rx="7" fill="#1b1f24"/>`,

  /** מקרר / מוצר חשמל */
  appliance: (c) => `
    ${backdrop(c.sky, c.floor, 0.8)}
    <rect x="${W * 0.36}" y="${H * 0.12}" width="${W * 0.28}" height="${H * 0.68}"
          rx="24" fill="${c.body}"/>
    <line x1="${W * 0.36}" y1="${H * 0.36}" x2="${W * 0.64}" y2="${H * 0.36}"
          stroke="${c.sky}" stroke-width="10"/>
    <rect x="${W * 0.605}" y="${H * 0.2}" width="14" height="${H * 0.12}" rx="7" fill="${c.rim}"/>
    <rect x="${W * 0.605}" y="${H * 0.42}" width="14" height="${H * 0.2}" rx="7" fill="${c.rim}"/>`,

  /** קולב עם חולצה */
  fashion: (c) => `
    ${backdrop(c.sky, c.floor, 0.82)}
    <path d="M${W * 0.5},${H * 0.16} q-14,-24 14,-30 q28,-6 28,22" fill="none"
          stroke="${c.rim}" stroke-width="12" stroke-linecap="round"/>
    <path d="M${W * 0.5},${H * 0.2} L${W * 0.33},${H * 0.34} L${W * 0.38},${H * 0.42}
             L${W * 0.42},${H * 0.38} L${W * 0.42},${H * 0.72} L${W * 0.58},${H * 0.72}
             L${W * 0.58},${H * 0.38} L${W * 0.62},${H * 0.42} L${W * 0.67},${H * 0.34} Z"
          fill="${c.body}"/>`,

  /** כדור ספורט */
  sport: (c) => `
    ${backdrop(c.sky, c.floor, 0.78)}
    ${glow(0.26, 0.22, 0.18)}
    <circle cx="${W * 0.5}" cy="${H * 0.46}" r="${H * 0.26}" fill="${c.body}"/>
    <path d="M${W * 0.5 - H * 0.26},${H * 0.46} h${H * 0.52}" stroke="${c.rim}" stroke-width="12"/>
    <ellipse cx="${W * 0.5}" cy="${H * 0.46}" rx="${H * 0.1}" ry="${H * 0.26}"
             fill="none" stroke="${c.rim}" stroke-width="12"/>
    <ellipse cx="${W * 0.5}" cy="${H * 0.74}" rx="${H * 0.2}" ry="18" fill="#000000" opacity="0.16"/>`,

  /** עגלת תינוק */
  baby: (c) => `
    ${backdrop(c.sky, c.floor, 0.78)}
    <g transform="translate(${W * 0.28},${H * 0.24})">
      <path d="M40,180 Q40,40 220,40 L360,40 L360,180 Z" fill="${c.body}"/>
      <path d="M40,180 L440,180 L400,260 L120,260 Z" fill="${c.rim}"/>
      <circle cx="150" cy="300" r="46" fill="#1b1f24"/>
      <circle cx="390" cy="300" r="46" fill="#1b1f24"/>
      <path d="M360,60 L520,150" stroke="${c.rim}" stroke-width="20" stroke-linecap="round"/>
    </g>`,

  /** מברגה / כלי עבודה */
  tools: (c) => `
    ${backdrop(c.sky, c.floor, 0.8)}
    <g transform="translate(${W * 0.3},${H * 0.3})">
      <rect x="0" y="60" width="330" height="130" rx="30" fill="${c.body}"/>
      <rect x="330" y="96" width="150" height="58" rx="16" fill="${c.rim}"/>
      <rect x="480" y="112" width="120" height="26" rx="13" fill="#1b1f24"/>
      <path d="M70,190 L110,190 L130,340 L60,340 Z" fill="${c.body}"/>
      <rect x="52" y="330" width="90" height="34" rx="12" fill="${c.rim}"/>
    </g>`,

  /** כלב */
  pet: (c) => `
    ${backdrop(c.sky, c.floor, 0.76)}
    <g transform="translate(${W * 0.32},${H * 0.3})">
      <ellipse cx="250" cy="220" rx="200" ry="110" fill="${c.body}"/>
      <circle cx="70" cy="120" r="86" fill="${c.body}"/>
      <path d="M10,60 Q-20,140 46,150 Z" fill="${c.rim}"/>
      <circle cx="46" cy="112" r="12" fill="#1b1f24"/>
      <circle cx="20" cy="140" r="16" fill="#1b1f24"/>
      <path d="M430,170 Q510,120 500,60" stroke="${c.body}" stroke-width="34"
            fill="none" stroke-linecap="round"/>
      <rect x="120" y="300" width="46" height="90" rx="20" fill="${c.body}"/>
      <rect x="320" y="300" width="46" height="90" rx="20" fill="${c.body}"/>
    </g>`,

  /** חנות: חזית עם סוכך */
  shop: (c) => `
    ${backdrop(c.sky, c.floor, 0.8)}
    <rect x="${W * 0.2}" y="${H * 0.24}" width="${W * 0.6}" height="${H * 0.56}" fill="${c.body}"/>
    <path d="M${W * 0.17},${H * 0.34} L${W * 0.83},${H * 0.34} L${W * 0.79},${H * 0.46}
             L${W * 0.21},${H * 0.46} Z" fill="${c.rim}"/>
    <rect x="${W * 0.28}" y="${H * 0.5}" width="${W * 0.16}" height="${H * 0.3}"
          rx="6" fill="${c.glass}"/>
    <rect x="${W * 0.56}" y="${H * 0.5}" width="${W * 0.16}" height="${H * 0.3}"
          rx="6" fill="${c.glass}"/>`,

  /** כלי עבודה מקצועי: פטיש + מפתח מוצלבים */
  work: (c) => `
    ${backdrop(c.sky, c.floor, 0.8)}
    <g transform="translate(${W * 0.5},${H * 0.46}) rotate(-30)">
      <rect x="-24" y="-230" width="48" height="440" rx="16" fill="${c.rim}"/>
      <rect x="-120" y="-260" width="240" height="90" rx="18" fill="${c.body}"/>
    </g>
    <g transform="translate(${W * 0.5},${H * 0.46}) rotate(38)">
      <rect x="-20" y="-210" width="40" height="400" rx="14" fill="${c.body}"/>
      <circle cx="0" cy="-220" r="62" fill="${c.body}"/>
      <circle cx="0" cy="-220" r="30" fill="${c.sky}"/>
    </g>`,
};

export function sceneFor(topic, palette, variant) {
  const draw = SCENES[topic] ?? SCENES.furniture;
  // הטיה קלה בין וריאציות כדי שרשימה לא תיראה מונוטונית
  const shift = [0, 6, -5, 11][variant % 4];
  const tilt = [0, -1.2, 1.6, -0.7][variant % 4];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.sky}"/>
      <stop offset="100%" stop-color="${palette.skyLow}"/>
    </linearGradient>
  </defs>
  <g transform="rotate(${tilt} ${W / 2} ${H / 2}) translate(${shift} ${shift / 2})">
    ${draw(palette)}
  </g>
</svg>`;
}

export const SCENE_TOPICS = Object.keys(SCENES);
