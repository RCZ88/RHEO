import * as fs from 'fs';
import * as path from 'path';
const { enhanceSkillWithDSL } = require('./SkillDSLParser');

export interface SkillIO {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  source?: string;

  // DSL extensions
  widget?: 'select' | 'radio' | 'switch' | 'slider' | 'text' | 'textarea' | 'code' | 'file' | 'checkbox' | 'tags';
  choices?: string[];
  default?: string | number | boolean | string[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  validation?: string;
  validationMessage?: string;
  group?: string;
  language?: string;
}

export interface SkillOutput {
  name: string;
  type: string;
  description?: string;
  source?: string;
  preview?: boolean;
}

export interface SkillComponent {
  name: string;
  description?: string;
  type?: string;
  required?: boolean;
  source?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  filePath: string;
  inputs?: SkillIO[];
  outputs?: SkillOutput[];
  components?: SkillComponent[];
}

export class SkillsService {
  private baseDir: string;
  private skillsDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || this.getDefaultBaseDir();
    this.skillsDir = path.join(this.baseDir, 'agent', 'skills');
  }

  private getDefaultBaseDir(): string {
    return path.join(process.cwd());
  }

  private ensureSkillsDir(): void {
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }
  }

  getSkills(): Skill[] {
    this.ensureSkillsDir();
    const skills: Skill[] = [];

    if (!fs.existsSync(this.skillsDir)) {
      return skills;
    }

    const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(this.skillsDir, entry.name, 'SKILL.md');
        if (fs.existsSync(skillPath)) {
          const skill = this.loadSkillFromFile(skillPath);
          if (skill) skills.push(skill);
        }
      } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
        const skillPath = path.join(this.skillsDir, entry.name);
        const skill = this.loadSkillFromFile(skillPath);
        if (skill) skills.push(skill);
      }
    }

    return skills;
  }

  private loadSkillFromFile(filePath: string): Skill | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      const frontmatterMatch = content.trimStart().match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';

      let id = path.basename(path.dirname(filePath));
      let name = id.replace(/-/g, ' ').replace(/_/g, ' ');
      let description = '';
      let category = 'general';

      const nameMatch = content.match(/^#\s+(.+?)\n/m) || frontmatter.match(/^name:\s*(.+?)$/m);
      if (nameMatch) name = nameMatch[1].trim();

      const descMatch = frontmatter.match(/^description:\s*(.+?)$/m);
      if (descMatch) description = descMatch[1].trim();

      const catMatch = frontmatter.match(/^category:\s*(.+?)$/m);
      if (catMatch) category = catMatch[1].trim();

      const inputs = parseFrontmatterList(frontmatter, 'inputs') as SkillIO[];
      const outputs = parseFrontmatterList(frontmatter, 'outputs') as SkillIO[];
      const components = parseFrontmatterList(frontmatter, 'components') as SkillComponent[];

      const result: Skill = {
        id,
        name,
        description: description || this.generateDescription(content),
        category,
        content,
        filePath,
        inputs: inputs.length > 0 ? inputs : undefined,
        outputs: outputs.length > 0 ? outputs : undefined,
        components: components.length > 0 ? components : undefined,
      };

      return enhanceSkillWithDSL(result);
    } catch (err) {
      console.error('[SkillsService] Failed to load skill:', filePath, err);
      return null;
    }
  }

  private generateDescription(content: string): string {
    // Extract first non-header line as description
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---') && trimmed.length > 10) {
        return trimmed.substring(0, 150);
      }
    }
    return 'No description available';
  }

  getSkillById(id: string): Skill | null {
    const skills = this.getSkills();
    return skills.find(s => s.id === id) || null;
  }

  getSkillContext(skillId: string): string {
    const skill = this.getSkillById(skillId);
    if (!skill) return '';
    
    // Extract key instructions from skill content
    const lines = skill.content.split('\n');
    const contextLines: string[] = [];
    let inKeySection = false;

    for (const line of lines) {
      // Skip frontmatter and metadata
      if (line.startsWith('---') || line.startsWith('# ') || line.match(/^(name|description|category):/i)) {
        continue;
      }
      // Keep important sections
      if (line.startsWith('## ') || line.startsWith('### ')) {
        if (line.toLowerCase().includes('instructions') || line.toLowerCase().includes('task') || line.toLowerCase().includes('workflow')) {
          inKeySection = true;
        }
        contextLines.push(line);
      } else if (inKeySection && line.trim()) {
        contextLines.push(line);
      }
    }

    return `[Skill: ${skill.name}]\n${contextLines.slice(0, 50).join('\n')}`;
  }
}

function parseFrontmatterList(frontmatter: string, key: string): any[] {
  const lines = frontmatter.split('\n');
  const results: any[] = [];
  let inSection = false;
  let currentItem: any = null;

  for (const line of lines) {
    if (line === `${key}:` || new RegExp(`^${key}:\\s*$`).test(line)) {
      inSection = true;
      continue;
    }

    if (inSection && /^\w[\w-]*:/.test(line) && !line.startsWith(' ')) {
      if (currentItem && Object.keys(currentItem).length > 0) {
        results.push(currentItem);
      }
      currentItem = null;
      inSection = false;
      continue;
    }

    if (!inSection) continue;
    if (line.trim() === '') continue;

    const newItemMatch = line.match(/^  - (\w+):\s*(.+)$/);
    if (newItemMatch) {
      if (currentItem && Object.keys(currentItem).length > 0) {
        results.push(currentItem);
      }
      currentItem = {};
      let val: any = newItemMatch[2].trim();
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      currentItem[newItemMatch[1]] = val;
      continue;
    }

    const propMatch = line.match(/^    (\w+):\s*(.+)$/);
    if (propMatch && currentItem) {
      let val: any = propMatch[2].trim();
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map((s: string) => s.trim());
      }
      currentItem[propMatch[1]] = val;
    }
  }

  if (currentItem && Object.keys(currentItem).length > 0) {
    results.push(currentItem);
  }

  return results;
}