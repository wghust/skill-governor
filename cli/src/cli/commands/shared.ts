import { join } from "node:path";
import type { AuditReport, GovernanceReport } from "../../models/report.js";
import type { Profile, ProfileApplyResult } from "../../models/profile.js";
import type { Skill } from "../../models/skill.js";
import { ensureDir, listStructuredFiles, pathExists, readStructuredFile, writeJson, writeText, writeYaml } from "../../utils/fs.js";
import { logger } from "../../utils/logger.js";

export const SKILLS_DIR = "skills";
export const PROFILES_DIR = "profiles";
export const REPORTS_DIR = "reports";
export const STATE_DIR = ".skill-governor";
export const SNAPSHOT_DIR = join(STATE_DIR, "snapshots");
export const ACTIVE_STATE_FILE = join(STATE_DIR, "active-state.json");

export function auditSkills(skills: Skill[]): AuditReport {
  const scopeDistribution: Record<string, number> = {};
  let autoCount = 0;
  let manualCount = 0;
  let offCount = 0;
  for (const skill of skills) {
    scopeDistribution[skill.scope] = (scopeDistribution[skill.scope] ?? 0) + 1;
    if (skill.mode === "auto") {
      autoCount += 1;
    } else if (skill.mode === "manual") {
      manualCount += 1;
    } else {
      offCount += 1;
    }
  }

  const suggestions: string[] = [];
  if (autoCount > Math.max(10, skills.length * 0.25)) {
    suggestions.push("Auto-enabled skills are high; consider reducing auto set to a smaller core.");
  }
  if ((scopeDistribution.global ?? 0) > Math.max(5, skills.length * 0.2)) {
    suggestions.push("Many global skills detected; scope down to workspace/session where possible.");
  }
  if (offCount === 0 && skills.length > 0) {
    suggestions.push("No disabled skills found; consider turning long-tail skills off.");
  }
  if (suggestions.length === 0) {
    suggestions.push("Governance state looks balanced. Keep monitoring usage trends.");
  }

  return { totalSkills: skills.length, autoCount, manualCount, offCount, scopeDistribution, suggestions };
}

export async function loadProfiles(dir: string = PROFILES_DIR): Promise<Profile[]> {
  if (!(await pathExists(dir))) {
    return [];
  }
  const files = await listStructuredFiles(dir);
  const profiles: Profile[] = [];
  for (const file of files) {
    const raw = await readStructuredFile(file);
    const entries = Array.isArray(raw) ? raw : [raw];
    for (const item of entries) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const obj = item as Record<string, unknown>;
      profiles.push({
        name: String(obj.name ?? "default"),
        autoEnabled: Array.isArray(obj.autoEnabled) ? obj.autoEnabled.map(String) : [],
        manualOnly: Array.isArray(obj.manualOnly) ? obj.manualOnly.map(String) : [],
        disabled: Array.isArray(obj.disabled) ? obj.disabled.map(String) : []
      });
    }
  }
  return profiles;
}

export async function saveProfile(profile: Profile, dir: string = PROFILES_DIR): Promise<string> {
  await ensureDir(dir);
  const file = join(dir, `${profile.name}.yaml`);
  await writeYaml(file, profile);
  return file;
}

export function buildProfile(name: string, skills: Skill[]): Profile {
  return {
    name,
    autoEnabled: skills.filter((s) => s.mode === "auto").map((s) => s.name),
    manualOnly: skills.filter((s) => s.mode === "manual").map((s) => s.name),
    disabled: skills.filter((s) => s.mode === "off").map((s) => s.name)
  };
}

export async function applyProfile(profile: Profile, skills: Skill[]): Promise<ProfileApplyResult> {
  await ensureDir(STATE_DIR);
  await ensureDir(SNAPSHOT_DIR);
  const now = new Date().toISOString();
  const snapshotPath = join(SNAPSHOT_DIR, `skills-${now.replace(/[:.]/g, "-")}.json`);
  await writeJson(snapshotPath, skills);

  try {
    const auto = new Set(profile.autoEnabled);
    const manual = new Set(profile.manualOnly);
    const disabled = new Set(profile.disabled);

    const updated = skills.map((skill) => {
      if (disabled.has(skill.name)) {
        return { ...skill, mode: "off" as const };
      }
      if (auto.has(skill.name)) {
        return { ...skill, mode: "auto" as const };
      }
      if (manual.has(skill.name)) {
        return { ...skill, mode: "manual" as const };
      }
      return { ...skill, mode: "manual" as const };
    });

    await writeJson(
      ACTIVE_STATE_FILE,
      {
        activeProfile: profile.name,
        appliedAt: now,
        snapshotPath,
        skills: updated
      }
    );

    return {
      profile: profile.name,
      appliedAt: now,
      snapshotPath,
      statePath: ACTIVE_STATE_FILE
    };
  } catch (error) {
    logger.error("Apply failed, restoring snapshot", error);
    const previous = await readStructuredFile(snapshotPath);
    await writeJson(ACTIVE_STATE_FILE, {
      activeProfile: "rollback",
      appliedAt: now,
      snapshotPath,
      skills: previous
    });
    throw error;
  }
}

export async function saveGovernanceReport(
  report: GovernanceReport,
  markdown: string,
  reportName: string = "governance-report"
): Promise<{ jsonPath: string; mdPath: string }> {
  await ensureDir(REPORTS_DIR);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(REPORTS_DIR, `${reportName}-${stamp}.json`);
  const mdPath = join(REPORTS_DIR, `${reportName}-${stamp}.md`);
  await writeJson(jsonPath, report);
  await writeText(mdPath, markdown);
  return { jsonPath, mdPath };
}

export function renderGovernanceMarkdown(report: GovernanceReport): string {
  const duplicateLines = report.duplicates.length > 0 ? report.duplicates.map((g) => `- ${g.join(" / ")}`).join("\n") : "- none";
  const clusterLines =
    Object.keys(report.clusters).length > 0
      ? Object.entries(report.clusters)
          .map(([domain, names]) => `- **${domain}**: ${names.join(", ")}`)
          .join("\n")
      : "- none";
  const suggestionLines = report.suggestions.length > 0 ? report.suggestions.map((line) => `- ${line}`).join("\n") : "- none";
  return `# Skill Governance Report

## Skill Distribution
- Total skills: ${report.totalSkills}
- Auto before: ${report.autoBefore}
- Auto after: ${report.autoAfter}
- Manual: ${report.manualCount}
- Disabled: ${report.disabledCount}

## Duplicate Analysis
${duplicateLines}

## Clusters
${clusterLines}

## Suggestions
${suggestionLines}
`;
}
