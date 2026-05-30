# Tool Usage Issues & Fixes

Track all tool usage mistakes, platform gotchas, and corrective patterns.

---

## Issue #1 — Using `rg` (ripgrep) in Bash on Windows

**Date**: 2026-05-12 | **Severity**: High | **Status**: Fixed

**Problem**: Attempted to search file contents with `rg` in a Bash call on Windows PowerShell 5.1:
```powershell
rg -n "pattern" "C:\path\file.js"
```
Result: `rg: The term 'rg' is not recognized as the name of a cmdlet, function, script file, or operable program.`

**Root Cause**: `rg` (ripgrep) is a Unix-native binary not available on Windows PowerShell 5.1.

**Fix**: Use the built-in `Grep` tool instead, which handles content search across the entire codebase:
```
# WRONG
bash: rg -n "pattern" "path/file.js"

# CORRECT
Grep(pattern: "pattern", path: "path/to/dir", include: "*.js")
```

**Lesson**: Never use `rg`, `grep`, `find`, or other Unix search commands in Bash on Windows. Use the dedicated `Grep` tool for content search and `Glob` for file pattern matching.

---

## Issue #2 — Using PowerShell file/content cmdlets instead of dedicated tools

**Problem**: The instructions say to avoid using `Get-ChildItem`, `Get-Content`, `Select-String`, `Set-Content`, etc. in Bash, since dedicated tools exist.

**Fix**: Always prefer these mappings:

| Avoid in Bash | Use Instead |
|---|---|
| `Get-ChildItem -LiteralPath "."` | `Glob(pattern: "*")` |
| `Get-ChildItem -Recurse -Filter "*.js"` | `Glob(pattern: "**/*.js")` |
| `Get-Content "file.js"` | `Read(filePath: "file.js")` |
| `Select-String -Pattern "regex" -Path "dir"` | `Grep(pattern: "regex", path: "dir")` |
| `Set-Content "file" -Value "content"` | `Write(filePath: "file", content: "content")` |
| Write-Host / Write-Output | Output text directly |

---

## Issue #3 — Truncation commands unnecessary

**Problem**: Using `Select-Object -First N` or `Select-Object -Last N` to limit Bash output.

**Fix**: The Bash tool already truncates output at 2000 lines or 51200 bytes automatically. The full output is written to a temp file if truncated, available via `Read` with `offset/limit` or `Grep` to search.

---

## Issue #4 — Windows path quoting

**Problem**: Commands fail when paths contain spaces because shells split on whitespace.

**Fix**: Always wrap Windows paths with spaces in double quotes:
```powershell
# WRONG
Remove-Item path with spaces\file

# CORRECT
Remove-Item -LiteralPath "path with spaces\file"

# CORRECT for call operator
& "path with spaces\script.ps1"
```

---

## General Rules

1. **Content search** → Always use `Grep` tool, never `rg`/`grep`/`Select-String` in Bash
2. **File search** → Always use `Glob` tool, never `Get-ChildItem`/`ls`/`dir` in Bash
3. **Read files** → Always use `Read` tool, never `Get-Content`/`cat` in Bash
4. **Edit files** → Always use `Edit` tool, never `Set-Content` in Bash
5. **Write files** → Always use `Write` tool, never `Set-Content`/`Out-File` or here-strings in Bash
6. **No `cd`** → Use the `workdir` parameter on Bash instead of `cd`/`Set-Location`
7. **PowerShell 5.1 syntax** → No `&&` chaining; use `; if ($?) { cmd2 }` for dependent commands
