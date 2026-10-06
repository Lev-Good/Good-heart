# הוראות פיתוח ו-SEO עבור סוכני AI — "לב טוב דיגיטל"
## AI Agent Development & SEO Guide for `digital.levtov.uk`

מסמך זה מיועד לסוכני AI (ומפתחים) המבצעים שינויים, שדרוגים או הוספת פרויקטים חדשים באתר "לב טוב דיגיטל" (`Good-heart`).
**חובה לקרוא מסמך זה לפני ביצוע שינויים בקטלוג הפרויקטים או במבנה האתר!**

---

### 1. מבנה האתר וארכיטקטורת ה-SEO (קידום אורגני)

האתר בנוי בארכיטקטורה היברידית המשלבת:
1. **עמוד בית מודרני (`index.html`):** לוח בנטו (Bento Grid) אינטראקטיבי, סינון לפי קטגוריות, חיפוש, סטטיסטיקות ואנימציות.
   * **שימו לב:** כרטיסי הפרויקטים בעמוד הבית מוזרקים גם בקוד HTML סטטי (Pre-rendered) כדי שרובוטי החיפוש של Google יוכלו לסרוק את כל הפרויקטים והקישורים מיד ללא צורך בהרצת JavaScript!
2. **דפי נחיתה ייעודיים לכל פרויקט (`/p/[id].html`):**
   * לכל פרויקט בקטלוג קיים עמוד HTML סטטי מלא בתיקיית `p/`.
   * העמוד כולל מטא-תגיות SEO מלאות (`<title>`, `<meta description>`, OpenGraph, Twitter Card).
   * נתונים מובנים של גוגל (`Schema.org / JSON-LD`) מסוג `SoftwareApplication` / `WebApplication` ו-`BreadcrumbList`.
   * תיאור מלא, מדריך הפעלה, קישורי הורדה, וכרטיסי פרויקטים קשורים (Internal Linking).
3. **דפי תוכנות ואתרים קיימים ועצמאיים:**
   * `work-clock.html` — דף נחיתה מלא עבור תוכנת "זמן עבודה ונוכחות".
   * `taharah/` — מערך דפים עצמאי עבור "לוח טהרה".
   * פרויקטים בעלי אתר עצמאי (כגון `Between-times-site`, `goodmusic`, `the-editor.levtov.uk` וכו') — עמוד הנחיתה ב-`/p/` משמש עבורם כשגריר רשמי המקשר ישירות לאתר המלא.
4. **מפת אתר (`sitemap.xml`):** מרכזת את כל הכתובות עם עדיפויות ותדירות עדכון.

---

### 2. פרוטוקול שלב-אחר-שלב: איך להוסיף פרויקט חדש לאתר?

כאשר מתבקשים להוסיף פרויקט חדש (למשל פרויקט מס' 34), **חובה לבצע את כל 5 השלבים הבאים בסדר המדויק**:

#### שלב 1: הוספת הפרויקט לקובץ הנתונים (`src/data/projects.js`)
הוסיפו אובייקט חדש למערך `projects` בקובץ `src/data/projects.js`:
```javascript
{
  "id": "my-new-project",                      // מזהה ייחודי באנגלית (kebab-case)
  "title": "שם הפרויקט",                        // שם מדויק וברור
  "subtitle": "כותרת משנה קצרה ומושכת",        // 5-10 מילים
  "category": "desktop",                       // אחת מ: "desktop" | "web" | "ext" | "auto"
  "icon": "fa-solid fa-star",                  // אייקון מ-FontAwesome 6
  "colorClass": "bl",                          // צבע: bl, am, rd, or, ye, gn, cy, li, te, in, pu
  "description": "תיאור מפורט ועשיר...",       // פסקה של 3-5 שורות המכילה מילות מפתח אורגניות
  "guide": "<ul><li><strong>שלב 1:</strong> ...</li></ul>", // מדריך הפעלה ב-HTML
  "links": [                                   // קישורים: ראשון primary, שאר secondary
    {
      "text": "הורדה ישירה <i class=\"fa-solid fa-download\"></i>",
      "url": "https://...",
      "className": "btn-primary"
    },
    {
      "text": "לפוסט במתמחים טופ <i class=\"fa-solid fa-up-right-from-square\"></i>",
      "url": "https://...",
      "className": "btn-secondary"
    }
  ]
}
```

#### שלב 2: יצירת דף הנחיתה הייעודי ב-`p/`
הריצו את מחולל דפי הנחיתה האוטומטי:
```bash
node scripts/generate_seo_pages.js
```
הסקריפט ייצור או יעדכן אוטומטית את קובץ `p/[id].html` עם תגיות Meta, נתוני Schema, כפתורים, מדריך וקישורים לפרויקטים קשורים.

#### שלב 3: הזרקת כרטיסי ה-HTML הסטטיים לעמוד הבית (`index.html`)
הריצו את מחולל כרטיסי הבנטו:
```bash
node scripts/inject_static_bento.js
```
זה מוודא שכרטיס הפרויקט החדש יהיה קיים ישירות ב-HTML שגוגל רואה, כולל קישור ישיר ל-`./p/[id].html`.

#### שלב 4: עדכון מפת האתר (`sitemap.xml`)
הריצו את מחולל מפת האתר:
```bash
node scripts/generate_sitemap.js
```
זה יוסיף את הכתובת `https://digital.levtov.uk/p/[id].html` עם עדיפות `0.8` למפת האתר שנסרקת ע"י Google Search Console.

#### שלב 5: עדכון מונה הסטטיסטיקות ו-Cache Buster
1. ב-`index.html`: עדכנו את `data-count` באזור הסטטיסטיקות (`#stats`) למספר הפרויקטים הכולל העדכני.
2. עדכנו את גרסת המטמון (`?v=X.X.X`) בייבוא הקבצים:
   - ב-`index.html`: `<script type="module" src="./src/js/main.js?v=X.X.X"></script>`
   - ב-`src/js/main.js`: `import { projects, categories, stats } from '../data/projects.js?v=X.X.X';`

---

### 3. עקרונות ברזל לשימור הקיים
* **אין למחוק או לשנות** את עמודי התוכנות הקיימים: `work-clock.html`, `work-clock-privacy.html`, `work-clock-terms.html` ותיקיית `taharah/`.
* **אין לפגוע בקובץ האימות של גוגל:** `google2d9a040cebc3b6fe.html` וקובץ ה-`CNAME` (`digital.levtov.uk`).
* **סנכרון תמידי לפני עבודה ודחיפה:** תמיד לבצע `git pull origin main` לפני שינויים, ולבצע `git push origin main` בסיום כדי שהאתר יתעדכן ב-GitHub Pages.
