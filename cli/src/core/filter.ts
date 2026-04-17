import type { Profile } from "../models/profile.js";
import type { RoutingContext, Skill } from "../models/skill.js";

export function filterByScope(skills: Skill[], context: RoutingContext): Skill[] {
  return skills.filter((skill) => {
    if (skill.scope === "global") {
      return true;
    }
    if (skill.scope === context.scope) {
      return true;
    }
    // workspace skills can serve session/task level requests.
    return skill.scope === "workspace" && (context.scope === "session" || context.scope === "task");
  });
}

export function filterByMode(skills: Skill[], routeMode: "auto" | "manual" = "auto"): Skill[] {
  return skills.filter((skill) => {
    if (skill.mode === "off") {
      return false;
    }
    if (routeMode === "auto") {
      return skill.mode === "auto";
    }
    return true;
  });
}

export function filterByProfile(skills: Skill[], profile?: Profile, routeMode: "auto" | "manual" = "auto"): Skill[] {
  if (!profile) {
    return skills;
  }
  const disabled = new Set(profile.disabled);
  const manualOnly = new Set(profile.manualOnly);
  const autoEnabled = new Set(profile.autoEnabled);

  return skills.filter((skill) => {
    if (disabled.has(skill.name)) {
      return false;
    }
    if (routeMode === "auto" && manualOnly.has(skill.name)) {
      return false;
    }
    if (routeMode === "auto" && autoEnabled.size > 0 && !autoEnabled.has(skill.name) && skill.mode !== "auto") {
      return false;
    }
    return true;
  });
}

export function classifyDomain(input: string): string {
  const lowered = input.toLowerCase();
  const rules: Array<{ domain: string; keys: string[] }> = [
    { domain: "frontend", keys: ["react", "next", "css", "ui", "component"] },
    { domain: "backend", keys: ["api", "server", "database", "sql", "redis"] },
    { domain: "devops", keys: ["deploy", "k8s", "docker", "ci", "cd"] },
    { domain: "seo", keys: ["seo", "meta", "schema", "google"] }
  ];

  for (const rule of rules) {
    if (rule.keys.some((key) => lowered.includes(key))) {
      return rule.domain;
    }
  }
  return "general";
}

export function filterByDomain(skills: Skill[], domain: string): Skill[] {
  if (domain === "general") {
    return skills;
  }
  const selected = skills.filter((skill) => skill.domain === domain || skill.tags?.includes(domain));
  return selected.length > 0 ? selected : skills;
}
