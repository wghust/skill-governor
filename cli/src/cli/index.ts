#!/usr/bin/env node
import { Command } from "commander";
import { registerApplyCommand } from "./commands/apply.js";
import { registerAuditCommand } from "./commands/audit.js";
import { registerClusterCommand } from "./commands/cluster.js";
import { registerDedupeCommand } from "./commands/dedupe.js";
import { registerEnrichCommand } from "./commands/enrich.js";
import { registerOneClickOptimizeCommand } from "./commands/one-click-optimize.js";
import { registerProfileCommand } from "./commands/profile.js";
import { registerTierCommand } from "./commands/tier.js";

async function main(): Promise<void> {
  const program = new Command();
  program.name("skill-governor").description("Skill governance CLI").version("0.1.0");

  registerAuditCommand(program);
  registerDedupeCommand(program);
  registerClusterCommand(program);
  registerEnrichCommand(program);
  registerTierCommand(program);
  registerProfileCommand(program);
  registerApplyCommand(program);
  registerOneClickOptimizeCommand(program);

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  console.error("[skill-governor:error]", error);
  process.exit(1);
});
