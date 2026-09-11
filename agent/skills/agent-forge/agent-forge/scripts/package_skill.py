#!/usr/bin/env python3
"""
Agent Forge — Skill Packager
Packages the agent-forge skill into a .skill file (zip archive).
Usage: python package_skill.py <output_dir>
"""

import os
import sys
import zipfile
from pathlib import Path

def package_skill(output_dir):
    skill_root = Path(__file__).parent.parent
    skill_name = "agent-forge"
    output_path = Path(output_dir) / f"{skill_name}.skill"

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(skill_root):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(skill_root.parent)
                zf.write(file_path, arcname)

    print(f"✅ Packaged skill to: {output_path}")
    print(f"   Size: {output_path.stat().st_size / 1024:.1f} KB")

if __name__ == "__main__":
    output_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    package_skill(output_dir)
