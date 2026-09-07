Detailed usage: reference/opencode-usage.md. 
# opencode usage 
 
The orchestrator dispatches implementation subtasks to the opencode adapter. The repository does not vendor opencode source. 
 
## Prerequisite 
Install opencode in the host environment and verify with opencode --version and opencode --help. If unavailable, the adapter returns OPENCODE_NOT_AVAILABLE. 
 
## Call contract 
The adapter probes `opencode --version` first, then receives task description plus SubTask.contract and invokes the command through spawn with an argument array. Exact opencode subcommand and flags must follow the installed opencode --help output.
 
## Artifacts and timeout 
Successful output is written to artifacts/^<subtaskId>/. Default timeout is 10 minutes and is configurable. Timeout returns TIMEOUT and does not silently pass. 
 
## Safety 
Use spawn plus an argument array; never concatenate shell command strings. All artifact paths are relative and portable.
