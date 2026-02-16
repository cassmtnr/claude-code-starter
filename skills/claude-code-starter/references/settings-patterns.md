# Settings Permission Patterns

Permission patterns for `.claude/settings.json` generation, organized by category.

## Settings File Format

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      // permissions listed here
    ]
  }
}
```

## Base Permissions (Always Included)

These are always added regardless of detected stack:

```json
[
  "Read(**)",
  "Edit(**)",
  "Write(.claude/**)",
  "Bash(git:*)",
  "Bash(npm:*)",
  "Bash(yarn:*)",
  "Bash(pnpm:*)",
  "Bash(bun:*)",
  "Bash(npx:*)",
  "Bash(ls:*)",
  "Bash(mkdir:*)",
  "Bash(cat:*)",
  "Bash(echo:*)",
  "Bash(grep:*)",
  "Bash(find:*)"
]
```

## Language-Specific Permissions

### TypeScript / JavaScript

**Condition**: If `typescript` or `javascript` detected.

```json
[
  "Bash(node:*)",
  "Bash(tsc:*)"
]
```

### Python

**Condition**: If `python` detected.

```json
[
  "Bash(python:*)",
  "Bash(pip:*)",
  "Bash(poetry:*)",
  "Bash(pytest:*)",
  "Bash(uvicorn:*)"
]
```

### Go

**Condition**: If `go` detected.

```json
[
  "Bash(go:*)"
]
```

### Rust

**Condition**: If `rust` detected.

```json
[
  "Bash(cargo:*)",
  "Bash(rustc:*)"
]
```

### Ruby

**Condition**: If `ruby` detected.

```json
[
  "Bash(ruby:*)",
  "Bash(bundle:*)",
  "Bash(rails:*)",
  "Bash(rake:*)"
]
```

## Testing Framework Permissions

Add based on detected testing framework:

| Framework | Permissions |
|-----------|------------|
| jest | `Bash(jest:*)` |
| vitest | `Bash(vitest:*)` |
| playwright | `Bash(playwright:*)` |
| cypress | `Bash(cypress:*)` |
| pytest | `Bash(pytest:*)` |
| rspec | `Bash(rspec:*)` |

Note: `bun-test`, `go-test`, `rust-test`, `mocha`, `unittest`, `junit` do not add extra permissions (covered by language permissions).

## Linter Permissions

Add based on detected linter:

| Linter | Permission |
|--------|-----------|
| eslint | `Bash(eslint:*)` |
| biome | `Bash(biome:*)` |
| ruff | `Bash(ruff:*)` |
| flake8 | `Bash(flake8:*)` |
| pylint | `Bash(pylint:*)` |
| golangci-lint | `Bash(golangci-lint:*)` |
| clippy | `Bash(clippy:*)` |
| rubocop | `Bash(rubocop:*)` |

## Formatter Permissions

Add based on detected formatter:

| Formatter | Permission |
|-----------|-----------|
| prettier | `Bash(prettier:*)` |
| biome | `Bash(biome:*)` |
| black | `Bash(black:*)` |
| ruff | `Bash(ruff:*)` |
| gofmt | `Bash(gofmt:*)` |
| rustfmt | `Bash(rustfmt:*)` |
| rubocop | `Bash(rubocop:*)` |

Note: Deduplicate permissions if the same tool appears as both linter and formatter (e.g., biome, ruff, rubocop).

## Docker Permissions

**Condition**: If Docker files detected (Dockerfile, docker-compose.yml, docker-compose.yaml).

```json
[
  "Bash(docker:*)",
  "Bash(docker-compose:*)"
]
```

## Deduplication

The final permissions array MUST be deduplicated. If the same permission appears from multiple sources (e.g., `Bash(ruff:*)` from both linter and formatter), include it only once.

## Example: TypeScript + Vitest + Biome + Docker

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Read(**)",
      "Edit(**)",
      "Write(.claude/**)",
      "Bash(git:*)",
      "Bash(npm:*)",
      "Bash(yarn:*)",
      "Bash(pnpm:*)",
      "Bash(bun:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(tsc:*)",
      "Bash(vitest:*)",
      "Bash(biome:*)",
      "Bash(docker:*)",
      "Bash(docker-compose:*)",
      "Bash(ls:*)",
      "Bash(mkdir:*)",
      "Bash(cat:*)",
      "Bash(echo:*)",
      "Bash(grep:*)",
      "Bash(find:*)"
    ]
  }
}
```

## Example: Python + Pytest + Ruff

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Read(**)",
      "Edit(**)",
      "Write(.claude/**)",
      "Bash(git:*)",
      "Bash(npm:*)",
      "Bash(yarn:*)",
      "Bash(pnpm:*)",
      "Bash(bun:*)",
      "Bash(npx:*)",
      "Bash(python:*)",
      "Bash(pip:*)",
      "Bash(poetry:*)",
      "Bash(pytest:*)",
      "Bash(uvicorn:*)",
      "Bash(ruff:*)",
      "Bash(ls:*)",
      "Bash(mkdir:*)",
      "Bash(cat:*)",
      "Bash(echo:*)",
      "Bash(grep:*)",
      "Bash(find:*)"
    ]
  }
}
```
