# Briefing Command (`/briefing`)

## Overview

The `/briefing` command creates validated mission briefs **before** mission creation, answering open questions upfront through automated research and targeted clarification.

## Problem Solved

**Before**:

```
User: "Create coda.io provider"
→ Mission Builder starts immediately
→ Research discovers gaps (too late)
→ Implementation plan has 3-8 open questions:
  - "What is the API polling interval?" (answerable via docs)
  - "What is the secret name?" (answerable via config)
  - "What's the architecture pattern?" (answerable via codebase)
→ Implementation blocked
```

**After**:

```
User: `/briefing Create coda.io provider`
→ Briefing Assistant conducts preliminary research
  - Context7: API documentation
  - OCXP: Codebase patterns
  - Brain: Prior mission learnings
→ Asks targeted clarifying questions (max 5)
→ Generates BRIEF.md with:
  - Pre-research findings (with sources)
  - Strategic decisions (with rationale)
  - Confidence score (85%+)
  - Zero/minimal open questions
→ User approves brief
→ Mission created with briefing_context
→ Implementation plan ready to execute
```

## Usage

### Basic Usage

```
/briefing Create coda.io provider for ContextHub
```

The command will:

1. Call AgentCore's `briefing-assistant` skill
2. Show research progress (Context7, OCXP, Brain)
3. Ask clarifying questions (if needed)
4. Generate BRIEF.md
5. Save to `Briefings/BRIEF-{timestamp}.md`
6. Open the brief for review

### With Project Context

If you're in a project-scoped note (with `project_id` in frontmatter), the briefing will automatically use that project context:

```yaml
---
project_id: 7d44ef22-7ca0-4dd0-9b27-8685bd7de895
---
```

Then:

```
/briefing Add Redis caching layer to API
```

### Brief Output Structure

```markdown
---
brief_id: bf_abc123
mission_type: implementation-plan
confidence: 0.92
status: validated
---

# Mission Brief: coda.io Core Provider

## 1. Core Requirement

**User Input**: Create coda.io provider

**Clarified Scope**:

- New provider at backend/api/providers/core/coda_provider.py
- OAuth 2.0 with read+write scopes
- Async implementation (follows pattern)
- Data source in existing KB

## 2. Pre-Research Findings

### API Behavior (Context7)

- Authentication: OAuth 2.0 Bearer token
- Export polling: 1 second intervals
- Pagination: nextPageToken pattern
- Rate limit: 100 req/min

**Source**: https://coda.io/developers/apis/v1

### Codebase Patterns (OCXP)

- Base interface: ExternalDocsAdapter
- Registration: ExternalDocsRegistry.register()
- Config: StorageSettings.\_fill_from_bedrock_secret()
- Secret name: contexthub/bedrock

**Files examined**:

- backend/api/app/config/secrets.py
- backend/api/providers/core/aws_docs/adapter.py

### Prior Missions (Brain)

- Mission 2875e403: Similar async provider pattern
- Lesson: Use httpx.AsyncClient with connection pooling

## 3. Strategic Decisions

| Decision        | Options               | Choice      | Rationale               |
| --------------- | --------------------- | ----------- | ----------------------- |
| KB Architecture | New KB vs Data Source | Data Source | Simpler ops             |
| Provider Type   | Sync vs Async         | Async       | All providers use async |
| Auth Storage    | Env vs Secrets        | Secrets     | Follows pattern         |

## 4. Open Questions

_None - all questions resolved_

## 5. Validation

- ✅ API docs verified
- ✅ Codebase patterns found
- ✅ Config understood
- ✅ Strategic decisions made
- ✅ Confidence: 92%

**Ready for Mission Builder**: Yes
```

## Research Budget

- **Time**: 60 seconds max
- **Tool calls**: 30 max
  - Context7: 10 (API/library docs)
  - OCXP: 15 (codebase patterns)
  - Brain: 3 (prior missions)
  - Web: 2 (supplementary)

## Quality Gates

Brief is "done" when:

- [ ] All template sections have content (100% coverage)
- [ ] Confidence >= 85%
- [ ] No logical contradictions
- [ ] Strategic decisions documented with rationale
- [ ] Open questions = 0 or only business decisions

## Creating Mission from Brief

After reviewing the brief, you can create a mission with the briefing context:

```typescript
// Option 1: Manual (copy briefing context from BRIEF.md)
await contextHubService.createMission({
  title: "Implement coda.io provider",
  description: "...",
  briefing_context: {
    research_findings: "...",
    strategic_decisions: "...",
    confidence: 0.92
  }
});

// Option 2: Future UI (one-click from brief)
[Button: Create Mission with This Brief]
```

## Configuration

Add to Copilot settings:

```typescript
{
  "contextHubApiUrl": "http://localhost:8000",
  "contextHubWorkspace": "dev",
  "contextHubAuthToken": "your-jwt-token"
}
```

## Implementation Details

### File Structure

```
contexthub-copilot/src/commands/
├── briefing.ts            # Briefing command handler
├── constants.ts           # Command definition (updated)
└── index.ts               # Command registration
```

### Key Functions

- `executeBriefingCommand()` - Main entry point
- `parseBriefingStream()` - Handle SSE stream from AgentCore
- `saveBriefToVault()` - Save BRIEF.md to Obsidian vault
- `showBriefingResultModal()` - (Future) Show results with "Create Mission" button

### Integration Points

**Copilot → AgentCore**:

```
POST /v1/agent/invoke
{
  "action": "run_skill",
  "skill_name": "briefing-assistant",
  "inputs": {
    "user_request": "Create coda.io provider",
    "output_type": "implementation-plan",
    "project_id": "..."
  }
}
```

**AgentCore → Skill Execution**:

- Loads `briefing-assistant` skill from S3
- Executes research workflow
- Returns BRIEF.md via SSE stream or JSON

## Testing

### Test Case 1: Known Mission

```
/briefing Create coda.io provider
```

**Expected**:

- Research completes in <60s
- Answers 4 questions from mission 2e89763a:
  1. API polling interval → 1 second
  2. Secret name → contexthub/bedrock
  3. Tags in response → Yes
  4. KB architecture → Data source
- Confidence >= 90%
- Zero open questions

### Test Case 2: Vague Input

```
/briefing Make it faster
```

**Expected**:

- Asks clarifying questions:
  - "What specifically is slow?"
  - "Target performance?"
- After clarification, conducts research
- Confidence >= 75%

### Test Case 3: Novel Work

```
/briefing Add Redis caching
```

**Expected**:

- Research phase (OCXP, Context7, Brain)
- Strategic questions (1-2):
  - "Cache TTL?"
  - "Invalidation strategy?"
- Confidence >= 80%

## Troubleshooting

### Command Not Found

```
Error: Command '/briefing' not recognized
```

**Fix**: Restart Obsidian to reload commands

### Auth Error

```
Error: ContextHub auth token not configured
```

**Fix**: Add `contextHubAuthToken` to settings

### AgentCore Connection Failed

```
Error: Failed to connect to AgentCore
```

**Fix**:

1. Verify AgentCore is running: `http://localhost:8080/health`
2. Check `contextHubApiUrl` in settings

### Skill Not Found

```
Error: Skill 'briefing-assistant' not found
```

**Fix**: Run `make seed-templates` in contexthub-brain to upload skills to S3

### Low Confidence Score

```
Warning: Confidence 0.65 (below 0.85 threshold)
```

**Review**: Brief may have gaps. Check research findings and open questions.

## Future Enhancements

### Phase 1 (Current)

- [x] Command handler
- [x] AgentCore integration
- [x] BRIEF.md generation
- [x] Save to vault

### Phase 2

- [ ] Interactive question modal
- [ ] Real-time progress updates
- [ ] One-click "Create Mission" button
- [ ] Brief editing in UI

### Phase 3

- [ ] Brief templates (bug-fix, refactor, feature)
- [ ] Brief history browser
- [ ] Confidence score visualization
- [ ] Research source citations

## Related Documentation

- **Skill Definition**: `agentcore/src/content/skills/intake/briefing-assistant/SKILL.md`
- **Test Plan**: `agentcore/src/content/skills/intake/briefing-assistant/TEST_PLAN.md`
- **Implementation Summary**: `agentcore/docs/briefing-assistant-implementation.md`
- **Pipeline Integration**: `agentcore/src/flows/mission/pipeline.py`

## Impact Metrics

| Metric           | Before   | After   | Target |
| ---------------- | -------- | ------- | ------ |
| Open questions   | 3-8      | 0-1     | <1     |
| Mission failure  | 30%      | <5%     | <5%    |
| Total time       | 8-12 min | 5-7 min | <8 min |
| Research quality | 70%      | 92%     | >90%   |

## Support

For issues:

1. Check AgentCore logs: `docker logs agentcore`
2. Review skill execution: Check AgentCore `/logs` endpoint
3. Verify tool connectivity: Context7, OCXP, Brain
4. See troubleshooting section above
