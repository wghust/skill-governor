import { basename } from "node:path";
import type { Skill } from "../models/skill.js";
import { listStructuredFiles, pathExists, readStructuredFile } from "../utils/fs.js";

const DEFAULT_SCOPE: Skill["scope"] = "workspace";
const DEFAULT_MODE: Skill["mode"] = "manual";

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.map((item) => String(item));
}

function normalizeSkill(raw: Record<string, unknown>, sourceName: string): Skill {
  const name = String(raw.name ?? sourceName);
  const description = String(raw.description ?? "");
  const domain = String(raw.domain ?? "general");
  const scope = (raw.scope as Skill["scope"]) ?? DEFAULT_SCOPE;
  const mode = (raw.mode as Skill["mode"]) ?? DEFAULT_MODE;
  const priorityValue = Number(raw.priority ?? 50);
  const priority = Number.isFinite(priorityValue) ? Math.max(0, Math.min(100, priorityValue)) : 50;

  return {
    name,
    description,
    domain,
    scope,
    mode,
    priority,
    cost: raw.cost as Skill["cost"],
    risk: raw.risk as Skill["risk"],
    tags: toStringArray(raw.tags),
    projects: toStringArray(raw.projects),
    usage:
      raw.usage && typeof raw.usage === "object"
        ? {
            lastUsedAt: (raw.usage as Record<string, unknown>).lastUsedAt
              ? String((raw.usage as Record<string, unknown>).lastUsedAt)
              : undefined,
            count: Number((raw.usage as Record<string, unknown>).count ?? 0)
          }
        : undefined
  };
}

export async function loadSkills(skillsDir: string = "skills"): Promise<Skill[]> {
  const exists = await pathExists(skillsDir);
  if (!exists) {
    return [];
  }
  const files = await listStructuredFiles(skillsDir);
  const skills: Skill[] = [];

  for (const file of files) {
    const raw = await readStructuredFile(file);
    const source = basename(file).replace(/\.[^.]+$/, "");
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item && typeof item === "object") {
          skills.push(normalizeSkill(item as Record<string, unknown>, source));
        }
      }
      continue;
    }
    if (raw && typeof raw === "object") {
      skills.push(normalizeSkill(raw as Record<string, unknown>, source));
    }
  }

  return skills;
}
