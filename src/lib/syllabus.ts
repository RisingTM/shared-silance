// Parser for the studying syllabus paste format.
// # Module
// - Branch
// item line
//
// Returns { ok: true, modules } or { ok: false, error, line }.

export type Branch = { name: string; items: string[] };
export type Module = { name: string; branches: Branch[] };
export type ParseResult =
  | { ok: true; modules: Module[] }
  | { ok: false; error: string; line: number };

export function parseSyllabus(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const modules: Module[] = [];
  let curMod: Module | null = null;
  let curBranch: Branch | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#")) {
      const name = line.replace(/^#+\s*/, "").trim();
      if (!name) return { ok: false, error: "Empty module name", line: i + 1 };
      curMod = { name, branches: [] };
      modules.push(curMod);
      curBranch = null;
    } else if (line.startsWith("-")) {
      if (!curMod)
        return { ok: false, error: "Branch defined before any module (#)", line: i + 1 };
      const name = line.replace(/^-+\s*/, "").trim();
      if (!name) return { ok: false, error: "Empty branch name", line: i + 1 };
      curBranch = { name, items: [] };
      curMod.branches.push(curBranch);
    } else {
      if (!curBranch)
        return { ok: false, error: "Item defined before any branch (-)", line: i + 1 };
      curBranch.items.push(line);
    }
  }

  if (modules.length === 0)
    return { ok: false, error: "No modules found. Use # to start one.", line: 1 };
  return { ok: true, modules };
}

export function itemKey(mod: string, branch: string, item: string): string {
  return `${mod}\u200b/${branch}\u200b/${item}`;
}

export function moduleKeys(modules: Module[]): string[] {
  const out: string[] = [];
  for (const m of modules) for (const b of m.branches) for (const it of b.items)
    out.push(itemKey(m.name, b.name, it));
  return out;
}

export function syllabusToText(modules: Module[]): string {
  const lines: string[] = [];
  for (const m of modules) {
    lines.push(`# ${m.name}`);
    for (const b of m.branches) {
      lines.push(`- ${b.name}`);
      for (const it of b.items) lines.push(it);
    }
  }
  return lines.join("\n");
}
