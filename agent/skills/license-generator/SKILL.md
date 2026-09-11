---

name: github-license-generator
description: Generate, validate, update, or audit LICENSE files for GitHub repositories. Use when users ask to create a LICENSE file, choose an open source license, add licensing to a repository, migrate between licenses, verify SPDX identifiers, or fix GitHub license detection issues. Handles MIT, Apache-2.0, GPL-3.0-only, GPL-3.0-or-later, BSD-2-Clause, BSD-3-Clause, MPL-2.0, AGPL-3.0-only, LGPL-3.0-only, and UNLICENSED repositories.
license: Apache-2.0
compatibility: Works with GitHub repositories containing source code, package manifests, or Git metadata.
allowed-tools: filesystem git github search
metadata:
author: your-organization
version: "1.0.0"
tags:
- github
- licensing
- spdx
- open-source
- legal
-------

# GitHub License Generator

## Purpose

Create standards compliant LICENSE files that are correctly detected by GitHub and conform to SPDX license identifiers.

Never generate license text from memory when an official template is available.

Always preserve the exact wording and formatting of official license templates.

## Activation Conditions

Activate this skill when the user asks to:

* create a LICENSE file
* add a license to a repository
* choose between open source licenses
* compare MIT, Apache, GPL, BSD, or MPL licenses
* update an existing license
* fix GitHub license detection
* add SPDX identifiers
* audit repository licensing

Do not activate for:

* software patents unrelated to repository licensing
* trademark questions
* contributor agreements
* privacy policies
* terms of service

## Required Information

Collect the following information in order of priority.

1. Explicit user instructions
2. Existing LICENSE files
3. Package manifests
4. Repository metadata
5. Git history
6. Git configuration
7. GitHub profile information

Required fields:

* license type
* copyright holder
* copyright year

Optional fields:

* organization name
* project start year
* dual licensing requirements
* contributor requirements

If required information cannot be determined with high confidence, ask the user.

Never guess.

## Repository Inspection Workflow

Inspect the following files if they exist:

* LICENSE
* COPYING
* package.json
* pyproject.toml
* Cargo.toml
* composer.json
* go.mod
* pom.xml
* setup.py

Search for:

* existing SPDX identifiers
* license fields
* copyright notices
* organization names
* contributor agreements

Inspect Git metadata:

```bash
git config user.name
git config user.email
git log --format="%an" | sort | uniq
```

## License Selection Workflow

If the user specifies a license explicitly:

* use the requested license

Otherwise ask:

1. Should commercial use be allowed?
2. Must modifications remain open source?
3. Is patent protection required?
4. Should network hosted modifications be disclosed?
5. Is this repository public or private?

Use these recommendations:

| Requirement         | Recommended License |
| ------------------- | ------------------- |
| Maximum simplicity  | MIT                 |
| Patent protection   | Apache-2.0          |
| Strong copyleft     | GPL-3.0-only        |
| Network copyleft    | AGPL-3.0-only       |
| File level copyleft | MPL-2.0             |
| Internal repository | UNLICENSED          |

## Template Sources

Load official templates from:

* templates/MIT.txt
* templates/Apache-2.0.txt
* templates/GPL-3.0-only.txt
* templates/BSD-3-Clause.txt
* templates/MPL-2.0.txt

Template placeholders may be replaced only where officially permitted.

Do not rewrite legal text.

Do not summarize legal clauses inside generated files.

## SPDX Rules

Use official SPDX identifiers only.

Examples:

* MIT
* Apache-2.0
* GPL-3.0-only
* GPL-3.0-or-later
* BSD-3-Clause
* MPL-2.0

Validate identifiers against:

* references/SPDX_LICENSE_IDS.md

## Generation Workflow

1. Determine the license type.
2. Determine the copyright holder.
3. Determine the copyright year.
4. Load the official template.
5. Replace placeholders.
6. Validate SPDX identifier.
7. Generate the LICENSE file.
8. Verify GitHub compatibility.

Default filename:

```text
LICENSE
```

Use `LICENSE.md` only when explicitly requested.

## Output Format

Return:

```text
Selected License: <name>
SPDX Identifier: <id>

Reasoning:
<brief explanation>

Files Created:
- LICENSE

Additional Recommendations:
- add SPDX headers to source files
- update package manifest license field
```

Then provide the complete LICENSE file contents.

## Validation Checklist

* official template used
* SPDX identifier valid
* copyright year present
* copyright holder present
* formatting preserved
* GitHub detection compatible

## Failure Conditions

Stop and request clarification if:

* multiple conflicting licenses exist
* copyright ownership is unclear
* license requirements conflict
* no suitable license can be determined

Never invent legal language.

Never create custom licenses unless explicitly requested.
