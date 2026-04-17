## 1. Projection Model
- [x] 1.1 Define runtime projection artifact schema and store paths
- [x] 1.2 Define effective skill resolution rules from state, profiles, and duplicate outcomes

## 2. Runtime Projection Engine
- [x] 2.1 Implement effective runtime skill resolution
- [x] 2.2 Generate provider-specific runtime projection artifacts under `.skill-governor/runtime/`
- [x] 2.3 Include included and excluded reasons in projection outputs

## 3. Apply Integration
- [x] 3.1 Refresh runtime projections automatically after successful apply
- [x] 3.2 Ensure rollback restores or regenerates consistent runtime projections

## 4. CLI Surface
- [x] 4.1 Add a command to inspect or regenerate runtime projections
- [x] 4.2 Extend reporting to summarize effective runtime skill sets by provider

## 5. Verification
- [x] 5.1 Add tests for effective runtime resolution
- [x] 5.2 Add tests for apply-driven projection refresh
- [x] 5.3 Validate the new change with `openspec validate --strict`
