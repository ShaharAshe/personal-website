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
└── /404                        → דף שגיאה מעוצב
```

**ניווט עליון:** `Experience · Projects · Resume · Contact` + מתג Dark/Light + אייקוני GitHub/LinkedIn.

**למה דף בית גולל + עמודי עומק?** מגייס רואה הכל בגלילה אחת בלי ללחוץ, ומי שרוצה עומק נכנס לעמוד הייעודי. דפים נפרדים כמו "About" ו-"Skills" בדרך כלל יוצאים רדודים.

---

## 5. תוכן לפי דף

### 5.1 דף הבית

#### Hero
- **שם:** Shahar Asher
- **כותרת:** Software Engineer, Backend & Distributed Systems (מ-`basics.label` ב-`resume.yaml`; `create_cv.js` לא משתמש בשדה הזה, אז ה-PDF לא משתנה)
- **משפט אחד:** מ-`basics.tagline` ב-`resume.yaml`, שדה חובה ב-schema: שורה אחת שנכתבת ידנית (המשפט הראשון של `summary` מתחיל ב-"Software Engineer" וחוזר על הכותרת). לא מופיע ב-PDF.
- **CTAs:** `Download Resume` (ראשי, כחול) · `View Projects` (משני) · אייקוני GitHub / LinkedIn / Email
- **ויזואל:** רקע עדין לכל היותר (grid או נקודות). בלי תמונה ענקית.

#### Experience
- **נבנה מ-`resume.yaml`**, כך שאין כפילות עם קורות החיים.
- כרטיס ל-Taboola. בדף הבית מוצגות 3–4 הנקודות החזקות (מסומנות `featured: true` ב-YAML), ויש קישור לקורות החיים המלאים.
- קישור "Read the migration case study →".
- מבנה timeline, כדי שיהיה מקום לתפקידים עתידיים.
- תפקיד בלי נקודות `featured` עדיין מוצג (חברה, תפקיד ותאריכים בלבד), כדי שלא יהיה חור ב-timeline.

#### Projects
- **נבנה מ-GitHub** ([§6](#6-פרויקטים-דינמיים-מ-github)).
- Featured בכרטיס רחב, אחריו More projects בכרטיסים קטנים, ובסוף שורת Algorithm practice.

#### Skills
- **נבנה מ-`resume.yaml`**.
- מקובץ לפי קטגוריות, כמו בקורות החיים. **בלי** progress bars או אחוזים.

#### Contact
- ראה [§8](#8-יצירת-קשר).

#### Footer
- © שנה · "Built with Astro" · קישור לקוד המקור של האתר ב-GitHub.

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
| `portfolio-featured` | כרטיס רחב בראש סקשן Projects |
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
| Demo | `homepage` | קישור "Live demo ↗", אם הוגדר Website בריפו |

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
- התוכן המלא, בעיצוב האתר.
- כפתור **Download PDF** בראש העמוד.
- Print stylesheet, כך ש-Ctrl+P מוציא דף נקי.

### 7.7 פרטים
- **שם הקובץ:** `Shahar_Asher_CV.pdf`
- **כתובת קבועה:** `/resume.pdf`, כדי שאפשר לשים אותה ב-LinkedIn ובמיילים.
- **כפתור ההורדה:** ב-Hero, בתפריט העליון ובעמוד `/resume`.

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
1. כותרת "Let's talk" + משפט קצר: "Open to backend and distributed systems roles. I usually reply within a day." (את המשפט אפשר לשנות כשתמצא עבודה.)
2. שני כרטיסים באותו גודל: **Email** (עם כפתור Copy כחול) ו-**LinkedIn**.
3. בשלב 2: "Or send a message here" וטופס קצר. כפתור השליחה לא צבוע, כדי שיהיה ברור שזו אפשרות משנית.
4. קישור ל-GitHub בתחתית.

### 8.3 Email
- כפתור **Copy** שמעתיק את הכתובת ומציג "Copied ✓".
- `mailto:` כאפשרות נוספת בלבד (לרוב המבקרים אין תוכנת מייל מוגדרת). גם הקישור הזה מורכב בדפדפן.
- **הגנה מבוטים:** הכתובת מורכבת רק בדפדפן ולא מופיעה כטקסט רגיל ב-HTML. הקומפוננטות מקבלות אותה רק
  מ-`getEmailParts()` ב-`src/lib/resume.ts`, ובדיקת `no-email-in-dist` מכשילה את ה-build אם היא מופיעה ב-`dist/`.

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
| `display` | 2.25rem בנייד עד 3rem בדסקטופ (`clamp()`) | כותרת ה-Hero בלבד |

- הגופנים מאוחסנים באתר עצמו (self-host), לביצועים ולפרטיות.

### 9.4 Layout
- רוחב תוכן מקסימלי ~720px לטקסט, ~1100px לגרידים.
- Mobile-first. כל סקשן נבדק ברוחב 375px.
- כרטיסים עם border עדין, בלי צללים כבדים.

---

## 10. אנימציות וגרפיקה

### 10.1 מה כן

| אלמנט | אנימציה | כלי |
|---|---|---|
| מעבר בין עמודים | View Transitions | מובנה ב-Astro |
| כרטיסי פרויקטים | Hover: הרמה קלה + border כחול | CSS |
| כניסת סקשנים | Fade + slide קטן (8–16px), **פעם אחת** | CSS + IntersectionObserver |
| מתג Theme | הצבעים מתחלפים מיד (בלי מעבר, כי מותר להנפיש רק `transform` ו-`opacity`); רק האייקון החדש מסתובב ונכנס ב-fade (200ms), ורק אחרי לחיצה, לא בטעינה | CSS animation |
| כפתור Copy | שינוי ל-"Copied ✓" | CSS |

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
- `<title>` ו-`<meta description>` ייחודיים לכל עמוד.
- **Open Graph image:** תמונה מעוצבת שמופיעה כשמשתפים את הקישור ב-LinkedIn או WhatsApp.
- `sitemap.xml` ו-`robots.txt`.
- JSON-LD מסוג `Person`, שנבנה מ-`resume.yaml`.

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
- **Security headers** בסיסיים (CSP, X-Content-Type-Options, Referrer-Policy) דרך קובץ `_headers`.

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

### 13.2 דומיין
- **ההחלטה תתקבל בסוף העבודה.** בינתיים האתר זמין בכתובת החינמית של Cloudflare.
- **מועמדים:** `shaharasher.dev`, `shaharasher.com`.
- **רכישה דרך Cloudflare Registrar:** מחיר עלות בלי רווח, וחידוש באותו מחיר. `.dev` עולה בערך 10–15$ לשנה.
- **אחרי הרכישה:** לעדכן את הקישור ב-LinkedIn, בפרופיל GitHub וב-`resume.yaml`.

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
6. Build של Astro, והעתקת ה-PDF ל-`dist/resume.pdf` (`publish-pdf.ts`). `_headers` מגיש אותו
   `inline` עם שם הקובץ `Shahar_Asher_CV.pdf`
7. בדיקות: lint, type-check, שהטלפון לא מופיע בקבצי האתר
8. בדיקות end-to-end בדפדפן אמיתי (Playwright, `npm run test:e2e`, Chromium headless) מול ה-build
   עצמו. אם הן נכשלות אין deploy, וה-report נשמר כ-artifact ל-7 ימים
9. **רק על `main`** (push, schedule, הרצה ידנית): Deploy ל-Cloudflare

**Pull Requests:** מריצים build ו-checks בלבד (כולל `fc-match`), בלי deploy ובלי preview deployment,
בשלב הזה. push ל-branch אחר לא מריץ את ה-workflow בעצמו (כדי ש-PR לא ירוץ פעמיים); ה-PR מריץ אותו.

---

## 14. מבנה הפרויקט

```
portfolio/
├── CLAUDE.md                        # הנחיות קבועות ל-Claude Code
├── astro.config.mjs
├── wrangler.jsonc                   # הגדרות Cloudflare
├── public/
│   ├── og-image.png
│   ├── _headers                     # Security headers
│   └── fonts/
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
│   └── github/
│       └── fetch-projects.ts        # משיכה מ-GitHub API → src/data/projects.json
├── src/
│   ├── content.config.ts            # Content collections: עמודי העומק של הפרויקטים (MDX)
│   ├── lib/
│   │   ├── resume.ts                # קורות חיים מאומתים לקומפוננטות (בלי אימייל; getEmailParts() בנפרד)
│   │   └── projects.ts              # projects.json מאומת לקומפוננטות (ה-schema הוא מקור הטיפוסים)
│   ├── data/
│   │   ├── resume.yaml              # ⭐ המקור היחיד לקורות החיים
│   │   ├── resume.schema.ts         # Schema ל-resume.yaml (משותף לסקריפטים ול-src/lib/resume.ts)
│   │   ├── project-page.schema.ts   # Schema ל-frontmatter של עמודי הפרויקטים
│   │   ├── projects.json            # נוצר ב-build (לא נשמר ב-git)
│   │   └── site.ts                  # הגדרות כלליות (כתובת האתר, מטא-דאטה)
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
│   │   ├── Contact.astro
│   │   ├── ArchitectureDiagram.astro
│   │   ├── ThemeToggle.astro        # רכיב Astro + סקריפט קטן, לא island
│   │   └── islands/
│   │       ├── CopyEmail.tsx
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
