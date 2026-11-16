# Design Doc: אתר פורטפוליו אישי – שחר אשר

> **סטטוס:** ההחלטות סגורות, מוכן לפיתוח · **גרסה:** 0.2 · **תאריך:** אוקטובר 2026
> **מטרת המסמך:** לרכז את כל ההחלטות שהתקבלו, את הנימוקים ואת האפשרויות שנשקלו, כבסיס לפיתוח עם Claude Code.

---

## תוכן עניינים

0. [סיכום החלטות](#0-סיכום-החלטות)
1. [מטרות וקהל יעד](#1-מטרות-וקהל-יעד)
2. [עקרונות מנחים](#2-עקרונות-מנחים)
3. [Tech Stack](#3-tech-stack)
4. [מבנה האתר (Sitemap)](#4-מבנה-האתר-sitemap)
5. [תוכן לפי דף](#5-תוכן-לפי-דף)
6. [פרויקטים דינמיים מ-GitHub](#6-פרויקטים-דינמיים-מ-github)
7. [קורות חיים: Single Source of Truth](#7-קורות-חיים-single-source-of-truth)
8. [יצירת קשר](#8-יצירת-קשר)
9. [עיצוב ויזואלי](#9-עיצוב-ויזואלי)
10. [אנימציות וגרפיקה](#10-אנימציות-וגרפיקה)
11. [ביצועים, נגישות ו-SEO](#11-ביצועים-נגישות-ו-seo)
12. [פרטיות, אבטחה וסודיות](#12-פרטיות-אבטחה-וסודיות)
13. [אחסון, דומיין ו-CI/CD](#13-אחסון-דומיין-ו-cicd)
14. [מבנה הפרויקט](#14-מבנה-הפרויקט)
15. [Analytics](#15-analytics)
16. [Roadmap לפי שלבים](#16-roadmap-לפי-שלבים)
17. [עבודה עם Claude Code](#17-עבודה-עם-claude-code)
18. [Backlog: רעיונות לעתיד](#18-backlog-רעיונות-לעתיד)

---

## 0. סיכום החלטות

| # | נושא | ההחלטה | פירוט |
|---|---|---|---|
| 1 | Framework | **Astro** + TypeScript + Tailwind, עם React islands | [§3](#3-tech-stack) |
| 2 | אחסון | **Cloudflare** (חינם). הבנייה רצה ב-GitHub Actions | [§13](#13-אחסון-דומיין-ו-cicd) |
| 3 | דומיין | **נחליט בסוף העבודה.** רכישה דרך Cloudflare Registrar | [§13](#13-אחסון-דומיין-ו-cicd) |
| 4 | צבע accent | **כחול קבוע** `#4F9DFF` | [§9](#9-עיצוב-ויזואלי) |
| 5 | ערכת צבעים | **לפי הגדרת המערכת** בכניסה ראשונה + מתג Dark/Light (הבחירה נשמרת וגוברת) | [§9](#9-עיצוב-ויזואלי) |
| 6 | קורות חיים | **`resume.yaml` כמקור יחיד** → Word + PDF (בעיצוב הנוכחי) + עמוד `/resume` | [§7](#7-קורות-חיים-single-source-of-truth) |
| 7 | טלפון | **רק ב-Word/PDF**, לא באתר | [§12](#12-פרטיות-אבטחה-וסודיות) |
| 8 | יצירת קשר | **השקה:** מייל + Copy, LinkedIn, GitHub. **שלב 2:** טופס עם פונקציה משלך | [§8](#8-יצירת-קשר) |
| 9 | בלוג | **לא כרגע** | [§18](#18-backlog-רעיונות-לעתיד) |
| 10 | דיאגרמת ארכיטקטורה | **סטטית** בעמוד הפרויקט. גרסה מונפשת: אולי בהמשך | [§18](#18-backlog-רעיונות-לעתיד) |
| 11 | פרויקטים | **דינמיים מ-GitHub** בזמן build, סינון לפי Topics | [§6](#6-פרויקטים-דינמיים-מ-github) |
| — | שפה | **אנגלית בלבד** | — |

---

## 1. מטרות וקהל יעד

### מטרה עיקרית
להביא לשיחות עם חברות למשרות **Backend / Software Engineer**, על ידי הצגת ניסיון אמיתי במערכות real-time בהיקפים גבוהים ויכולת חשיבה מערכתית.

### קהל יעד (לפי סדר חשיבות)

| קהל | כמה זמן ישקיע | מה הוא מחפש | מה האתר צריך לתת לו |
|---|---|---|---|
| **מגייס/ת** | 20–60 שניות | התאמה כללית, ניסיון, טכנולוגיות | Hero ברור, Experience סרוק, כפתור קורות חיים בולט |
| **Hiring Manager / ראש צוות** | 2–5 דקות | עומק טכני, איך אתה חושב | עמודי פרויקטים, דיאגרמות, החלטות ו-trade-offs |
| **מראיין טכני** | 5–15 דקות (לפני ראיון) | נושאים לשאול עליהם | עמודי עומק שנותנים "חומר לשיחה" |

### מדדי הצלחה
- מגייס מבין תוך 10 שניות מי אתה, מה אתה עושה, ואיך להוריד קורות חיים.
- לפחות פרויקט אחד שמראה עומק ארכיטקטוני מעבר ל-CRUD.
- Lighthouse 95+ בכל הקטגוריות.
- האתר נטען מהר גם בנייד.

### Non-goals
- לא תצוגת יכולות עיצוב גרפי.
- לא אפליקציה עם משתמשים או התחברות.
- לא אתר דו-לשוני.

---

## 2. עקרונות מנחים

1. **Content first.** התוכן הוא המוצר, והעיצוב משרת אותו.
2. **Show, don't tell.** במקום "Experienced with Kafka", דיאגרמה שמראה איך השתמשת בו ולמה.
3. **Fast by default.** אתה בא מעולם של latency במילישניות. אתר איטי פוגע באמינות שלך.
4. **Minimal motion with purpose.** כל אנימציה צריכה להסביר משהו או לשפר את תחושת השימוש.
5. **Single source of truth.** כל פיסת מידע נשמרת במקום אחד בלבד: קורות החיים ב-`resume.yaml`, הפרויקטים ב-GitHub. (וזה גם רפרנס טבעי למיגרציה שהובלת ב-Taboola.)
6. **Easy to maintain.** עדכון קורות חיים = עריכת YAML. פרויקט חדש = הפיכת ריפו לציבורי והוספת topic.

---

## 3. Tech Stack

### 3.1 ההחלטה

| שכבה | בחירה | נימוק |
|---|---|---|
| Framework | **Astro** | אתר תוכן סטטי ומהיר, אפס JS כברירת מחדל, MDX מובנה |
| שפה | **TypeScript** | type safety לנתונים (schema ל-YAML ולנתוני GitHub) |
| עיצוב | **Tailwind CSS** | מהיר לפיתוח, עקבי, Claude Code שולט בו היטב |
| Interactive islands | **React** | רק לאינטראקציה מורכבת (טופס יצירת קשר). אינטראקציות פשוטות (מתג Theme, כנראה גם כפתור Copy) הן רכיבי Astro עם סקריפט קטן: React היה מוסיף 45–60KB של JS לכל עמוד בשביל כפתור אחד, ושובר את יעד ה-30KB |
| אנימציות | **CSS**, ו-Motion רק אם יידרש | ראה [§10](#10-אנימציות-וגרפיקה) |
| תוכן | **YAML** (קורות חיים) + **MDX** (עמודי עומק) + **GitHub API** (כרטיסי פרויקטים) | |
| אחסון | **Cloudflare** | ראה [§13](#13-אחסון-דומיין-ו-cicd) |
| CI/CD | **GitHub Actions** | נדרש בגלל יצירת ה-PDF ([§7](#7-קורות-חיים-single-source-of-truth)) |

### 3.2 אפשרויות שנשקלו ונדחו
- **Next.js:** מראה React, אבל overkill לאתר תוכן סטטי. יותר JS, יותר מורכבות.
- **HTML/CSS/JS נקי:** פשוט, אבל לא מתאים לתוכן דינמי (GitHub, YAML).
- **Spring Boot:** "Java גם באתר", אבל דורש שרת בתשלום ומראיין מנוסה יזהה over-engineering. ה-Java מוצג דרך הפרויקטים, לא דרך האתר.

---

## 4. מבנה האתר (Sitemap)

```
/                               → דף בית (גולל, 5 סקשנים)
├── /projects/[repo-name]       → עמוד עומק לפרויקט (רק לפרויקטים שיש להם MDX)
├── /case-studies/table-migration → Case study: מיגרציית טבלת publishers
├── /resume                     → קורות חיים כ-HTML + כפתור הורדת PDF
├── /resume.pdf                 → הקובץ להורדה (כתובת קבועה)
└── /404                        → דף שגיאה מעוצב, ומתחתיו משחק קטן (F.3)
```

**ניווט עליון:** `Experience · Projects · Resume · Contact` + מתג Dark/Light. משמאל: השם (מ-`resume.yaml`) כקישור ל-`/`, בצבע מושתק כמו שאר ה-chrome. הוא מוצג מ-640px (`sm`) ומעלה. ברוחב טלפון אין לו מקום בשורה, והעמוד עצמו מתחיל בשם. לכן ב-`/resume` נשאר הקישור "← Back to home".

**למה דף בית גולל + עמודי עומק?** מגייס רואה הכל בגלילה אחת בלי ללחוץ, ומי שרוצה עומק נכנס לעמוד הייעודי. דפים נפרדים כמו "About" ו-"Skills" בדרך כלל יוצאים רדודים.

---

## 5. תוכן לפי דף

### 5.1 דף הבית

#### Hero
- **שם:** Shahar Asher
- **כותרת:** Software Engineer, Backend & Distributed Systems (מ-`basics.label` ב-`resume.yaml`; `create_cv.js` לא משתמש בשדה הזה, אז ה-PDF לא משתנה)
- **משפט אחד:** מ-`basics.tagline` ב-`resume.yaml`, שדה חובה ב-schema: שורה אחת שנכתבת ידנית (המשפט הראשון של `summary` מתחיל ב-"Software Engineer" וחוזר על הכותרת). לא מופיע ב-PDF.
- **CTAs:** `Download Resume` (ראשי, כחול) · `View Projects` (משני) · אייקוני GitHub / LinkedIn / Email
- **ויזואל:** רקע עדין בשתי שכבות נפרדות, בלי תמונה ענקית, ושום דבר מתחת לתוכן שפוגע בניגודיות: נקודות (`--hero-dot`) בשני המצבים, רק בשוליים בדסקטופ, משני צידי עמודת הטקסט (ברוחב 720px ומטה הן לא מופיעות), וזוהר רך בצבע ה-accent (`--hero-glow`) מאחורי הכותרת, במצב כהה בלבד. כל הטקסט עומד ב-4.5:1 גם בנקודה החזקה של הזוהר.
- **למה בלי זוהר במצב בהיר:** שורת התפקיד בצבע accent מגבילה אותו ל-3.5% (4.52:1, ממש על הגבול), ובעוצמה הזו הוא כמעט לא נראה ומשאיר קצה אליפסה אפור וחיוור.
- **למה לא נקודות מתחת לטקסט:** נוסו ברדיוס 1px, 1.5px ו-2px. נקודה שרואים אותה מורידה את הטקסט מתחת ל-AA (accent במצב בהיר: 3.59:1 כבר בעוצמה של 20%), ורקע אחיד מאחורי השורות חתך את הנקודות לקו מקווקו.

#### Experience
- **נבנה מ-`resume.yaml`**, כך שאין כפילות עם קורות החיים.
- כרטיס ל-Taboola. בדף הבית מוצגות 3–4 הנקודות החזקות (מסומנות `featured: true` ב-YAML), ויש קישור לקורות החיים המלאים.
- קישור "Read the migration case study →".
- מבנה timeline, כדי שיהיה מקום לתפקידים עתידיים.
- תפקיד בלי נקודות `featured` עדיין מוצג (חברה, תפקיד ותאריכים בלבד), כדי שלא יהיה חור ב-timeline.

#### Projects
- **נבנה מ-GitHub** ([§6](#6-פרויקטים-דינמיים-מ-github)).
- Featured ראשון, אחריו הכותרת More projects, ובסוף שורת Algorithm practice. כל הכרטיסים בעמודה אחת וברוחב מלא.

#### Skills
- **נבנה מ-`resume.yaml`**.
- מקובץ לפי קטגוריות, כמו בקורות החיים. **בלי** progress bars או אחוזים.
- בדף הבית: כרטיס אחד לכל הסקשן, באותו עיצוב כמו כרטיסי Experience, כדי שייראה חלק מאותו אתר כמו Experience, Projects ו-Contact. בתוכו כל קטגוריה מוצגת בערימה: השם מעל ה-chips, בכל רוחב (בלי עמודת תוויות בצד).
- ה-chips הם chip הטכנולוגיה המשותף (`TechChip`), זהה ל-chip השפה בכרטיסי הפרויקטים ([§9.4](#94-layout)).
- בעמוד `/resume` הסקשן נשאר בפריסה שלו (בלי כרטיס, שם הקטגוריה משמאל ל-chips מרוחב `sm` ומעלה, chips גדולים יותר), עם שורת Spoken Languages בסוף.

#### Contact
- ראה [§8](#8-יצירת-קשר).

#### Footer
- © שנה (שנת הבנייה) ושם · קישורי GitHub ו-LinkedIn מ-`basics.profiles` עם האייקונים המשותפים · קישור "Back to top" (בלי JS; מעביר גם את פוקוס המקלדת לראש העמוד; רק בעמודים ארוכים מספיק לגלילה, ולכן לא בעמוד 404).
- מופיע בכל עמוד דרך `BaseLayout`. בלי אימייל: קישורי האימייל עובדים רק בעמודים שכוללים את `CopyEmail`.

### 5.2 תבנית לעמוד עומק של פרויקט

עמוד עומק נוצר רק לפרויקט שיש לו קובץ `src/content/projects/<repo-name>.mdx`. הנתונים הבסיסיים (שם, שפות, כוכבים, קישורים) מגיעים מ-GitHub, והסיפור מה-MDX.

1. **TL;DR**: מה זה, ב-2–3 שורות
2. **The problem**: למה לבנות את זה, מה האתגר
3. **Architecture**: דיאגרמה סטטית (SVG)
4. **Key decisions & trade-offs**
5. **What I'd do differently / Next steps**
6. **Tech stack** · **GitHub link**

**Log Analytics Platform (הראשון שייכתב):**
- למה Kafka (מול RabbitMQ או כתיבה ישירה ל-DB)
- למה partitioning לפי service (ordering לכל service מול סיכון ל-hot partitions)
- At-least-once: איך מטפלים בכפילויות (idempotency)
- קישור ל-ADRs בריפו

**Scam Reporting App:** כרטיס בלבד בשלב הראשון. אם תרצה עמוד, הנקודות המעניינות הן Spring Security עם הרשאות לפי תפקיד ו-WebSocket לעדכונים בזמן אמת. לציין **"Team project · 2 developers"**.

### 5.3 Case study: מיגרציית טבלת Publishers

1. **Context**: טבלה מרכזית שמנוהלת בכמה מקומות, בעיות עקביות
2. **Goal**: single source of truth ל-6+ subsystems, בלי downtime
3. **Strategy**: backfill, cache חדש, feature flags לכל subsystem, rollout הדרגתי
4. **Risk management**: איך וידאת נכונות לפני כל מעבר
5. **Outcome**: zero incidents, zero rollbacks
6. **Lessons learned**

> ⚠️ **ברמה קונספטואלית בלבד.** בלי שמות טבלאות, שמות שירותים פנימיים, מספרים עסקיים או קוד. ראה [§12](#12-פרטיות-אבטחה-וסודיות).

---

## 6. פרויקטים דינמיים מ-GitHub

### 6.1 ההחלטה
הפרויקטים נמשכים מ-GitHub אוטומטית. פרויקט חדש מופיע באתר ברגע שהריפו ציבורי ומתויג. אין צורך לגעת בקוד האתר.

### 6.2 מתי מושכים: בזמן ה-build, לא בדפדפן

| | בזמן build ✅ | בדפדפן של המבקר ❌ |
|---|---|---|
| מהירות | הנתונים כבר בתוך הדף | הדף נטען, ואז הכרטיסים "קופצים" |
| מגבלות GitHub | בקשה אחת לכל build, עם token | 60 בקשות לשעה לכל IP, בלי token |
| אמינות | אם GitHub לא זמין, ה-build נכשל והאתר הישן נשאר | אם GitHub לא זמין, סקשן ריק |
| SEO | Google רואה את הפרויקטים | Google עלול לא לראות |

**עדכון אוטומטי:** GitHub Action מתוזמן בונה את האתר מחדש **פעם ביום**. כלומר, פרויקט חדש מופיע תוך יום לכל היותר. לעדכון מיידי: הרצה ידנית של ה-workflow ב-GitHub (כפתור "Run workflow").

### 6.3 סינון לפי GitHub Topics

| Topic בריפו | איפה הוא מופיע |
|---|---|
| `portfolio-featured` | הכרטיס הראשון בסקשן Projects (כל הכרטיסים באותו רוחב) |
| `portfolio` | כרטיס רגיל ב-More projects |
| `portfolio-practice` | שורת "Algorithm practice" (קישורים בלבד) |
| בלי אף אחד מאלה | לא מופיע באתר |

**סדר בתוך כל קבוצה:** לפי תאריך העדכון האחרון (`pushed_at`), החדש ראשון.
**לא נכללים אף פעם:** forks וריפוזיטוריז ב-archive, גם אם תויגו.

### 6.4 מה נמשך מ-GitHub

| שדה | מקור ב-GitHub | שימוש באתר |
|---|---|---|
| שם | `name` | כותרת הכרטיס (מעוצב: `log-analytics-platform` → "Log Analytics Platform") |
| תיאור | `description` | שורת התיאור בכרטיס |
| שפות | `languages` | תגיות טכנולוגיה |
| Topics | `topics` | סינון + תגיות נוספות (בלי ה-topics של `portfolio-*`) |
| כוכבים | `stargazers_count` | מוצג רק אם > 0 |
| עדכון אחרון | `pushed_at` | מיון + "Updated Oct 2026" |
| קישור | `html_url` | קישור "GitHub" (עם אייקון GitHub) |
| Demo | `homepage` | קישור "Live demo" (עם האייקון המשותף `ArrowUpRightIcon`), אם הוגדר Website בריפו |

**חיבור לעמוד עומק:** אם קיים `src/content/projects/<repo-name>.mdx`, הכרטיס מקבל קישור "Read more →" לעמוד הפנימי. ב-MDX אפשר גם לדרוס שדות (למשל `status: In progress`, `team: 2 developers`, תיאור ארוך יותר). `status` ו-`team` מוצגים בכרטיס בשורה קטנה מתחת לכותרת.

**Topics בכרטיס:** topic שרק חוזר על שפה (למשל `java` ליד Java, בלי תלות באותיות גדולות/קטנות) לא מוצג פעמיים.

**קישורים מול תגיות:** הקישורים בכרטיס הם קישורי טקסט בצבע ה-accent (כי accent = לחיץ). תגיות השפה הן outline ותגיות ה-topics עם רקע `--border`, ואף אחת מהן לא בצבע accent.

### 6.5 מצב הריפוזיטוריז היום והמיפוי המוצע

| ריפו | תיאור ב-GitHub | Topic מוצע |
|---|---|---|
| log-analytics-platform | ✅ קיים | `portfolio-featured` |
| scam-reporting-app | ✅ קיים | `portfolio` |
| diff-checker | ✅ קיים | `portfolio` |
| Cryptography_modules | ✅ קיים | `portfolio` (אופציונלי) |
| LeetCode | ✅ קיים | `portfolio-practice` |
| NeetCode | ✅ קיים | `portfolio-practice` |
| project_euler | ✅ קיים | `portfolio-practice` |

### 6.6 בדיקות ב-build
- ריפו עם `portfolio-featured` או `portfolio` **בלי תיאור** → ה-build נכשל עם הודעה ברורה. כך לא יעלה כרטיס ריק.
- ה-API לא זמין → ה-build נכשל, והאתר הקיים נשאר באוויר.

---

## 7. קורות חיים: Single Source of Truth

### 7.1 המצב היום
קורות החיים נוצרים בשיחה ב-claude.ai, על ידי סקריפט `create_cv.js` (ספריית `docx`) שמייצר קובץ Word, וממנו PDF. **התוכן והעיצוב נמצאים יחד באותו סקריפט**, ולכן כל עדכון בשיחה חדשה כותב מחדש גם את העיצוב.

### 7.2 ההחלטה
מפרידים בין תוכן לעיצוב:

```
src/data/resume.yaml          ← התוכן, ורק כאן
   │
   ├──▶ scripts/cv/create_cv.js  (העיצוב הנוכחי, ללא שינוי)
   │       └──▶ Shahar_Asher_CV.docx
   │               └──▶ LibreOffice ──▶ Shahar_Asher_CV.pdf  → /resume.pdf
   │
   └──▶ Astro
           ├──▶ עמוד /resume  (בעיצוב האתר, Dark/Light, מותאם לנייד)
           └──▶ סקשני Experience ו-Skills בדף הבית
```

- **קורות החיים נשארים בדיוק כמו היום:** אותו סקריפט, אותם גופנים, צבעים ומרווחים. רק הטקסט עובר ל-YAML.
- **הכל נוצר יחד בכל build**, ולכן Word, PDF והאתר תמיד מאותה גרסה.

### 7.3 שיטת העבודה החדשה
במקום שיחה ב-claude.ai, העדכונים נעשים ב-Claude Code בתוך הריפו:
> "תוסיף לקורות החיים נקודה על Spring Security בפרויקט Scam Reporting"

Claude Code מעדכן את `resume.yaml`, אתה רואה את ה-diff, מאשר ועושה push. ה-build מייצר הכל מחדש.

### 7.4 מבנה `resume.yaml` (טיוטה)

```yaml
basics:
  name: Shahar Asher
  label: Software Engineer, Backend & Distributed Systems
  email: <email from resume.yaml>
  # אין שדה phone: הריפו ציבורי. הטלפון מגיע רק ממשתנה הסביבה CV_PHONE
  # (.env מקומית, secret ב-CI), ומופיע רק ב-Word/PDF. ה-schema דוחה שדה phone.
  location: Israel
  summary: >
    Software Engineer with production experience on real-time,
    high-throughput ad-tech systems at Taboola...
  # שורה אחת ל-Hero באתר (שדה חובה, לא מופיע ב-PDF)
  tagline: >-
    Production experience on real-time, high-throughput ad-tech systems at Taboola; ...
  profiles:
    - network: LinkedIn
      url: https://www.linkedin.com/in/shahar-asher30
    - network: GitHub
      url: https://github.com/ShaharAshe

work:
  - company: Taboola
    position: Software Engineer
    startDate: "2025-04"    # תאריכים תמיד במרכאות: "YYYY-MM" או "YYYY"
    endDate: "2026-04"      # בלי endDate → "Present"
    highlights:
      - text: Led the migration of a core publishers table to a single source of truth...
        featured: true    # מוצג גם בדף הבית
      - text: ...

projects:
  - name: Log Analytics Platform
    status: In Progress
    description: ...
    url: https://github.com/ShaharAshe/log-analytics-platform

skills:
  - category: Languages
    items: [Java, JavaScript, SQL, C++, Python]
  - ...

education:
  - institution: Hadassah Academic College, Jerusalem
    degree: B.Sc. Computer Science
    startDate: "2021"
    endDate: "2024"
    highlights: ["GPA: 91.5/100"]
```

המבנה מבוסס על הסטנדרט הפתוח [JSON Resume](https://jsonresume.org/schema), עם שדה `featured` נוסף. הקובץ מאומת מול schema (`src/data/resume.schema.ts`, zod מ-`astro/zod`) כבר בתחילת `npm run cv`, ושוב ב-Astro דרך `src/lib/resume.ts` (מודול מאומת שהקומפוננטות קוראות ממנו, לא content collection), כך ששדה חסר, שגוי או לא מוכר נתפס ב-build. המודול מחזיר את `basics` בלי האימייל; האימייל זמין רק דרך `getEmailParts()` (שם משתמש ודומיין בנפרד), בשביל כפתור ה-Copy שמרכיב אותו בדפדפן (§8.3).

> **הערה:** סקשן ה-Projects בקורות החיים נשאר ב-YAML ולא נמשך מ-GitHub. קורות חיים הם מסמך שאתה אוצר ידנית, והפרויקטים בו מנוסחים במיוחד בשבילו.

### 7.5 בדיקות ב-build
- **ה-PDF חייב להיות עמוד אחד.** גלישה לעמוד שני → ה-build נכשל.
- **ה-YAML תואם ל-schema.**
- **הטלפון לא מופיע בקבצי האתר** (`dist/**/*.{html,js,json,xml,txt}`) — בדיקה אוטומטית. הבדיקה
  לא בודקת את `Shahar_Asher_CV.pdf`/`.docx` עצמם, שבהם הטלפון אמור להופיע.
- **האימייל לא מופיע כטקסט רגיל בקבצי האתר** (אותם קבצים, `no-email-in-dist`) — כולל צורת `%40`
  ובלי תלות באותיות גדולות/קטנות. גם כאן ה-PDF/DOCX לא נבדקים, והפלט מציג רק קובץ:שורה, אף פעם לא את הכתובת.
- **נאמנות הפונט ב-PDF שמתפרסם:** ה-PDF שמתפרסם נבנה תמיד ב-CI (`ubuntu-24.04`, עם
  `libreoffice-writer` ו-`fonts-liberation`), ומאומת ש-`fc-match Arial` מצביע על Liberation Sans —
  אחרת ה-build נכשל. זה ה-PDF היחיד שמתפרסם אי-פעם. PDF שנוצר מקומית (למשל ב-Windows, עם Arial
  אמיתי) הוא תצוגה מקדימה של התוכן והעימוד בלבד, לא הקובץ שעולה לאוויר.

### 7.6 עמוד `/resume`
- התוכן המלא, בעיצוב האתר, באותו סדר כמו ב-PDF: שם, כותרת (`basics.label`), פרטי קשר, תקציר, Experience (כל ה-highlights), Projects (מ-`resume.projects`), Skills (עם שורת Spoken Languages בסוף), Education. כמו ב-PDF, `tagline` ו-`location` לא מוצגים. `basics.label` הוא התוספת היחידה לעומת ה-PDF.
- קישור **← Home** מעל הכותרת, וכפתור **Download PDF** בראש העמוד (המילוי היחיד בצבע accent בעמוד).
- שורת קשר אחת, כמו ב-PDF: כתובת המייל (היא עצמה קישור ה-`mailto:`) וכפתור העתקה קטן עם אייקון בלבד, ואחריהם LinkedIn ו-GitHub, עם מפרידים. המייל רק דרך `CopyEmail` (`variant="compact"`). הטלפון לא מופיע, וגם ההדפסה לא מזכירה אותו.
- כל פרויקט בנוי כמו רשומה ב-Experience: שם וסטטוס בשורה העליונה, קישור "GitHub" במקום התאריכים, ומתחת התיאור.
- Print stylesheet (`@media print` ב-`global.css`), כך ש-Ctrl+P מוציא דף נקי: טקסט כהה על רקע לבן גם ב-dark theme, בלי ניווט, footer, כפתורים וקישור Home, כתובת המייל נשארת אם נחשפה, ואחרי קישורי הפרופיל מודפסת הכתובת שלהם. ה-PDF נשאר הגרסה הרשמית.

### 7.7 פרטים
- **שם הקובץ:** `Shahar_Asher_CV.pdf`
- **כתובת קבועה:** `/resume.pdf`, כדי שאפשר לשים אותה ב-LinkedIn ובמיילים.
- **כפתור ההורדה:** ב-Hero ובעמוד `/resume`.

### 7.8 אפשרויות שנשקלו ונדחו
- **רק PDF להורדה:** בלי תצוגה טובה באתר.
- **PDF מוטמע בעמוד:** עובד גרוע בנייד, לא נגיש.
- **האתר מחלץ טקסט מה-PDF:** PDF הוא פורמט תצוגה, והחילוץ שביר.
- **האתר קורא את קובץ ה-Word (לפי שמות הסגנונות):** אפשרי, אבל נשבר אם שיחה עתידית ב-claude.ai תשנה את שמות הסגנונות, ודורש להעלות ידנית שלושה קבצים מתואמים.
- **PDF חדש שנוצר מתבנית HTML:** משנה את העיצוב הנוכחי של קורות החיים.

### 7.9 עדכוני תוכן מומלצים (לא חובה)
- **Scam Reporting:** בקורות החיים כתוב "Spring Boot, MySQL, responsive frontend". לפי ה-README יש גם **Spring Security עם הרשאות לפי תפקיד ו-WebSocket לעדכונים בזמן אמת**, ושווה להוסיף אותם.

---

## 8. יצירת קשר

### 8.1 ההחלטה

| ערוץ | תפקיד | שלב |
|---|---|---|
| **Email + כפתור Copy** | ראשי, הכפתור הבולט ביותר בסקשן | השקה |
| **LinkedIn** | ראשי, באותה רמה כמו המייל | השקה |
| **GitHub** | קישור (לא ערוץ פנייה) | השקה |
| **טופס** (פונקציה משלך על Cloudflare) | משני, מתחת לערוצים הראשיים | שלב 2 |

### 8.2 מבנה הסקשן
1. כותרת "Let's talk" + משפט קצר: "Open to backend and distributed systems roles." (את המשפט אפשר לשנות כשתמצא עבודה.)
2. שני כרטיסים באותו גודל: **Email** (עם כפתור Copy כחול) ו-**LinkedIn**.
3. בשלב 2: "Or send a message here" וטופס קצר. כפתור השליחה לא צבוע, כדי שיהיה ברור שזו אפשרות משנית.
4. קישור ל-GitHub בתחתית.

### 8.3 Email
- כפתור **Copy** שמעתיק את הכתובת, ולמשך כ-2 שניות מחליף את אייקון ההעתקה באייקון וי ומציג "Copied" (SVG, כי תווי הווי עלולים להופיע כאמוג'י צבעוני בטלפונים).
- `mailto:` כאפשרות נוספת בלבד (לרוב המבקרים אין תוכנת מייל מוגדרת). גם הקישור הזה מורכב בדפדפן.
- **הגנה מבוטים:** הכתובת מורכבת רק בדפדפן ולא מופיעה כטקסט רגיל ב-HTML. הקומפוננטות מקבלות אותה רק
  מ-`getEmailParts()` ב-`src/lib/resume.ts`, ובדיקת `no-email-in-dist` מכשילה את ה-build אם היא מופיעה ב-`dist/`.
- **בלי JavaScript:** הכתובת, כפתור ה-Copy וקישורי ה-`mailto:` (גם האייקון ב-Hero) מוסתרים ולא מקבלים פוקוס, ובכרטיס
  המייל מופיעה שורה קצרה שמפנה ל-LinkedIn. **אם ההעתקה נכשלת** (אין Clipboard API או שהגישה נחסמה): הכתובת מסומנת
  ומופיעה הנחיה להעתיק ידנית (Ctrl+C / ⌘C).

### 8.4 טופס (שלב 2)
- **שדות:** Name, Email, Message + שדה נסתר (honeypot) נגד בוטים.
- **ולידציה:** בדפדפן (חוויית משתמש) **וגם** בפונקציה בשרת (אבטחה). אורך מקסימלי לכל שדה.
- **הגנה מספאם:** Cloudflare Turnstile (בלתי נראה לרוב המבקרים) + honeypot + rate limit לפי IP.
- **שליחה:** הפונקציה שולחת מייל לתיבה שלך, עם `reply-to` של השולח, כך שאתה עונה ישירות מ-Gmail. ספק המייל ייבחר בזמן המימוש: Cloudflare Email Routing (שליחה לכתובת מאומתת שלך, דורש שהדומיין יהיה ב-Cloudflare) או שירות כמו Resend.
- **UX:** מצב טעינה, הודעת הצלחה, והודעת שגיאה עם הפניה למייל.
- **Secrets:** מפתחות API רק כ-secrets של Cloudflare, אף פעם לא בקוד.

### 8.5 אפשרויות שנשקלו ונדחו
- **רק `mailto:`:** לא עובד לרוב המבקרים.
- **טופס דרך שירות חיצוני (Formspree וכד'):** עובד, אבל עם תלות, מגבלות ולפעמים מיתוג זר. עדיף פונקציה משלך, שהיא גם עוד רכיב backend להראות.
- **Spring Boot לטופס:** overkill מוחלט.
- **קישור לתיאום פגישה (Calendly):** מגייסים כמעט לא משתמשים בזה, ועלול להיראות יומרני.

---

## 9. עיצוב ויזואלי

### 9.1 כיוון
**"Minimal, technical, fast"**: קרוב לאסתטיקה של תיעוד טכני טוב או כלי developer מודרני. הרבה whitespace, טיפוגרפיה חזקה, וצבע accent אחד.

### 9.2 צבעים

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0B0D10` | `#FAFAFA` |
| `--surface` | `#14171C` | `#FFFFFF` |
| `--text` | `#E6E8EB` | `#111418` |
| `--text-muted` | `#8B93A1` | `#5B6472` |
| `--accent` | `#4F9DFF` | גוון כהה יותר (למשל `#1F6FD1`), לניגודיות על לבן |
| `--border` | `#23272F` | `#E5E7EB` |

**למה כחול:** זה הצבע שכולם מזהים כ"קישור" ו"כפתור", הוא משדר אמינות ומקצועיות, והוא לא מתחרה בתוכן.

**Theme:**
- **בכניסה ראשונה האתר עוקב אחרי הגדרת המערכת** של המבקר (`prefers-color-scheme`; Dark אם הדפדפן לא מדווח העדפה).
- מתג Dark/Light. הבחירה נשמרת אצל המבקר (`localStorage`, מפתח `theme`, ערכים `light`/`dark`) ומאותו רגע גוברת על הגדרת המערכת.
- הצבע נקבע **לפני** שהדף מוצג (סקריפט קטן ב-`<head>`), כדי שלא יהיה הבהוב של צבע לא נכון בטעינה.
- כל הצבעים נבדקים לניגודיות WCAG AA (4.5:1 לטקסט) בשני המצבים.

**נשקל ונדחה:** צבע רנדומלי בכל כניסה. פוגע בעקביות, מכפיל את הבדיקות, ועלול לגרום להבהוב. (בוחר צבעים ידני למבקר נמצא ב-[Backlog](#18-backlog-רעיונות-לעתיד).)

### 9.3 טיפוגרפיה
- **טקסט:** Inter או Geist Sans
- **Mono (תגיות, accents):** JetBrains Mono או Geist Mono
- **סקאלה:** 6 גדלים בלבד (מוגדרים ב-`global.css`, גדלי ברירת המחדל של Tailwind מבוטלים):

| גודל | ערך | שימוש |
|---|---|---|
| `xs` | 0.75rem | תגיות, כיתובים, תאריכים |
| `sm` | 0.875rem | טקסט משני, ניווט |
| `base` | 1rem | טקסט רץ |
| `lg` | 1.25rem | כותרות משנה |
| `xl` | 1.75rem | כותרות סקשנים |
| `display` | 2.25rem בנייד עד 3rem בדסקטופ (`clamp()`) | כותרת ה-Hero וה-`<h1>` של `/resume` בלבד |

- הגופנים מאוחסנים באתר עצמו (self-host), לביצועים ולפרטיות.

### 9.4 Layout
- עמודה אחת ברוחב 720px לכל הסקשנים, לניווט ול-Footer, כדי שהכותרות והקצוות יהיו מיושרים. כרטיסי הפרויקטים בעמודה אחת בכל רוחב, וכל כרטיס תופס את כל העמודה.
- Mobile-first. כל סקשן נבדק ברוחב 375px.
- כרטיסים עם border עדין, בלי צללים כבדים.
- **Chips:** chip עם מסגרת (outlined) פירושו "טכנולוגיה" בכל האתר: שפות של פרויקט ו-Skills בדף הבית, כולם מקומפוננטה אחת (`src/components/TechChip.astro`). chip ממולא (רקע `--border`) הוא רק ל-topics של ריפו. אף chip לא משתמש ב-accent.

---

## 10. אנימציות וגרפיקה

### 10.1 מה כן

| אלמנט | אנימציה | כלי |
|---|---|---|
| מעבר בין עמודים | View Transitions | מובנה ב-Astro |
| כרטיסי פרויקטים | Hover: הרמה קלה + border כחול | CSS |
| כניסת סקשנים | Fade + slide קטן (8–16px), **פעם אחת** | CSS + IntersectionObserver |
| מתג Theme | הצבעים מתחלפים מיד (בלי מעבר, כי מותר להנפיש רק `transform` ו-`opacity`); רק האייקון החדש מסתובב ונכנס ב-fade (200ms), ורק אחרי לחיצה, לא בטעינה | CSS animation |
| כפתור Copy | החלפה מיידית לאייקון וי ול-"Copied" | CSS |

### 10.2 מה לא
- ❌ Three.js / 3D / WebGL
- ❌ רקעי חלקיקים
- ❌ אנימציה על כל אלמנט בגלילה
- ❌ Custom cursor, parallax מוגזם
- ❌ מסכי טעינה ואנימציות פתיחה

### 10.3 כללים
- **משך:** 150–300ms ל-micro-interactions, עד ~600ms לכניסות.
- **Easing:** `ease-out`.
- **`prefers-reduced-motion`:** כל האנימציות מכובות. חובה.
- רק `transform` ו-`opacity` (בלי layout shifts).
- **חריג: משחק ה-404 (F.3, `src/components/LostPageGame.astro`, `src/lib/game/`).** המשחק הוא תנועה מתמשכת על `<canvas>`, והוא חריג מכוון לשני הכללים שלמעלה:
  - **שום דבר לא זז לפני שהמבקר לוחץ Play** (או נוגע במשחק, או לוחץ Space / Enter כשהפוקוס על הדף עצמו או על המשחק, כמו בדינוזאור של Chrome), לאף אחד. אין autostart. מקש שנלחץ על קישור, על כפתור או על שדה שומר על התפקיד הרגיל שלו (Space על "Back to home" לא מתחיל משחק).
  - **עם `prefers-reduced-motion`** המשחק עדיין רץ אחרי שהמבקר התחיל אותו: התנועה הופעלה על ידו והיא עיקר התוכן, כמו ש-WCAG 2.3.3 מתיר. אבל בלי מה שרק מקשט את התנועה: בלי רעידה בפגיעה, בלי רקע זז (הקווקווים על הקרקע), בלי הליכה של הרגליים, ובלי הבהוב ב-game over (גם בלי reduced motion אין הבהוב: game over הוא שינוי סטטי אחד). המהירות והפיזיקה זהות. `effectsFor()` ב-`src/lib/game/engine.ts`.
  - **"רק `transform` ו-`opacity`"** הוא כלל על CSS בדף. הציור על ה-canvas מחוץ לו: הוא לא משנה layout, וה-canvas עצמו לא זז.
  - לא "לתקן" את המשחק לפי הכללים הכלליים. ההחלטה מתועדת כאן ובשורה ב-CLAUDE.md.

### 10.4 דיאגרמת ארכיטקטורה
- **דיאגרמה סטטית (SVG)** בעמוד ה-Log Analytics Platform, שמתאימה בדיוק לארכיטקטורה בריפו.
- נבנית כ-SVG בקוד, כך שהיא חדה בכל גודל ומתאימה את הצבעים ל-Dark/Light.
- גרסה מונפשת: ב-[Backlog](#18-backlog-רעיונות-לעתיד).

---

## 11. ביצועים, נגישות ו-SEO

### ביצועים
| מדד | יעד |
|---|---|
| Lighthouse (כל הקטגוריות) | 95+ |
| LCP | < 1.5s |
| CLS | < 0.05 |
| JS בדף הבית | < 30KB (gzipped) |
| תמונות | AVIF/WebP, lazy loading, מידות מוגדרות |

### נגישות
- HTML סמנטי (`<nav>`, `<main>`, `<section>`, כותרות בסדר נכון).
- ניווט מקלדת מלא + focus states גלויים.
- Alt לכל תמונה, labels לכל שדה.
- ניגודיות WCAG AA.
- `prefers-reduced-motion`.

### SEO ושיתוף
- `<title>` ו-`<meta description>` ייחודיים לכל עמוד. בדף הבית: הכותרת היא `שם – תפקיד` והתיאור הוא ה-tagline, שניהם מ-`resume.yaml`. כך כרטיס השיתוף (כותרת ותיאור מתחת לתמונה) לא חוזר על השם.
- **Open Graph image:** תמונה מעוצבת שמופיעה כשמשתפים את הקישור ב-LinkedIn או WhatsApp.
- `sitemap.xml` ו-`robots.txt`.
- JSON-LD מסוג `Person`, שנבנה מ-`resume.yaml`.

**איך זה בנוי (Task 2.13):**
- **כתובת בסיס אחת:** `site` ב-`astro.config.mjs`. כל כתובת מלאה (canonical, `og:url`, `og:image`, ה-sitemap ו-robots.txt) נגזרת ממנה דרך `src/lib/seo.ts`. מעבר לדומיין הוא שינוי של שורה אחת. אין `/` בסוף כתובת, חוץ מהשורש.
- **בכל עמוד:** canonical, תגיות Open Graph (`og:title`, `og:description`, `og:url`, `og:image` עם מידות ו-alt, `og:type`) ו-`twitter:card` מסוג `summary_large_image`. לדף ה-404 יש `noindex`, ואין לו canonical ואין `og:url`.
- **sitemap.xml ו-robots.txt** הם endpoints קטנים ב-`src/pages/`, לא `@astrojs/sitemap`. כך אין תלות חדשה, הקובץ נקרא `sitemap.xml` (ה-integration כותב `sitemap-index.xml`), ושורת ה-Sitemap ב-robots.txt נגזרת מ-`site`. ה-sitemap מכיל רק את `/` ואת `/resume`, בלי `/404`. ב-robots.txt אין אף Disallow, אחרת סורקים לא יראו את ה-noindex.
- **תמונת OG:** `public/og-image.png` בגודל 1200×630, נשמרת ב-git. היא נוצרת ב-`npm run og`: תבנית HTML עם השם, התפקיד וה-tagline מ-`resume.yaml`, בצבעי ה-dark ובגופנים של האתר, שמרונדרת עם ה-Playwright שכבר מותקן. הטקסט ממורכז, כדי שחיתוך ריבועי (WhatsApp) עדיין יראה את השם והתפקיד. הקובץ חייב להיות קטן מ-300KB. hash של מקורות התמונה נשמר בתוך ה-PNG, ו-`npm test` נכשל כשהוא כבר לא תואם (למשל אחרי שינוי בתפקיד ב-YAML).
- **אייקון האתר (Task 2.13a):** ראשי התיבות (נגזרים מ-`basics.name` ב-`resume.yaml`, אף פעם לא מוקלדים) ב-JetBrains Mono, בצבע ה-accent של ה-dark על רקע ה-dark, בריבוע מעוגל. גרסה אחת לשתי התמות: היא כהה, ולכן נקראת על דפדפן בהיר וכהה. `public/favicon.ico` מכיל PNG בגדלים 16, 32 ו-48 (Google דורש כפולה של 48), ו-`public/apple-touch-icon.png` הוא 180×180, ריבוע מלא ואטום (iOS מעגל אותו בעצמו וממלא פיקסלים שקופים בשחור). הם נוצרים באותו `npm run og` ובאותה בדיקת hash כמו תמונת ה-OG. כל גודל מרונדר בגודל האמיתי שלו, כדי שהגופן יקבל hinting לגודל הזה. **בלי SVG:** קובץ SVG לא יכול לטעון את הגופנים של האתר, וכדי להמיר את האותיות ל-paths היה צריך לפרסר woff2 (תלות חדשה או הרבה קוד). ב-16px יש ל-JetBrains Mono 400 קו דק, אז מתווסף לו קו מתאר (`text-stroke`) של 0.4px. ה-`<link>` לשני הקבצים נמצאים ב-`BaseLayout`, בכל עמוד. Cloudflare מגיש את ה-`.ico` כ-`image/vnd.microsoft.icon`, ולכן אין צורך בשינוי ב-`_headers`.
- **JSON-LD** רק בדף הבית: `name`, `jobTitle`, `description`, `url`, `sameAs` (הפרופילים), `knowsAbout` (הכישורים), `alumniOf`. אף פעם לא אימייל, טלפון או כתובת.
- **noindex:** ה-`X-Robots-Tag: noindex` בכל האתר נשאר עד המעבר לדומיין, כדי ש-Google לא יאנדקס את כתובת ה-workers.dev ככפילות.

---

## 12. פרטיות, אבטחה וסודיות

### מידע אישי
- **טלפון:** רק ב-Word/PDF. לא באתר (כולל בדיקה אוטומטית ב-build).
- **מייל:** מוצג באתר, אבל מורכב רק בדפדפן כדי להקטין איסוף על ידי בוטים.
- **מיקום:** "Israel" בלבד.

### סודיות מול Taboola
- אין קוד, צילומי מסך של מערכות פנימיות, שמות טבלאות או שירותים פנימיים, ומספרים עסקיים שלא פורסמו.
- מתארים **בעיות, גישות והחלטות** ברמה כללית.
- כלל אצבע: אם לא היית אומר את זה בראיון בחברה מתחרה, זה לא נכנס לאתר.
- כדאי לבדוק מה כתוב בהסכם הסודיות שלך.

### אבטחה
- **טופס:** ולידציה בשרת, rate limiting, honeypot, Turnstile.
- **Secrets:** רק כ-secrets של Cloudflare ו-GitHub Actions.
- **Security headers** דרך קובץ `_headers` (Cloudflare מחיל אותו על כל תגובה, כולל דף ה-404), ראה למטה.

#### Content-Security-Policy
**המדיניות** (אחת לכל האתר, תחת `/*`):
`default-src 'self'; script-src 'self' https://static.cloudflareinsights.com/beacon.min.js <hashes>; style-src 'self' <hashes>; img-src 'self'; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
אין `'unsafe-inline'` ואין `'unsafe-eval'`, לא לסקריפטים ולא לסגנונות.

**צד שלישי יחיד: Cloudflare Web Analytics** ([§15](#15-analytics)). ב-`script-src` הנתיב המלא של קובץ ה-beacon ולא כל ה-host (הצורה שב-FAQ של Cloudflare; עובד כי הכתובת מחזירה 200 בלי redirect), וב-`connect-src` ה-origin שאליו הוא שולח (`https://cloudflareinsights.com/cdn-cgi/rum`). ה-token נמצא ב-attribute (`data-cf-beacon`) של סקריפט עם `src`, לא בסקריפט inline, ולכן לא צריך hash. ברכת ה-console (F.1, `src/lib/console-greeting.ts`) היא עוד סקריפט inline, שה-build מוסיף את ה-hash שלו כמו לכל השאר (hash אחד, כי הטקסט זהה בכל הדפים). השורה של ה-CSP היא 730 מתוך 2,000 תווים.

**איך ה-hashes נוצרים:** Astro מטמיע בתוך ה-HTML כמה סקריפטים וסגנונות: הסקריפט נגד הבהוב (חייב להישאר inline ראשון ב-`<head>`), הסקריפטים של כפתור ה-theme ושל כפתור ההעתקה (קטנים ממגבלת ה-inline של Vite), ה-`<style>` של רכיבים, וה-`@font-face` של `<Font />`. התוכן שלהם משתנה בכל שינוי קוד, ולכן ה-hashes לא נכתבים ביד: integration קטן (`scripts/csp/csp.mts`, רשום ב-`astro.config.mjs`) רץ בסוף כל `astro build`, מחשב SHA-256 לכל `<script>` ו-`<style>` inline בכל דף ב-`dist/`, וכותב את המדיניות ל-`dist/_headers` במקום שורת placeholder. ה-placeholder ב-`public/_headers` הוא `default-src 'none'`: אם השלב לא רץ, האתר נשבר באופן גלוי במקום לעלות בלי CSP. ה-build נכשל אם יש ב-HTML משהו ש-hash לא יכול לאשר (`style="..."`, `onclick=` וכדומה, `javascript:`), או אם `_headers` חורג מהמגבלות של Cloudflare (2,000 תווים לשורה, 100 rules).

**חלופות שנשקלו:**
- **ה-CSP המובנה של Astro (`security.csp`):** באתר סטטי בלי adapter הוא כותב רק `<meta>`. meta לא תומך ב-`frame-ancestors`, לא חל על מה שמופיע לפניו ב-`<head>` (הסקריפט נגד הבהוב חייב להיות ראשון), ולא מחשב hash לסקריפטים `is:inline`. בנוסף, header ו-meta ביחד הם שתי מדיניות שהדפדפן אוכף את שתיהן. נדחה.
- **להוציא את הסקריפטים לקבצים** (`assetsInlineLimit: 0`) כדי ש-`'self'` יכסה אותם: מוסיף בקשות בנתיב הרינדור (פוגע ב-LCP), והסקריפט נגד הבהוב ו-CSS הפונטים עדיין inline, כך שעדיין צריך hashes. נדחה.

**`upgrade-insecure-requests` לא נכלל:** כל הכתובות באתר יחסיות ומאותו origin, ו-`'self'` בדף HTTPS מתאים רק ל-HTTPS. הוא גם היה שובר את הבדיקות מול `http://127.0.0.1`. אין endpoint לדיווחים (`report-to`), כי האתר סטטי.

#### Headers נוספים
- **Permissions-Policy:** חוסם יכולות שהאתר לא משתמש בהן (מצלמה, מיקרופון, מיקום, תשלומים, USB וכו'). ה-clipboard לא חסום (כפתור ההעתקה).
- **Cross-Origin-Opener-Policy: same-origin.**
- **X-Frame-Options: DENY:** כפול ל-`frame-ancestors 'none'`, בשביל דפדפנים ישנים. לא עולה כלום.
- **Strict-Transport-Security: max-age=31536000:** ב-workers.dev לא מוסיף (הסיומת `.dev` כולה ב-HSTS preload), אבל חשוב אם הדומיין יהיה `.com`. בלי `includeSubDomains` ו-`preload` עד שהדומיין נקבע (Task 4.2).
- נשארים: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, ו-`X-Robots-Tag: noindex` עד המעבר לדומיין.
- **`X-Clue` על `/favicon.ico`:** לא header אבטחה. רמז בשרשרת ה-CTF (F.2). הטקסט מגיע מ-`src/lib/ctf.mts`, ולכן הוא לא כתוב ב-`public/_headers`: integration קטן (`scripts/ctf/ctf-headers.mts`) מוסיף את ה-rule ל-`dist/_headers` ורץ לפני שלב ה-CSP, כך שבדיקת המגבלות של Cloudflare מכסה גם אותו. ה-rule של `/*` עדיין חל על הקובץ. השורה הנוספת בברכת ה-console (רמז 1) שינתה את ה-hash שלה אבל לא את אורך שורת ה-CSP (עדיין 730 מתוך 2,000).
- **משחק ה-404 (F.3)** לא שינה את המדיניות: ה-loader וקובץ המשחק הם קבצי JS ב-`/_astro/` (מכוסים ב-`'self'`), בלי סקריפט inline ובלי `style` attributes, והצבעים נקראים מה-tokens ב-JS. השורה נשארה 730 מתוך 2,000.

#### בדיקה
- `tests/csp.test.ts` בודק על `dist/` שלכל סקריפט וסגנון inline בכל דף (כולל 404) יש hash במדיניות, ושה-hash של הסקריפט נגד הבהוב מחושב מחדש מ-`themeInitScript`.
- בדיקות ה-e2e רצות מול `wrangler dev` ולא מול `astro preview`, שלא שולח את `_headers`. כך כל הבדיקות רצות עם ה-CSP האמיתי, ובדיקה אחת מוודאת שסקריפט inline שהוזרק נחסם.
- **Cloudflare לא מזריק כלום** כרגע (Web Analytics אוטומטי, email obfuscation, Rocket Loader): נבדק באתר החי. אם אחד מהם יופעל, המדיניות צריכה לאשר אותו או שהוא צריך להיות כבוי. לבדוק שוב במעבר לדומיין (Task 4.2), כי zone יכול להפעיל אותם.
- **Web Analytics (Task 2.15):** ה-beacon מוטמע ידנית (לא הזרקה של Cloudflare), ולכן הוא ב-HTML והבדיקות רואות אותו. `tests/e2e/analytics.spec.ts` מוודא בדפדפן שה-CSP מאשר אותו, ובדיקת ביקורת מוודאת שבלי הכתובת במדיניות הוא נחסם.
- **בהמשך:** טופס הקשר (Task 3.3) ידרוש `form-action 'self'`, ו-Turnstile ידרוש `https://challenges.cloudflare.com` ב-`script-src` וב-`frame-src`.

---

## 13. אחסון, דומיין ו-CI/CD

### 13.1 אחסון: Cloudflare

**למה Cloudflare:**
- **הכל במקום אחד:** אחסון, הפונקציה של הטופס, Turnstile, אנליטיקס ודומיין.
- **הבית של Astro:** Cloudflare רכשה את Astro בינואר 2026. Astro נשאר קוד פתוח ועובד בכל פלטפורמה.
- **תעבורה ללא הגבלה** לקבצים סטטיים בחבילה החינמית, ושימוש מסחרי מותר.
- **עלות: 0₪.** בחבילה החינמית אין חיוב על חריגה, השירות פשוט נעצר.

**נשקל:** Vercel. מצוין וחינמי גם הוא, עם ממשק נוח מאוד, אבל הוא בנוי בעיקר סביב Next.js, וההגנה מספאם והאנליטיקס היו אצל ספקים אחרים. GitHub Pages נדחה כי הוא לא תומך בפונקציות שרת (טופס).

**ניידות:** הבנייה רצה ב-GitHub Actions, והאחסון רק מגיש את הקבצים המוכנים. מעבר לפלטפורמה אחרת בעתיד הוא עניין של שעה.

**כתובות בלי `/` בסוף:** הכתובת הקנונית היא `/resume`, ולכן `html_handling` מוגדר ל-`drop-trailing-slash` ו-`trailingSlash` ל-`'never'`, כדי שהקישורים הפנימיים יקבלו 200 ישר, בלי הפניה מיותרת ל-`/resume/` (ברירת המחדל של Cloudflare).

**דף 404:** `not_found_handling` מוגדר ל-`404-page`, כדי שכתובת לא מוכרת תקבל את `404.html` עם סטטוס 404 (ברירת המחדל של Cloudflare היא 404 ריק). הסטטוס חייב להישאר 404 ולא 200, כי soft 404 פוגע ב-SEO.

### 13.2 דומיין
- **ההחלטה תתקבל בסוף העבודה.** בינתיים האתר זמין בכתובת החינמית של Cloudflare.
- **מועמדים:** `shaharasher.dev`, `shaharasher.com`.
- **רכישה דרך Cloudflare Registrar:** מחיר עלות בלי רווח, וחידוש באותו מחיר. `.dev` עולה בערך 10–15$ לשנה.
- **אחרי הרכישה:** לעדכן את הקישור ב-LinkedIn, בפרופיל GitHub וב-`resume.yaml`. באתר: לשנות את `site` ב-`astro.config.mjs` (שורה אחת), ולהסיר את `X-Robots-Tag: noindex` מ-`public/_headers`.

### 13.3 CI/CD (GitHub Actions)

**Workflow אחד, ארבעה טריגרים:**
| טריגר | מתי | למה |
|---|---|---|
| `push` ל-`main` | בכל שינוי | deploy רגיל |
| `pull_request` | בכל PR | build ו-checks בלבד, בלי deploy |
| `schedule` | פעם ביום | משיכת פרויקטים חדשים מ-GitHub |
| `workflow_dispatch` | ידני | עדכון מיידי |

**שלבי ה-build:**
1. התקנת תלויות (Node, `libreoffice-writer` + `fonts-liberation` על `ubuntu-24.04`), ואימות
   ש-`fc-match Arial` מצביע על Liberation Sans
2. אימות `resume.yaml` מול ה-schema
3. יצירת Word מה-YAML (`create_cv.js`)
4. המרת Word ל-PDF (LibreOffice) + בדיקה שהוא עמוד אחד
5. משיכת נתוני הפרויקטים מ-GitHub API (עם `GITHUB_TOKEN`) + בדיקת תיאורים
6. Build של Astro, שבסופו נכתב ה-CSP ל-`dist/_headers` ([§12](#12-פרטיות-אבטחה-וסודיות)), והעתקת ה-PDF ל-`dist/resume.pdf` (`publish-pdf.ts`). `_headers` מגיש אותו
   `inline` עם שם הקובץ `Shahar_Asher_CV.pdf`
7. בדיקות: lint, type-check, שהטלפון לא מופיע בקבצי האתר
8. בדיקות end-to-end בדפדפן אמיתי (Playwright, `npm run test:e2e`, Chromium headless) מול ה-build
   עצמו, מוגש ב-`wrangler dev` עם ה-headers האמיתיים. אם הן נכשלות אין deploy, וה-report נשמר כ-artifact ל-7 ימים
9. **רק על `main`** (push, schedule, הרצה ידנית): Deploy ל-Cloudflare

**Pull Requests:** מריצים build ו-checks בלבד (כולל `fc-match`), בלי deploy ובלי preview deployment,
בשלב הזה. push ל-branch אחר לא מריץ את ה-workflow בעצמו (כדי ש-PR לא ירוץ פעמיים); ה-PR מריץ אותו.

**זרימת עבודה:** שינוי מגיע ל-`main` רק דרך branch ו-PR שה-check `build` שלו עבר (squash merge), והוא up to date מול `main`. ruleset על `main` אוכף את זה כשה-repo ציבורי; עד אז hook מקומי (`.githooks/pre-push`) חוסם push ל-`main`.

---

## 14. מבנה הפרויקט

```
portfolio/
├── CLAUDE.md                        # הנחיות קבועות ל-Claude Code
├── astro.config.mjs
├── wrangler.jsonc                   # הגדרות Cloudflare
├── public/
│   ├── og-image.png
│   ├── favicon.ico                  # 16/32/48, נוצר ב-npm run og
│   ├── apple-touch-icon.png         # 180×180, נוצר ב-npm run og
│   └── _headers                     # Security headers
├── scripts/
│   ├── cv/
│   │   ├── validate-resume.ts       # אימות resume.yaml מול ה-schema
│   │   ├── create_cv.js             # העיצוב הנוכחי, קורא מ-resume.yaml
│   │   ├── format.js                # פורמט תאריכים וכתובות (לשימוש create_cv.js)
│   │   ├── paths.js                 # נתיבי קלט/פלט משותפים (.generated/cv/)
│   │   ├── to-pdf.js                # הרצת soffice (Word → PDF)
│   │   ├── check-pdf.ts             # בדיקה שה-PDF הוא עמוד אחד (pdf-parse)
│   │   └── publish-pdf.ts           # העתקת ה-PDF ל-dist/resume.pdf (סוף ה-build)
│   ├── checks/                      # בדיקות אתר: טלפון ואימייל לא ב-dist/ וכו' (npm run check)
│   ├── og/                          # יצירת og-image.png ואייקוני האתר (npm run og) + בדיקת PNG/ICO לזיהוי תמונה לא מעודכנת
│   └── github/
│       └── fetch-projects.ts        # משיכה מ-GitHub API → src/data/projects.json
├── src/
│   ├── content.config.ts            # Content collections: עמודי העומק של הפרויקטים (MDX)
│   ├── lib/
│   │   ├── resume.ts                # קורות חיים מאומתים לקומפוננטות (בלי אימייל; getEmailParts() בנפרד)
│   │   ├── seo.ts                   # כתובות מלאות מ-site, טקסט ה-sitemap ו-robots, JSON-LD מסוג Person
│   │   └── projects.ts              # projects.json מאומת לקומפוננטות (ה-schema הוא מקור הטיפוסים)
│   ├── data/
│   │   ├── resume.yaml              # ⭐ המקור היחיד לקורות החיים
│   │   ├── resume.schema.ts         # Schema ל-resume.yaml (משותף לסקריפטים ול-src/lib/resume.ts)
│   │   ├── project-page.schema.ts   # Schema ל-frontmatter של עמודי הפרויקטים
│   │   └── projects.json            # נוצר ב-build (לא נשמר ב-git)
│   ├── content/
│   │   ├── projects/
│   │   │   └── log-analytics-platform.mdx
│   │   └── case-studies/
│   │       └── table-migration.mdx
│   ├── components/
│   │   ├── Hero.astro
│   │   ├── Experience.astro
│   │   ├── Projects.astro
│   │   ├── ProjectCard.astro
│   │   ├── Skills.astro
│   │   ├── TechChip.astro
│   │   ├── Contact.astro
│   │   ├── ArchitectureDiagram.astro
│   │   ├── ThemeToggle.astro        # רכיב Astro + סקריפט קטן, לא island
│   │   ├── CopyEmail.astro          # רכיב Astro + סקריפט קטן, לא island
│   │   └── islands/
│   │       └── ContactForm.tsx      # שלב 2
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── ArticleLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── resume.astro
│   │   ├── projects/[slug].astro
│   │   ├── case-studies/[slug].astro
│   │   ├── 404.astro
│   │   ├── sitemap.xml.ts           # endpoint: ה-sitemap (כתובת האתר מ-site ב-astro.config.mjs)
│   │   ├── robots.txt.ts            # endpoint: robots.txt עם שורת Sitemap
│   │   └── api/contact.ts           # שלב 2: הפונקציה של הטופס
│   └── styles/
│       └── global.css               # Design tokens
├── tests/                           # בדיקות node:test (npm test), fixtures/ לקבצי בדיקה
│   └── e2e/                         # בדיקות Playwright בדפדפן (npm run test:e2e)
└── .github/workflows/
    └── deploy.yml
```

---

## 15. Analytics

**הבחירה: Cloudflare Web Analytics.** חינמי, privacy-friendly, ולא דורש באנר עוגיות.

**למה אין באנר עוגיות:** Cloudflare Web Analytics לא שומר כלום בדפדפן ולא מזהה מבקרים. בלשון של Cloudflare: "does not use any client-side state, such as cookies or localStorage, to collect usage metrics" ו-"We also don't 'fingerprint' individuals via their IP address, User Agent string, or any other data" ([cloudflare.com/web-analytics](https://www.cloudflare.com/web-analytics/)), וגם "does not collect or use your visitors' personal data" ([developers.cloudflare.com/web-analytics/about](https://developers.cloudflare.com/web-analytics/about/)). נבדק גם בקוד של `beacon.min.js` עצמו (2026-11-13): אין בו `document.cookie` ואין `localStorage`. האתר עצמו שומר רק את בחירת ה-theme ב-`localStorage`, שזו העדפה שהמשתמש ביקש ולא מעקב. לכן אין מה לבקש עליו הסכמה.

**איך זה מחובר (Task 2.15):**
- האתר ב-workers.dev ולא ב-zone של Cloudflare, ולכן Cloudflare לא יכול להזריק את ה-beacon. משתמשים ב-snippet הידני מהדשבורד: `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "…"}'>`, אחרון לפני `</body>` ב-`BaseLayout`, כלומר בכל הדפים כולל ה-404 (כניסות ל-404 מראות לאילו קישורים שבורים אנשים מגיעים).
- `type="module"` כמו ב-snippet של הדשבורד: סקריפט module נטען בלי לחסום את הרינדור ורץ אחרי ה-parsing, כמו `defer`.
- ה-token הוא קבוע ב-`src/lib/analytics.ts`. הוא לא סוד: הוא מופיע במקור של כל דף.
- **רק ב-build של production** (`import.meta.env.PROD`): `npm run dev` לא טוען אותו. build מקומי (`wrangler dev`, `npm run preview`) כן טוען אותו, אבל דיווח מ-`127.0.0.1` כנראה לא נספר, כי Cloudflare משווה את ה-hostname לאתר שהוגדר בדשבורד (FAQ). זה לא נבדק בבקשה אמיתית.
- **הבדיקות לא שולחות כניסות:** כל ה-e2e וצילומי המסך עוברים דרך `tests/e2e/fixtures.ts`, שעוצר כל בקשה ל-`*.cloudflareinsights.com` לפני הרשת. בדיקה ב-`npm test` נכשלת אם spec לא משתמש בו.
- **אין SRI:** Cloudflare לא מקבע גרסאות של ה-beacon, אז אין hash יציב.
- **תקציב ה-JS:** ה-beacon נספר בתקציב של 30KB gzipped. זה JS אמיתי שכל מבקר מוריד. 10,274 bytes gzipped (31,853 בלי דחיסה) כשנמדד ב-2026-11-13, ובבדיקות נספר כ-11KB, כי הקובץ לא מקובע ויכול לגדול. בדף הבית: 1.24KB של האתר + 11KB = 12.24KB.
- הנתונים מופיעים בדשבורד אחרי כמה דקות.

**מה מודדים:**
- כמה נכנסים, ומאיפה (LinkedIn? חיפוש? ישיר?)
- **הורדות של קורות החיים**: המדד הכי טוב לכך שהאתר עובד
- כניסות לעמודי העומק
- לחיצות על LinkedIn ו-GitHub

---

## 16. Roadmap לפי שלבים

### שלב 0: הכנה (לפני קוד)
- [ ] להוסיף תיאורים לריפוזיטוריז שחסר להם: **log-analytics-platform**, NeetCode, project_euler
- [ ] להוסיף topics לריפוזיטוריז לפי הטבלה ב-[§6.5](#65-מצב-הריפוזיטוריז-היום-והמיפוי-המוצע)
- [ ] לתקן ב-README של scam-reporting-app: "About As" → "About Us"
- [ ] לפתוח חשבון Cloudflare (חינם)
- [ ] לכתוב טקסט ל-Hero (משפט אחד)

### שלב 1: MVP
- [ ] Scaffold: Astro + Tailwind + TypeScript
- [ ] Design tokens, BaseLayout, Dark/Light עם מתג
- [ ] `resume.yaml` + schema (המרה מ-`create_cv.js` הקיים)
- [ ] `create_cv.js` קורא מה-YAML, יצירת PDF + בדיקת עמוד אחד
- [ ] משיכת פרויקטים מ-GitHub + סינון לפי topics
- [ ] דף בית: Hero, Experience, Projects, Skills, Contact (מייל + Copy, LinkedIn, GitHub)
- [ ] עמוד `/resume` + הורדת PDF
- [ ] SEO בסיסי + OG image + security headers
- [ ] GitHub Actions: build, בדיקות, deploy, build יומי
- [ ] Cloudflare Web Analytics
- [ ] **→ האתר באוויר בכתובת החינמית של Cloudflare**

### שלב 2: עומק
- [ ] עמוד Log Analytics Platform עם דיאגרמה סטטית
- [ ] Case study: מיגרציה
- [ ] טופס יצירת קשר (פונקציה + Turnstile)
- [ ] אנימציות עדינות + View Transitions

### שלב 3: השקה רשמית
- [ ] בחירה ורכישה של דומיין
- [ ] עדכון הקישור ב-LinkedIn, ב-GitHub וב-`resume.yaml`
- [ ] בדיקה סופית: Lighthouse, נייד, ניגודיות, כל הקישורים

---

## 17. עבודה עם Claude Code

### 17.1 `CLAUDE.md`
קובץ בשורש הפרויקט ש-Claude Code קורא בכל סשן. יכלול:
- מטרת האתר וקהל היעד ([§1](#1-מטרות-וקהל-יעד))
- ה-Stack ומבנה התיקיות ([§3](#3-tech-stack), [§14](#14-מבנה-הפרויקט))
- Design tokens וכללי עיצוב ([§9](#9-עיצוב-ויזואלי))
- כללי אנימציה ([§10.3](#103-כללים))
- יעדי ביצועים ([§11](#11-ביצועים-נגישות-ו-seo))
- **כללים:**
  - תוכן קורות חיים **רק** ב-`resume.yaml`, אף פעם לא hardcoded בקומפוננטות.
  - **לא לשנות את העיצוב ב-`create_cv.js`** בלי בקשה מפורשת.
  - הטלפון לעולם לא מוצג באתר.
  - אין ספריות חדשות בלי לשאול.
  - להריץ build ו-type-check לפני סיום משימה.
  - סודיות Taboola ([§12](#12-פרטיות-אבטחה-וסודיות)).

### 17.2 שיטת עבודה
1. **משימה אחת בכל פעם**, לפי ה-Roadmap.
2. **Plan mode** לפני משימות גדולות.
3. **בדיקות UI ואימות ויזואלי:** התנהגות שצריכה דפדפן אמיתי (מקלדת, focus, שמירת theme, פונטים)
   נבדקת בבדיקות Playwright קבועות ב-`tests/e2e/`, שרצות גם ב-CI לפני deploy. בנוסף, screenshots
   לסקירה (`npm run screenshots`) ב-375px וב-1280px, בשני מצבי הצבע, נבדקים בעין. אין השוואת
   screenshots אוטומטית: רינדור הפונטים שונה בין Windows ל-Linux.
4. **Commit אחרי כל שלב** שעובד.
5. **התוכן שלך:** Claude Code יכול לעזור לנסח, אבל הטקסט הסופי צריך להישמע כמוך.

### 17.3 עדכון קורות חיים
> "תעדכן בקורות החיים: [השינוי]. אחרי זה תריץ את ה-build ותראה לי את ה-PDF."

---

## 18. Backlog: רעיונות לעתיד

| רעיון | למה אולי | הערה |
|---|---|---|
| **דיאגרמת Kafka מונפשת** | מראה הבנה של rebalance, at-least-once ו-hot partitions במקום רק לטעון אותה. פותחת שיחה בראיון | הדבר הכי מרשים, וגם הכי ארוך לבנות |
| **Engineering Notes (בלוג)** | 2–3 פוסטים טכניים נותנים חומר לשיחה בראיונות | המבנה של Astro תומך בזה בלי שינויים |
| **בוחר צבעים למבקר** | פרט קטן ושובב: עיגולי צבע שהמבקר יכול לבחור, ונשמרים אצלו | כחול נשאר ברירת המחדל |
| **גרסאות ממוקדות של קורות חיים** | לתייג נקודות ב-YAML ולייצר גרסה לכל סוג משרה | אפשרי בזכות ה-YAML |
| **Demo חי של Log Analytics** | Java שרץ בפרודקשן באמת | דורש שרת בתשלום |
| **Lighthouse CI** | בדיקת ביצועים אוטומטית בכל PR | |
