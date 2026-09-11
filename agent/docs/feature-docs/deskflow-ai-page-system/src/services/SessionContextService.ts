export interface ExtractedContext {
  status: 'working' | 'waiting_input' | 'idle' | 'error';
  currentTask: string | null;
  problemReferenced: string | null;
  requestReferenced: string | null;
  filesModified: string[];
  lastAction: string | null;
}

export class SessionContextService {
  
  /**
   * Extract context from terminal output
   * Call this when terminal data is received
   */
  extractContext(output: string): ExtractedContext {
    const context: ExtractedContext = {
      status: 'working',
      currentTask: null,
      problemReferenced: null,
      requestReferenced: null,
      filesModified: [],
      lastAction: null
    };
    
    // Detect problem reference
    const problemMatch = output.match(/\[?(Issue\s*\d+|P-\d+)\]?/i);
    if (problemMatch) {
      context.problemReferenced = problemMatch[1].replace(/\s+/g, ' ');
    }
    
    // Detect request reference
    const requestMatch = output.match(/\[?(Request\s*\d+|R-\d+)\]?/i);
    if (requestMatch) {
      context.requestReferenced = requestMatch[1].replace(/\s+/g, ' ');
    }
    
    // Detect file operations
    const filePatterns = [
      /(?:Creating|Created|Writing|Written):\s*(.+?\.[a-zA-Z]+)/gi,
      /(?:Modifying|Modified|Editing|Edited):\s*(.+?\.[a-zA-Z]+)/gi,
      /(?:Reading|Read):\s*(.+?\.[a-zA-Z]+)/gi,
      /(?:Deleting|Deleted):\s*(.+?\.[a-zA-Z]+)/gi,
    ];
    
    for (const pattern of filePatterns) {
      const matches = output.matchAll(pattern);
      for (const match of matches) {
        const file = match[1].trim();
        if (!context.filesModified.includes(file)) {
          context.filesModified.push(file);
        }
      }
    }
    
    // Detect waiting for input (Action Required)
    const actionRequiredPatterns = [
      /\?\s*\[y\/n\]/i,
      /\?\s*\(yes\/no\)/i,
      /\[y\/n\]\s*\?/i,
      /confirm/i,
      /proceed/i,
      /password/i,
      /passphrase/i,
      /enter\s+your\s+name/i,
      /select\s+an\s+option/i,
    ];

    if (actionRequiredPatterns.some(re => re.test(output))) {
      context.status = 'waiting_input';
    }
    
    // Detect error
    if (/error:|failed:|exception:/i.test(output)) {
      context.status = 'error';
    }
    
    // Detect completion
    if (/done|completed|finished/i.test(output) && context.status !== 'error') {
      context.status = 'idle';
    }
    
    // Extract current task from last few lines
    const lines = output.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      if (lastLine.length < 100) {
        context.lastAction = lastLine.trim();
      }
    }
    
    return context;
  }
  
  /**
   * Generate brief context string for UI display
   */
  generateBriefContext(context: ExtractedContext): string {
    if (context.problemReferenced) {
      return `Working on ${context.problemReferenced}`;
    }
    if (context.requestReferenced) {
      return `Implementing ${context.requestReferenced}`;
    }
    if (context.filesModified.length > 0) {
      const file = context.filesModified[context.filesModified.length - 1];
      const fileName = file.split('/').pop() || file;
      return `Modifying ${fileName}`;
    }
    if (context.lastAction) {
      return context.lastAction.slice(0, 40);
    }
    return 'Working...';
  }
}

export const sessionContextService = new SessionContextService();
