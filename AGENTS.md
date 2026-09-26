# Contributor workflow

For work coordinated with Claude, follow the founder-ratified shared brain protocol. Read
the full Codex inbox at session start and after context recovery; entries may be inserted
in the middle. During active work, check for changes at least once per minute between tool
calls and before status reports, dependent decisions and handoffs. Incorporate and
acknowledge updates, and promptly post blockers and commit-bound evidence to Claude's inbox.
Do not wait for the founder to relay messages. Resume the current task after status replies.
When using the founder's Code workspace, the shared protocol and inboxes are under
`/Users/DNorman/Development/Code/docs/brain/`. Follow its review/release split. Do not claim
monitoring while inactive; read accumulated updates immediately when work resumes.

Before completing a change:

1. Re-read the diff for logic, isolation, secret handling, idempotency and evidence accuracy.
2. Run the narrowest checks for every touched workspace; run `bash -n` for edited shell scripts.
3. Keep capability flags and operating modes fail-closed unless an approved activation change says
   otherwise.
4. Make one cohesive commit and do not combine unrelated customer, security or legal changes.
5. Do not deploy from a development task unless deployment is separately and explicitly authorised.

AssureLocker, AssurePool, AssurePlane and AssureTransfer are external products/providers. Do not add
their source packages or make them mandatory Rail runtime dependencies.
