# 🏛️ Architecture & Defense Specification

## 1. What to Say to Mentors & Reviewers

> *"Plugins are our architecture. The agent features **8 safe plugins** — brief parser, sandbox generator, concept lookup, screenshot server, teach-back checker, hint progression, progress tracker, and session logger.*
>
> *It **refuses** file access, code execution, and SQL runners. That is not a bug — that is the product. The absence of those plugins is what guarantees that students actually learn and cannot use the system as a cheating tool."*

---

## 2. The Defensive Moat

```
[Student Input]
      │
      ▼
[Refusal Guardrail Interceptor] ──(Matched Cheating Pattern)──► [Instant Socratic Refusal & Audit Log]
      │
      ▼ (Pedagogical Request)
[Socratic Orchestrator]
      │
      ├──► [brief_parser] ────────► Task Objectives Only (Zero Data Rows)
      ├──► [concept_lookup] ──────► 7 Battle Cards & Diagnoses
      ├──► [hint_progression] ────► 3 Scaffolding Tiers (L1 → L2 → L3)
      ├──► [sandbox_generator] ───► Synthetic Practice .CSV Files (100% Mock Data)
      ├──► [teach_back_checker] ──► Explanations Evaluated (Grades Technical Understanding)
      └──► [session_logger] ──────► Immutable Receipts (Proof of Zero Ingestion)
```

---

## 3. POPIA & Data Privacy Compliance
1. **Zero-Knowledge Architecture**: The application never touches or writes student files.
2. **Ephemeral Memory**: Questions asked during a session are stored only for pedagogical scaffolding.
3. **Synthetic Isolation**: Practice exercises only operate on mock companies and generated figures.
