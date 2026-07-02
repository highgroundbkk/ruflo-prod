---
name: Dual-Mode Collaboration
description: Run Claude Code and Codex workers in parallel with shared memory coordination for cross-platform validation
category: Collaboration
status: BETA
version: 1.0.0-alpha
authors:
  - claude-flow-team
keywords:
  - dual-mode
  - claude-code
  - codex
  - collaboration
  - parallel-execution
  - cross-validation
applyTo:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.md"
---

# Dual-Mode Collaboration — Claude Code + Codex Hybrid Execution

Run both Claude Code (🔵) and Codex (🟢) workers in parallel with shared memory coordination for built-in cross-platform validation and complementary reasoning.

## Use When

- Multi-platform verification needed (different LLM architectures validate each other)
- Complex architecture requiring both reasoning styles
- Security-critical code needing independent review
- Performance optimization across multiple platforms
- Feature implementation with platform parity requirements

## Key Features

- **Parallel execution** — both platforms work simultaneously
- **Shared memory namespace** — cross-platform learning via AgentDB
- **Automatic cross-validation** — findings from one platform verify the other
- **Complementary strengths** — reasoning (Claude) + generation (Codex)
- **Pre-built templates** — feature, security, refactor, bugfix workflows

## Quick Start

```bash
# Run a collaboration template
npx claude-flow-codex dual run feature --task "Add OAuth login"
npx claude-flow-codex dual run security --target "./src"

# Custom multi-platform swarm
npx claude-flow-codex dual run \
  --worker "claude:architect:Design" \
  --worker "codex:coder:Implement" \
  --worker "claude:tester:Test" \
  --namespace "api-feature"
```

## Collaboration Workflow

| Stage | Claude | Codex | Next |
|-------|--------|-------|------|
| 1. Analyze | ✓ (reasoning) | - | 2 |
| 2. Design | - | ✓ (code patterns) | 3 |
| 3. Build | - | ✓ (fast gen) | 4 |
| 4. Test | ✓ (coverage analysis) | - | 5 |
| 5. Review | ✓ (security) | - | Done |

## Memory Coordination

```bash
# Store cross-platform findings
npx claude-flow memory store --namespace collaboration \
  --key "design-decisions" --value "..."

# Retrieve for other platform
npx claude-flow memory search --namespace collaboration \
  --query "authentication patterns"
```

## Related

- [`github-code-review`](../github-code-review/SKILL.md) — AI code review with swarm
- [`pair-programming`](../pair-programming/SKILL.md) — Session-based pair programming
- [`swarm-orchestration`](../swarm-orchestration/SKILL.md) — Multi-agent coordination

## References

- **ADR-127**: GitHub skills modernization
- **ADR-128**: Init bundle refactoring (Phase 0 foundation)
- **RFC**: Dual-mode collaboration protocol (in progress)
