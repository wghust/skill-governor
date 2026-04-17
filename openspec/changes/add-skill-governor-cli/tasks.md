## 1. Specification And Contracts
- [x] 1.1 Define the `skill-governance` capability requirements and scenarios
- [x] 1.2 Define the CLI command surface and JSON output contracts
- [x] 1.3 Define registry, plan, profile, state, and snapshot formats

## 2. Discovery And Registry
- [x] 2.1 Implement a provider adapter interface for skill discovery
- [x] 2.2 Implement built-in adapters for `cursor`, `codex`, and `claude`
- [x] 2.3 Implement `SKILL.md` discovery and metadata normalization
- [x] 2.4 Persist the normalized registry for list, inspect, audit, dedupe, and cluster flows

## 3. Governance Engine
- [x] 3.1 Implement audit summary generation
- [x] 3.2 Implement duplicate grouping and merge suggestions
- [x] 3.3 Implement domain and heuristic cluster generation
- [x] 3.4 Implement optimization policies and governance plan generation

## 4. State Management
- [x] 4.1 Implement dry-run plan persistence
- [x] 4.2 Implement apply flow with mandatory snapshot creation
- [x] 4.3 Implement rollback for the latest or specified snapshot
- [x] 4.4 Implement profile activation and state switching for user and workspace scopes

## 5. Skill Entry And Reporting
- [x] 5.1 Author the `/skill-governor` `SKILL.md`
- [x] 5.2 Add natural-language intent mapping and safety rules for CLI invocation
- [x] 5.3 Implement Markdown and JSON report generation
- [x] 5.4 Add tests for discovery, planning, apply, rollback, and explainability
