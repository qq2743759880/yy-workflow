---
name: review
version: 3.2.0
description: Matt change review plus YY existing-code audit, seven-element findings and backend evidence. Requires an explicit review mode and its evidence anchors.
---
# Review — admitted evidence bridge

Use [METHODOLOGY.json](METHODOLOGY.json) as the sole methodology binding. Change review uses byte-pinned Matt code-review; provide its fixed base revision. YY does not repeat its Standards/Spec process.
For no-diff existing-code audit, set review_mode=existing_code_audit and provide scope plus version/snapshot. Read [audit boundary](reference/existing-code-audit.md); do not attribute existing defects to a change without a base.
Use [seven-element findings](templates/finding-template.md) for findings. Backend/HTTP behavioral evidence loads [be-tester](agents/be-tester.md) only when requested; that resource is not a launched independent process.
No anchors means MISSING_METHOD_CONTEXT. Missing evidence cannot be invented. Return artifact/evidence refs; methodology_application remains UNVERIFIED.
