# 🎓 Socratic Data Analysis Tutor

> **"The speed of ChatGPT. The discipline of a tutor. It answers instantly — just not with the answer."**

A serious React + TypeScript AI workspace designed for data analytics training programs (CAPACITI / UCT / corporate bootcamps). It delivers instant, conversational AI guidance while enforcing **100% cheat-proof pedagogical discipline**.

---

## ⚡ The Core Philosophy

When a student struggles with an Excel error or cleaning roadblock, standard LLMs (ChatGPT/Claude) are a cheating vector: they output raw cleaned files and formulas, depriving the student of cognitive learning. Google is dead: slow, link-heavy, and passive.

**The Socratic Tutor resolves the tension:**
- **ChatGPT Speed & Conversational Feel**: Instant replies, streaming tokens, natural conversational flow.
- **Socratic Pedagogy**: Never outputs deliverables, raw copy-paste solutions, or cleaned files. Guides the student through questions and mental models.
- **8 Safe Plugins**: Isolated capabilities with zero access to student files or code execution engines.

---

## 🛡️ The 8 Safe Plugins (Cheat-Proof Architecture)

| Plugin | What It Does | Why It's Cheat-Proof |
|---|---|---|
| `brief_parser` | Parses assignment prompt text to match learning objectives | Sees questions only — zero data rows |
| `concept_lookup` | Serves the 7 core Data Cleaning Battle cards | Static diagnostic teaching content |
| `hint_progression` | Enforces 3-tier scaffolding (L1 Concept → L2 Excel Feature → L3 Pseudo-syntax) | Controls cognitive load |
| `sandbox_generator` | Generates synthetic practice spreadsheets with fake data | 100% fake dummy data — impossible to submit |
| `screenshot_provider` | Serves ASCII/visual schematics of Excel memory allocation | Visual diagrams on mock tables only |
| `teach_back_checker` | Rubric engine verifying the student's verbal/written explanation | Forces understanding before marking passed |
| `progress_tracker` | Tracks completion across the 7 Data Cleaning Battles | Builds learning mastery record |
| `session_logger` | Logs tamper-proof receipts of refusals and teach-backs | Audit trail proving zero cheating occurred |

### ❌ The Banned Vector (Deliberately Absent)
1. **NO `file_reader`**: The agent cannot read student spreadsheets.
2. **NO `file_writer`**: The agent cannot generate submission deliverables.
3. **NO `pandas_executor`**: The agent cannot run data cleaning code.
4. **NO `code_interpreter`**: It cannot run scripts on assignment data.

---

## ⚔️ The 7 Battles of Excel Data Cleaning

1. **Floating-Point Drift**: When `0.1 + 0.2` fails `VLOOKUP` and exact matching due to IEEE 754 precision tails.
2. **Merged Headers Trap**: Why merging `B1:D1` turns columns `C` and `D` into `NULL` ghosts for Power Query/Pandas.
3. **Multi-Row Headers**: Flattening 2-tier reporting matrices into single-vector column schemas.
4. **Stale Formulas**: Diagnosing manual calculation mode and unrefreshed PivotTable caches.
5. **Format Break**: Why text-formatted numbers cause `SUM()` to return 0 and dates sort alphabetically.
6. **Blank vs. Zero**: How empty cells vs. literal `0` drastically distort business averages and KPIs.
7. **Naming Inconsistency**: Purging non-breaking spaces (`CHAR(160)`), casing mismatches, and regional aliases.

---

## 💎 Frontend Features (@assistant-ui Elements)

- **Streaming Text (`@assistant-ui/elements-streaming-text`)**:
  - Tokens arrive softly: newest 2 words are tinted electric blue with an active blinking caret.
  - As words age past the trailing window, they settle into ink over 700ms.
- **Thinking Indicator (`@assistant-ui/elements-thinking-indicator`)**:
  - Pulsing electric blue dot.
  - Shimmer label that updates dynamically based on the active tool state (*"Checking Refusal Guardrails"*, *"Consulting Concept Card"*, *"Formulating Socratic Guidance"*).
  - Live elapsed badge ticking seconds (`0s`, `1s`, `2s`...).
- **Practice Sandbox Hub**: Download 1-click synthetic `.csv` files to test solutions safely.
- **Teach-Back Modal**: Submit technical reasoning to earn battle mastery.
- **Audit & Receipts Counter**: Live tally of intercepted cheating attempts.

---

## 🚀 Running the App Locally

### Prerequisites
- Node.js 18+
- npm 9+

### Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
