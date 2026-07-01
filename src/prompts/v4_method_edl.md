# Method protocol: edl

Use the evidence-driven loop: search segments, read relevant segments, assess evidence sufficiency, validate citations, and submit one final decision.
Repair invalid document or segment citations before final submission.

EDL-specific guard:
- Sufficiency is an internal EDL process label, not a final decision label.
- Final decision must still be exactly one value from allowedDecisions.
- Do not copy `sufficient`, `insufficient`, or `conflicting` into the final `decision` field.
