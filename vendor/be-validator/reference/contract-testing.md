# Contract testing 
Verify with portman --version, contracteer --version, and the corresponding --help output. Exact flags must follow the installed tool's help.
The adapter injects validator behavior through setValidator and writes artifacts/^<subtaskId>/contract-result.json. 
Result shape: pass, diff, checkedAt, tool. If both tools are unavailable, use local snapshot comparison and return CONTRACT_TOOL_NOT_AVAILABLE.
