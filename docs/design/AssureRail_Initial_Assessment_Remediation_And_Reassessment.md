# AssureRail Initial Assessment remediation and reassessment

**Status:** implemented in the shadow assessment workspace  
**Product boundary:** Initial Assessment only; Portfolio Preparation retains qualified expert review

## Customer path

1. The seller accepts and pays for the quoted Initial Assessment scope.
2. AssureRail processes the admitted evidence and releases an automated, unsigned result without human content review or professional sign-off.
3. Every detected gap is recorded with a stable key, category, severity, required evidence types and a controlled seller-owner role. Exact seller–loan–party pairs are shown only when the admitted loan tape establishes them. Other gaps are marked portfolio-wide rather than attributed speculatively.
4. The seller uploads a corrected version or new evidence. Replacement uploads remain part of the same evidence family and version history.
5. An authorised seller user assigns the gap to a controlled role and binds the clean, current corrected evidence using step-up authentication.
6. The seller requests a comparable reassessment against the latest released Initial Assessment. The server verifies the accepted scope digest, correction lineage, evidence manifest, allowance and window.
7. The new automated report records resolved, continuing and new gaps and the before/after tape-quality state.

## Commercial and operating controls

- The paid Initial Assessment includes the first automated assessment and three same-scope automated reassessments within 30 days of the first released assessment.
- The 30-day boundary is exclusive: a request at or after the same instant on day 30 is outside the included allowance.
- A reassessment must use corrected or additional evidence created after the source assessment and must include every evidence version attached to the selected remediation items.
- A changed corpus, asset family, quoted seller–loan–borrower/co-borrower count, linked-party count, book reference or book date requires a new quote. The immutable accepted scope and quote digest form the reassessment scope digest.
- Exhaustion or expiry does not close the workspace, delete evidence or block uploads. A later processing run requires a revised order or run charge.
- Initial Assessment has no human content reviewer. Human professional review and sign-off begin in Portfolio Preparation.

## Authority and isolation

- Read operations require the active institution and evidence-view authority.
- Upload, remediation planning and reassessment requests require the active institution, customer-operations management, evidence-management authority and step-up authentication.
- Evidence versions, remediation items and runs are checked against the engagement's seller institution. Cross-institution identifiers return no usable object.
- Correction evidence must be current, valid, clean, within retention and scoped to the same engagement.

## Known boundary

Affected pair lists contain seller-scoped internal loan and party identifiers, not an assertion about legal identity. Document and AI findings remain portfolio-wide until a deterministic source mapping establishes individual affected pairs. The feature does not alter buyer diligence, guarantee readiness or create a legal, credit or assurance opinion.
