# Skills have moved

The Claude Agent Skills that used to live in this folder (`noble-admin`, `noble-email`, `expert-permitted-development-check`, and the nested `das-writer`) were consolidated on 2026-09-19 into the shared, version-controlled repo:

**`D:\08__Cloud__Repo__AgentSkills__Private`**
GitHub: [Adam-Noble-01/08__Cloud__Repo__AgentSkills__Private](https://github.com/Adam-Noble-01/08__Cloud__Repo__AgentSkills__Private)

See that repo's own README for the full skill list, the category structure, and the naming rules.

To make a skill available in this project again, copy (or symlink) the specific skill folder from its category subfolder in that repo into here, flat — for example:

```
D:\08__Cloud__Repo__AgentSkills__Private\21-na-admin-system-skills\noble-email
  →  D:\WE10_--_Public-Repo_--_Live-Website\.claude\skills\noble-email
```

Claude Code only discovers a skill when its `SKILL.md` sits directly one level below this `skills` folder — don't recreate category-subfolder nesting here, it silently won't be picked up.

## What's still here, and why

- `02__PlanningApplicationProduction/02__DesignAndAccessStatement__GoldStandard/` — a real finished project exemplar (photos, PDF, HTML/MD) that the DAS-writer skill's own bundled example was drawn from. Left in place: it's project reference material, not skill infrastructure.
- `02__PlanningApplicationProduction/03__ProjectLinks/` — a shortcut into a specific project folder. Left in place for the same reason.
- `Artifacts/planvision-file-naming-guide/` — a rendered HTML demo, not real skill source (Claude Code already ships an equivalent built-in `planvision-file-naming` skill). Left as-is, not migrated.
- `skills - LocalShortcut.lnk` — a Windows shortcut back to the machine's global `.claude/skills` folder. Just a navigation aid, left in place.
