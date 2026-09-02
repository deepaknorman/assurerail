# AssureRail AR-21 deployer handoff

**Authorisation:** EX-28 permits implementation, commit and push; it does not authorise deployment
or activation.

## 1. Default deployment

Leave both new flags off:

```text
ARAIL_HOSTED_ALPHA_V1=off
NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1=off
```

The web value is a build argument. A runtime-only web environment change will not alter an already
built client bundle. The API value is checked at startup and mounts no hosted-alpha module while
off.

AR-21 adds no database migration. Continue to run the standard AssureRail venue migration step on
every rebuild so schema drift in its dependencies is detected.

## 2. Approved shadow preparation

Do not use this section without separate deployment/activation instruction. If a replay/shadow
cohort is later approved, prerequisites are:

```text
ASSURERAIL_OPERATING_MODE=SHADOW
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_TRANSACTION_CASE_V1=shadow
ARAIL_HOSTED_ALPHA_V1=shadow
NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1=shadow
NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1=shadow
```

All existing authentication, database and provider-safe SHADOW prerequisites continue to apply.
Do not change unrelated PR-13–PR-20 flags merely to populate the queue; unavailable task families
must stay absent/unavailable.

## 3. Smoke evidence after an authorised deployment

1. Confirm `/healthz` and `/readyz` return success and the runtime profile says `SHADOW`.
2. With the new flags off, verify `/workspace/tasks` reports the feature disabled and the API route
   is not mounted.
3. In an approved shadow build, sign in as a member of institution A and verify the action centre
   returns only institution A's records.
4. Attempt institution B's path while A is active and confirm `403`.
5. Use a member without an applicable action and confirm its corresponding task is absent.
6. Confirm clicking a task still fails at the destination when the user lacks the destination
   authority.
7. Confirm an ordinary participant never calls `/venue/activity`; an administrator with no active
   institution may still use the separate platform activity view.
8. Confirm critical/overdue counts and the first six header items agree with the dedicated action
   centre response.

Retain request IDs, actor/institution IDs, timestamps, status codes and screenshots without
customer-confidential content. Do not record a green smoke check as customer acceptance.

## 4. Rollback

Set both hosted-alpha flags to `off`, rebuild the web image and restart the API/web using the normal
deployment process. The action centre is a read model and has no AR-21 persistence to reverse.
Existing PR-03–PR-20 records are left intact. Do not roll back the database or delete source
records.

## 5. Known open gates

Customer/trustee workflow validation, negative multi-tenant DB tests, accessibility testing,
notification-channel consent/delivery, VAPT and controlled-live/production approval remain open.
