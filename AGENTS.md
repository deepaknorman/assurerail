# Contributor workflow

Before completing a change:

1. Re-read the diff for logic, isolation, secret handling, idempotency and evidence accuracy.
2. Run the narrowest checks for every touched workspace; run `bash -n` for edited shell scripts.
3. Keep capability flags and operating modes fail-closed unless an approved activation change says
   otherwise.
4. Make one cohesive commit and do not combine unrelated customer, security or legal changes.
5. Do not deploy from a development task unless deployment is separately and explicitly authorised.

AssureLocker, AssurePool, AssurePlane and AssureTransfer are external products/providers. Do not add
their source packages or make them mandatory Rail runtime dependencies.
