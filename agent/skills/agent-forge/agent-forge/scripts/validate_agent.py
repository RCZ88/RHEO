#!/usr/bin/env python3
"""
Agent Forge — Output Validator
Validates a generated agentic system for completeness, safety, and correctness.
Usage: python validate_agent.py <path_to_generated_markdown.md>
"""

import sys
import re
import json

REQUIRED_SECTIONS = [
    "## 1. Agent Design",
    "## 2. System Prompt",
    "## 3. Parsing Schema",
    "## 4. UI Specification",
    "## 5. Integration Plan",
    "## 6. Security Review",
    "## 7. Implementation Checklist",
]

SECURITY_CHECKS = [
    "no destructive",
    "read-only",
    "no user input is executed",
    "pre-sanitized",
    "forbids conversational",
    "strictly structured",
    "anti-jailbreak",
    "escalation path",
    "off-switch",
    "idempotent",
]

FORBIDDEN_PATTERNS = [
    r"delete\s*\(",
    r"write\s*\(",
    r"eval\s*\(",
    r"exec\s*\(",
    r"Function\s*\(",
    r"innerHTML\s*=",
]

def validate(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    errors = []
    warnings = []

    # Check all sections present
    for section in REQUIRED_SECTIONS:
        if section not in content:
            errors.append(f"Missing section: {section}")

    # Check security checklist items
    for check in SECURITY_CHECKS:
        if check.lower() not in content.lower():
            warnings.append(f"Security checklist item possibly missing: '{check}'")

    # Check for forbidden patterns
    for pattern in FORBIDDEN_PATTERNS:
        matches = re.findall(pattern, content, re.IGNORECASE)
        if matches:
            errors.append(f"Forbidden pattern found '{pattern}': potential unsafe IPC/code execution")

    # Check JSON example validity
    json_blocks = re.findall(r"```json\n(.*?)\n```", content, re.DOTALL)
    for i, block in enumerate(json_blocks):
        try:
            json.loads(block)
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON in example block #{i+1}: {e}")

    # Check TypeScript interface completeness
    ts_blocks = re.findall(r"```typescript\n(.*?)\n```", content, re.DOTALL)
    for i, block in enumerate(ts_blocks):
        if "interface" not in block:
            warnings.append(f"TypeScript block #{i+1} missing interface definitions")
        if "any" in block:
            warnings.append(f"TypeScript block #{i+1} uses 'any' type — should be specific")

    # Check for agent type consistency
    if "Conductor" in content and "Reducer" not in content:
        warnings.append("Conductor pattern mentioned but no Reducer defined")

    # Check for IPC allowlist compliance
    write_ipc = re.findall(r"IPC.*\b(write|delete|update|create)\b", content, re.IGNORECASE)
    if write_ipc:
        warnings.append(f"Potentially destructive IPC calls mentioned: {write_ipc}")

    # Summary
    print(f"\n{'='*60}")
    print(f"Validation Report: {filepath}")
    print(f"{'='*60}")
    print(f"Errors:   {len(errors)}")
    print(f"Warnings: {len(warnings)}")

    if errors:
        print(f"\n❌ ERRORS:")
        for e in errors:
            print(f"   - {e}")

    if warnings:
        print(f"\n⚠️  WARNINGS:")
        for w in warnings:
            print(f"   - {w}")

    if not errors and not warnings:
        print(f"\n✅ All checks passed. Output is valid.")
        return 0
    elif not errors:
        print(f"\n✅ No critical errors. Review warnings before shipping.")
        return 0
    else:
        print(f"\n❌ Validation failed. Fix errors before shipping.")
        return 1

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_agent.py <path_to_generated_markdown.md>")
        sys.exit(1)
    sys.exit(validate(sys.argv[1]))
