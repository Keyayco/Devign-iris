AGENT HANDOVER PROTOCOL

Purpose: Preserve project knowledge and implementation continuity when transferring work between AI agents, development environments, or human collaborators.

Applies to: All Devign projects using this protocol.

1. Core principle

Agents are replaceable. Project knowledge is not.

The repository is the source of truth. Conversations, temporary workspaces, generated patches and an individual agent's memory are not authoritative.

A handover must allow another agent to continue the work without reconstructing the entire previous conversation.

2. Before accepting a task

The incoming agent must:

1. Identify the repository and project.
2. Inspect the current branch and latest commit.
3. Read the project's "README.md", "RULES.md", "STATE.md", "HANDOVER.md" and "LOGS.md", where present.
4. Check the file manifest and architecture documentation, where present.
5. Identify the approved task and its boundaries.
6. Check whether the workspace contains uncommitted changes or work from another agent.

Do not assume that a previous agent's description accurately represents the current repository.

If documentation conflicts with the actual code, report the discrepancy before making changes.

3. Required handover record

Every substantial transfer of work must communicate the following.

A. Project identity

- Project name.
- Repository URL.
- Active branch.
- Base commit or revision.
- Date of handover.

B. Task and approval

- Original task or objective.
- Scope approved by the owner.
- Explicit exclusions.
- Decisions still requiring owner approval.

C. Work completed

- Summary of completed work.
- Exact files added, modified or deleted.
- Important implementation decisions.
- Dependencies or integrations introduced, if any.

D. Verification

For every check, state:

- What was tested.
- How it was tested.
- Actual result.
- Any failures or limitations.

Distinguish between:

- Implemented — code or documentation was written.
- Tested — a test was actually executed.
- Verified — the intended behaviour was independently confirmed.
- Committed — changes exist in the stated repository revision.
- Deployed — the deployment was confirmed.

Never treat one status as proof of another.

E. Outstanding work

- Known defects.
- Unverified behaviour.
- Blockers.
- Outstanding decisions.
- Work intentionally left incomplete.

F. Next action

Give the incoming agent one specific first action.

Do not leave the next agent with a vague instruction such as "continue development".

4. Workspace and Git safety

- The latest repository state takes precedence over an old local workspace.
- Inspect branch, commit and working-tree status before editing.
- Never blindly apply an old patch to a newer revision.
- Never overwrite uncommitted work without investigating it.
- Preserve unrelated changes.
- Do not claim a push, merge or deployment without confirmation.
- If a conflict occurs, stop and report the conflict rather than silently choosing which work to discard.
- Use the repository's established contribution and delivery process.

5. Incoming agent responsibilities

The incoming agent must:

1. Read the handover and verify its important claims against the repository.
2. Identify anything missing or contradictory.
3. Confirm the approved scope.
4. State its understanding of the next action.
5. Continue from the actual repository state, not the previous agent's assumptions.

If essential information is missing, ask the owner rather than inventing it.

6. Outgoing agent responsibilities

Before handing over, the outgoing agent must:

1. Stop work at a clearly identifiable point.
2. Record the actual repository and revision.
3. Document completed and incomplete work.
4. Record tests and their actual outcomes.
5. Identify uncommitted changes and their location.
6. Update relevant project documentation.
7. Provide the incoming agent with its exact first action.

Do not leave undocumented changes in a temporary workspace and describe the task as complete.

7. Handover template

Use this template for substantial agent transfers.

PROJECT HANDOVER

Project:

Repository:

Branch:

Base commit:

Date:

Outgoing agent:

Incoming agent:

Objective

What were we trying to achieve?

Approved scope

What was authorised, and what was excluded?

Completed work

What has actually been done?

Files changed

File| Change| Status
| | 

Verification

Check| Result| Notes
| | 

Current state

What works now? What does not?

Outstanding work

What remains unfinished?

Risks and blockers

What should the next agent be careful about?

Owner decisions

What requires approval or clarification?

Next action

What is the exact first task for the incoming agent?

Important references

Link relevant commits, pull requests, documentation and test results.

8. Handover completion

A handover is complete when the incoming agent can identify:

- What the project is.
- Where the authoritative code lives.
- What has already been completed.
- What has actually been verified.
- What remains outstanding.
- What it is authorised to do next.

The incoming agent should not need the outgoing agent's conversation history to understand the task.

---

Golden rule: Transfer the state of the project, not just the story of the conversation.