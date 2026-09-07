Each phase records inputs, outputs, acceptance evidence, and failure handling.
# cline execution
Verify with cline --version and cline --help. The adapter probes `cline --version`; when available it spawns `cline <task>` and records phase docs; exact plan/exec flags must follow installed help output.
If cline is unavailable, degrade to planned-only (auto mode) or skipped (`--backend cli`), and return SDLC_NOT_AVAILABLE. Timeout returns TIMEOUT.
