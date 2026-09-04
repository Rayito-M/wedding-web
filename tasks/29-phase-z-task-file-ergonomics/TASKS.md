## Phase Z — Task-file ergonomics (no ADR; this is tooling, not a decision)

### T346 — Split `TASKS.md` into `tasks/<phase>/`, with an index
- **Status:** done — 2026-09-04. Run **mid-phase after all**, on the Product Owner's call: the
  interim `tasks/reports/` location was already producing reports in the wrong place (T263's landed
  there), so waiting for Phase X to close meant accumulating more of them to move. 150 tasks across
  29 phase directories, verified none lost and none added by diffing the `### T…` headings before
  and after. Directories carry an ordinal prefix as well as the phase letter — four sections predate
  the lettering, so letters alone neither sort nor uniquely name them; that is a deviation from this
  task's literal `phase-<letter>-<slug>`, recorded here rather than left to be noticed.
- **Target release:** 1.2.0
- **Owner:** unassigned
- **Why:** `TASKS.md` is past 7,400 lines and 100+ tasks. Nothing but `grep` reaches into it, and
  finding a task by number means scrolling. The file is also where every phase's history accumulates
  with no natural place to put a task's report.
- **Acceptance:**
  - `tasks/<phase-slug>/TASKS.md`, one directory per `## Phase` heading, named
    `phase-<letter>-<slug>` so directories sort chronologically and read meaningfully
  - `tasks/README.md` is the **index**, and is the reason this is worth doing: one row per task —
    number, title, status, phase directory. Task numbers are global and cited bare across repos and
    ADRs ("`wedding-web` T341"), and nothing in a number says which phase holds it. Without the
    index this trades one large file for a directory you have to search
  - `tasks/<phase-slug>/reports/T<N>.json` — where an implementer's report lands, validating against
    the hub's `task-report.schema.json`. Reports in a subdirectory, not beside `TASKS.md`, so a phase
    with a dozen tasks does not bury its own task list
  - Every task's text is moved **verbatim**. No renumbering, no rewording, no status changes, no
    tasks dropped — including the void T260–T263 entries, which stay void and stay explained
  - The root `TASKS.md` becomes a stub pointing at `tasks/README.md`, so existing links and habits
    do not dead-end
  - References updated: `CLAUDE.md`, `.agents/agents/*.md`, and the hub's
    `.agent/skills/task-management.md` § 1 table
- **Non-goals:** no change to task content, numbering, status or phase membership — this is a move,
  and a reviewer should be able to confirm that with `git log --follow` and a word count
- **Refs:** hub `.agent/skills/task-management.md`; `wedding-api` T243 (the same split, same layout)
