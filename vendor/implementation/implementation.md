---
name: implementation
description: Thin implementation wrapper for an admitted task, spec or tickets; host-native execution by default.
version: 3.2.0
---
# Implementation — thin host wrapper

Receive an admitted task/spec/ticket and frozen contract, resolve pinned methodology dependencies, then carry artifacts and execution evidence back to YY.

## Methodology
Matt implement owns the implementation methodology. [METHODOLOGY.json](METHODOLOGY.json) binds implement → tdd + code-review, with tdd → codebase-design. Original bytes and source licenses are preserved under reference/matt; no runtime auto-update.
YY maps invocation to USER_EXPLICIT / MODEL_ELIGIBLE / YY_ROUTED. Upstream frontmatter and platform metadata are provenance, not cross-host authority. A supported logical skill invocation uses the host mechanism; otherwise its pinned methodology is included in the package. Missing or mismatched pins fail explicitly.

## Host execution
HOST_NATIVE is the default: the current host receives the bounded task, methodology, resources, acceptance, contract and upstream artifacts. No external CLI is required. YY does not select a model or implement a coding tutorial.
EXTERNAL_PROVIDER requires an explicit deployment selection. Read the [optional provider instructions](reference/opencode-usage.md) only when selecting that provider. [Execution contract](../../reference/host-execution.md) defines the portable package and embedded callback.
Without an executable host capability, return BRIEF_ONLY with executed=false. A delivered brief is not execution success.

## Return boundary
Return artifacts and evidence under artifacts/<subtaskId>/; preserve task acceptance and contract refs. YY checks real output and maps failure honestly. Execution/consumption evidence does not establish methodology_applied or Receipt v2 VERIFIED; C5 remains deferred.
