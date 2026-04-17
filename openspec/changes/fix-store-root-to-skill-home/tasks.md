## 1. Store Path Resolution
- [x] 1.1 Add a resolver for the installed `skill-governor` skill home
- [x] 1.2 Change default governance store paths to `<skill-home>/.skill-governor/<scope>/`
- [x] 1.3 Keep `--store-root` as an explicit override

## 2. Command Integration
- [x] 2.1 Update optimize/apply/rollback/profile/projection/report to use the skill-owned default store
- [x] 2.2 Ensure scope chooses the scoped subdirectory rather than the governed project root

## 3. Legacy Handling
- [x] 3.1 Detect legacy workspace-local `.skill-governor/` stores
- [x] 3.2 Add migration guidance or safe migration support

## 4. Documentation And Tests
- [x] 4.1 Update SKILL/docs text so storage ownership is described correctly
- [x] 4.2 Add tests for source-tree and packaged-runtime store resolution
- [x] 4.3 Validate the change with `openspec validate --strict`
