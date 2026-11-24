import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEALS_FILE = path.join(__dirname, '..', 'src', 'data', 'aliexpress_deals.json');

const ALIEXPRESS_APP_KEY = (process.env.ALIEXPRESS_APP_KEY || '').trim();
const ALIEXPRESS_APP_SECRET = (process.env.ALIEXPRESS_APP_SECRET || '').trim();
const ALIEXPRESS_TRACKING_ID = (process.env.ALIEXPRESS_TRACKING_ID || 'levtov').trim();

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest'];

const POSTS_PER_RUN = Number(process.env.ALIEXPRESS_POSTS_PER_RUN || 3);
const MIN_SALES = Number(process.env.ALIEXPRESS_MIN_SALES || 40);
const MIN_PRICE_ILS = Number(process.env.ALIEXPRESS_MIN_PRICE_ILS || 10);
const MAX_PRICE_ILS = Number(process.env.ALIEXPRESS_MAX_PRICE_ILS || 450);
const DRY_RUN = String(process.env.DRY_RUN || '0') === '1';

const SEARCH_QUERIES = [
  'motion sensor led light',
  'kitchen measuring scale',
  'magnetic cable clips organizer',
  'mini cordless car vacuum',
  'precision magnetic screwdriver set',
  'usb hub multi port high speed',
  'portable digital tire pump',
  'smart desk organizer gadget'
];

const BLOCK_PRODUCT_WORDS = [
  'sexy', 'lingerie', 'bikini', 'bra', 'underwear', 'swimsuit', 'dress',
  'women fashion', 'woman', 'girl', 'adult', 'erotic', 'vape', 'cigarette',
  'knife', 'weapon', 'gun', 'tattoo', 'wine', 'alcohol', 'beer'
];

const TRANSLATIONS = [
  {
    match: /cabinet|wardrobe|closet|sensor led lamp|motion sensor/i,
    title: '💡 תאורת לד נטענת עם חיישן תנועה חכם',
    desc: 'פס תאורה איכותי נטען ב-USB בחיבור מגנטי נוח, נדלק אוטומטית בחושך. מושלם לארונות בגדים, מסדרונות, מדרגות ומטבחים.'
  },
  {
    match: /measuring cup|spoon|scale|kitchen scale/i,
    title: '⚖️ סט כפות ומדדים מדויק למטבח ולבישול',
    desc: 'סט מדידה אלגנטי ומדויק מנירוסטה איכותית. מתאים למדידת תבלינים, קפה, אפייה ובישול בדיוק מרבי.'
  },
  {
    match: /cable clip|cord holder|cable management|organizer holder/i,
    title: '🧲 מארגן כבלים מגנטי שולחני רב-תכליתי',
    desc: 'סוף לבלגן בחוטים: תופסני כבלים מגנטיים חזקים לשולחן העבודה, מונעים מכבלי טעינה ליפול או להסתבך.'
  },
  {
    match: /vacuum|cleaner|wireless car vacuum/i,
    title: '🧹 שואב אבק אלחוטי נייד ועוצמתי לרכב ולשולחן',
    desc: 'שואב קומפקטי נטען ב-USB בעל עוצמת שאיבה גבוהה. מנקה ברגע פירורים ממקלדות, פינות ומקומות צרים ברכב.'
  },
  {
    match: /tape|waterproof|sealing|silicone/i,
    title: '🔧 סרט איטום והדבקה חזק ועמיד במים',
    desc: 'סרט איטום סיליקוני גמיש וחזק במיוחד למטבח, חדר רחצה, כיורים ופינות רטובות לשמירה על ניקיון ואיטום מושלם.'
  },
  {
    match: /screwdriver|drill|precision|tool/i,
    title: '🛠️ סט מברגי דיוק מגנטיים למכשירי חשמל וסלולר',
    desc: 'ערכת כלי עבודה קומפקטית הכוללת ראשי הברגה מגוונים מפלדת כרום. מתאימה לתיקון משקפיים, שעונים, מחשבים וטלפונים.'
  },
  {
    match: /usb hub|adapter|splitter|charger/i,
    title: '🔌 מפצל USB רב-ערוצי מהיר למחשב ולשולחן',
    desc: 'מרחיב חיבורי USB במהירות גבוהה לחיבור עכבר, מקלדת, דיסק-און-קי והתקנים שונים בו-זמנית ללא עיכובים.'
  },
  {
    match: /tire pump|inflator|air compressor/i,
    title: '🔋 משאבה חשמלית ניידת וקומפקטית לצמיגים',
    desc: 'משאבה נטענת חכמה עם תצוגה דיגיטלית ועצירה אוטומטית. מתאימה לאופניים, עגלות, כדורים ורכבים.'
  }
];

function getHebrewCopyFallback(product) {
  const t = product.product_title.toLowerCase();
  for (const item of TRANSLATIONS) {
    if (item.match.test(t)) {
      return { title: item.title, description: item.desc };
    }
  }
  return {
    title: `🔥 מוצר מבוקש: ${product.product_title.slice(0, 45)}`,
    description: 'מוצר מעולה ופופולרי באליאקספרס עם דירוג גבוה והמלצות רבות של קונים.'
  };
}

function pickRandomQueries(count = 3) {
  const copy = [...SEARCH_QUERIES];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function signAliExpressParams(params) {
  const sortedStr = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join('');
  return crypto
    .createHmac('sha256', ALIEXPRESS_APP_SECRET)
    .update(sortedStr, 'utf8')
    .digest('hex')
    .toUpperCase();
}

async function queryAliExpressProducts(keywords, pageNo = 1) {
  const params = {
    app_key: ALIEXPRESS_APP_KEY,
    method: 'aliexpress.affiliate.product.query',
    sign_method: 'sha256',
    timestamp: String(Date.now()),
    tracking_id: ALIEXPRESS_TRACKING_ID,
    keywords,
    page_no: String(pageNo),
    page_size: '20',
    sort: 'LAST_VOLUME_DESC',
    ship_to_country: 'IL',
    target_currency: 'ILS',
    target_language: 'EN'
  };
  params.sign = signAliExpressParams(params);

  const body = new URLSearchParams(params);
  const res = await fetch('https://api-sg.aliexpress.com/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    throw new Error(`AliExpress API HTTP ${res.status}`);
  }

  const data = await res.json();
  const result = data?.aliexpress_affiliate_product_query_response?.resp_result?.result;
  const products = result?.products?.product;
  return Array.isArray(products) ? products : [];
}

function parsePrice(raw) {
  const num = Number.parseFloat(String(raw || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

function isGoodProduct(p) {
  if (!p?.product_id || !p?.product_title || !p?.promotion_link || !p?.product_main_image_url) {
    return false;
  }

  const titleLower = `${p.product_title} ${p.first_level_category_name || ''} ${p.second_level_category_name || ''}`.toLowerCase();
  if (BLOCK_PRODUCT_WORDS.some((w) => titleLower.includes(w))) {
    return false;
  }

  const price = parsePrice(p.target_sale_price);
  if (price < MIN_PRICE_ILS || price > MAX_PRICE_ILS) {
    return false;
  }

  const sales = Number(p.lastest_volume || 0);
  if (sales < MIN_SALES) {
    return false;
  }

  return true;
}

async function generateHebrewCopyWithGemini(product) {
  if (!GEMINI_API_KEY) return null;

  const prompt = `אתה קופירייטר ישראלי שכותב פוסטים קצרים ומושכים לערוץ דילים נקי (מותאם לציבור דתי/חרדי, ללא שפה בוטה).
כתוב כותרת ותיאור קצר בעברית עבור המוצר הבא מאליאקספרס:
- שם מוצר באנגלית: ${product.product_title}
- מחיר: ₪${product.target_sale_price} (הנחה: ${product.discount || 'מבצע'})
- מכירות אחרונות: ${product.lastest_volume || 0}

החזר JSON בלבד בפורמט הזה (בלי טקסט נוסף ובלי markdown):
{"title": "כותרת קצרה ומושכת בעברית עם אימוג'י אחד בהתחלה (עד 8 מילים)", "description": "2-3 משפטים קצרים בעברית שמסבירים מה המוצר עושה ולמה הוא שימושי ומגניב לבית"}`;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: 'application/json'
          }
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) continue;

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed?.title && parsed?.description) {
        return {
          title: String(parsed.title).trim(),
          description: String(parsed.description).trim()
        };
      }
    } catch {
      // try next model
    }
  }
  return null;
}

function loadExistingDeals() {
  if (fs.existsSync(DEALS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DEALS_FILE, 'utf8'));
      if (Array.isArray(data)) return data;
    } catch (e) {
      console.warn('Could not parse existing deals file:', e.message);
    }
  }
  return [];
}

async function main() {
  console.log('[AliExpress Deals Automation]');

  if (!ALIEXPRESS_APP_KEY || !ALIEXPRESS_APP_SECRET) {
    console.log('Notice: Missing keys; keeping existing deals.');
    return;
  }

  const existingDeals = loadExistingDeals();
  const existingIds = new Set(existingDeals.map((d) => d.external_id || `aliexpress:${d.id}`).filter(Boolean));

  const queries = pickRandomQueries(3);
  const byId = new Map();

  for (const q of queries) {
    try {
      const items = await queryAliExpressProducts(q, 1);
      console.log(`[AliExpress] "${q}": fetched ${items.length} items`);
      for (const p of items) {
        if (isGoodProduct(p) && !byId.has(String(p.product_id))) {
          byId.set(String(p.product_id), { ...p, _query: q });
        }
      }
    } catch (err) {
      console.warn(`[AliExpress] "${q}" failed: ${err.message}`);
    }
  }

  const candidates = Array.from(byId.values())
    .filter((p) => !existingIds.has(`aliexpress:${p.product_id}`));

  console.log(`Filtered candidates: ${candidates.length}`);

  const selected = [];
  const usedQueries = new Set();
  for (const p of candidates) {
    if (selected.length >= POSTS_PER_RUN) break;
    if (usedQueries.has(p._query)) continue;
    usedQueries.add(p._query);
    selected.push(p);
  }

  if (!selected.length) {
    console.log('No new qualifying products in this run.');
    return;
  }

  const newRecords = [];
  for (const product of selected) {
    const aiCopy = (await generateHebrewCopyWithGemini(product)) || getHebrewCopyFallback(product);
    const salePrice = parsePrice(product.target_sale_price).toFixed(0);
    const origPrice = parsePrice(product.target_original_price).toFixed(0);
    const discount = product.discount || (Number(origPrice) > Number(salePrice) ? `${Math.round(((origPrice - salePrice) / origPrice) * 100)}%` : '50%');
    const ratingPct = Number.parseFloat(String(product.evaluate_rate || '95').replace('%', ''));
    const rating = (ratingPct > 10 ? (ratingPct / 20) : ratingPct).toFixed(1);
    const sales = Number(product.lastest_volume || 0);

    newRecords.push({
      id: String(product.product_id),
      external_id: `aliexpress:${product.product_id}`,
      title: aiCopy.title,
      description: aiCopy.description,
      media_url: product.product_main_image_url,
      target_sale_price: salePrice,
      target_original_price: origPrice,
      discount: discount.includes('%') ? discount : `${discount}%`,
      evaluate_rate: rating,
      lastest_volume: sales,
      promotion_link: product.promotion_link,
      created_at: new Date().toISOString()
    });
  }

  if (DRY_RUN) {
    console.log('--- DRY RUN ---');
    console.log(JSON.stringify(newRecords, null, 2));
    return;
  }

  const combined = [...newRecords, ...existingDeals].slice(0, 20);
  fs.writeFileSync(DEALS_FILE, JSON.stringify(combined, null, 2), 'utf8');
  console.log(`Successfully updated deals file with ${newRecords.length} new deal(s). Total: ${combined.length}`);
}

main().catch((err) => {
  console.error('[Error]:', err);
  process.exit(1);
});
