// Factory: generate a lesson from handbook section data
// This can be used standalone (no AI call) or as the post-processing step after AI generation.

import { HandbookSection, RawCommand, CommandCard, Exercise, QuickRef, LessonContent, HandbookLessonOutput, DepthLevel } from './schema';

const DEPTH_LABELS: Record<DepthLevel, string> = {
  core: 'core · day one',
  daily: 'daily · constant use',
  power: 'power · when core fails',
  rescue: 'rescue · broken system',
  sudo: 'sudo · admin rights',
};

const DEPTH_ORDER: DepthLevel[] = ['core', 'daily', 'power', 'sudo', 'rescue'];

function inferFlagMeaning(flag: string, base: string): string {
  const meanings: Record<string, Record<string, string>> = {
    ls: { l: 'long format (permissions, owner, size, date)', a: 'all files (including hidden)', h: 'human-readable sizes (K/M/G)' },
    mkdir: { p: 'create parent directories as needed' },
    cp: { r: 'recursive (copy folders)' },
    rm: { r: 'recursive (delete folders)', f: 'force (no confirmation)', i: 'interactive (ask before each)' },
    chmod: { R: 'recursive (apply to folders)' },
    grep: { r: 'recursive (search inside folders)', n: 'show line numbers', i: 'case-insensitive' },
    find: { name: 'search by name', type: 'filter by type (f=file, d=dir)', mtime: 'modified time', maxdepth: 'limit folder depth' },
    head: { n: 'number of lines' },
    tail: { n: 'number of lines', f: 'follow (watch live updates)' },
    df: { h: 'human-readable sizes' },
    du: { h: 'human-readable sizes', d: 'depth limit', x: 'stay on one filesystem' },
    free: { h: 'human-readable sizes' },
    ping: { c: 'count (number of packets)' },
    gcc: { Wall: 'enable all warnings', Wextra: 'extra warnings', g: 'debug info', O2: 'optimize for speed', o: 'output file', lm: 'link math library' },
    chmod: { x: 'make executable' },
    dnf: { refresh: 'refresh metadata first' },
    systemctl: { user: 'user services (no sudo needed)', no_pager: 'no pager (raw output)' },
    journalctl: { b: 'since boot', f: 'follow live', k: 'kernel messages only', u: 'specific service' },
    timedatectl: { NTP: 'enable network time sync' },
    lsblk: { o: 'output columns' },
    parted: { free: 'show unallocated space' },
    ntfsfix: { n: 'no changes (read-only check)' },
  };

  const cmdMeanings = meanings[base];
  if (cmdMeanings && cmdMeanings[flag]) {
    return cmdMeanings[flag];
  }

  // Generic fallbacks
  if (flag.length === 1) return `short flag: ${flag}`;
  return `option: ${flag}`;
}

function inferArgMeaning(type: string, value: string): string {
  if (type === 'path') return `path: ${value}`;
  if (type === 'placeholder') return `replace with: ${value}`;
  if (type === 'special') {
    if (value === '..') return 'parent directory';
    if (value === '~') return 'home directory';
    if (value === '-') return 'previous directory';
    if (value === '.') return 'current directory';
  }
  return value;
}

function buildCopyBlock(cmd: RawCommand): string {
  const p = cmd.params;
  let block = '';
  if (p.is_sudo) block += 'sudo ';
  block += p.base;
  if (p.subcommands.length) block += ' ' + p.subcommands.join(' ');
  for (const f of p.flags) {
    if (f.short) {
      block += ` -${f.flag}`;
      if (f.value) block += ` ${f.value}`;
    } else {
      block += ` --${f.flag}`;
      if (f.value) block += ` ${f.value}`;
    }
  }
  for (const a of p.args) {
    block += ` ${a.value}`;
  }
  if (p.pipe_to) block += ` | ${p.pipe_to}`;
  return block;
}

function buildCommandCard(cmd: RawCommand): CommandCard {
  const p = cmd.params;

  return {
    command: cmd.command,
    depth: cmd.depth,
    isRoot: cmd.isRoot,
    description: cmd.description,
    params: {
      base: p.base,
      subcommands: p.subcommands,
      flags: p.flags.map(f => ({
        flag: f.flag,
        meaning: inferFlagMeaning(f.flag, p.base),
        value: f.value || undefined,
      })),
      args: p.args.map(a => ({
        type: a.type,
        value: a.value,
        meaning: inferArgMeaning(a.type, a.value),
      })),
      pipe_to: p.pipe_to || undefined,
      is_sudo: p.is_sudo,
    },
    whenToUse: cmd.whenToUse,
    gotchas: cmd.gotchas,
    notes: cmd.notes,
    copyBlock: buildCopyBlock(cmd),
  };
}

function buildQuickRef(section: HandbookSection): QuickRef {
  const headers = ['Command', 'What it does', 'Depth'];
  const rows = section.commands.map(cmd => [
    cmd.command.length > 40 ? cmd.command.slice(0, 37) + '...' : cmd.command,
    cmd.description.length > 50 ? cmd.description.slice(0, 47) + '...' : cmd.description,
    DEPTH_LABELS[cmd.depth].split(' · ')[0],
  ]);
  return { headers, rows };
}

function buildExercises(section: HandbookSection): Exercise[] {
  // Generate exercises based on section content
  const exercises: Exercise[] = [];
  const cmds = section.commands;
  const sectionId = section.id;

  // Exercise patterns per section
  const exercisePatterns: Record<string, Exercise> = {
    start: {
      title: 'Your First Commands',
      instructions: 'Open a terminal. Type `pwd` to see where you are. Then type `ls -lah` to list files. Finally, type `history` to see what you just typed.',
      solution: 'pwd\nls -lah\nhistory',
      commandsUsed: ['pwd', 'ls', 'history'],
    },
    move: {
      title: 'Navigate Like a Pro',
      instructions: 'Navigate to your Documents folder, then go back to home using `cd ~`, then return to where you were with `cd -`.',
      solution: 'cd Documents\ncd ~\ncd -',
      commandsUsed: ['cd'],
    },
    files: {
      title: 'Project Scaffold',
      instructions: 'Create a folder structure for a C project: src/, include/, build/. Then create an empty main.c inside src/.',
      solution: 'mkdir -p project/{src,include,build}\ntouch project/src/main.c',
      commandsUsed: ['mkdir', 'touch'],
    },
    read: {
      title: 'Find the Needle',
      instructions: 'Search for all TODO comments in your home directory projects. Then find all .c files modified in the last 7 days.',
      solution: 'grep -rni "TODO" ~/projects\nfind ~ -name "*.c" -mtime -7',
      commandsUsed: ['grep', 'find'],
    },
    perm: {
      title: 'Make It Executable',
      instructions: 'Create a script file called hello.sh that prints "Hello World". Make it executable and run it.',
      solution: 'echo \'echo "Hello World"\' > hello.sh\nchmod +x hello.sh\n./hello.sh',
      commandsUsed: ['chmod', 'echo'],
    },
    edit: {
      title: 'Nano Survival',
      instructions: 'Open a file in nano, type "Hello from nano", save it, and quit.',
      solution: 'nano hello.txt\n# type "Hello from nano"\n# Ctrl+O Enter\n# Ctrl+X',
      commandsUsed: ['nano'],
    },
    open: {
      title: 'Open Anything',
      instructions: 'Open your home folder in the file manager from the terminal. Then open a PDF with its default app.',
      solution: 'xdg-open .\nxdg-open report.pdf',
      commandsUsed: ['xdg-open'],
    },
    pkg: {
      title: 'Install and Remove',
      instructions: 'Search for the "htop" package. Install it. Then remove it.',
      solution: 'dnf search htop\nsudo dnf install htop\nsudo dnf remove htop',
      commandsUsed: ['dnf'],
    },
    sys: {
      title: 'System Checkup',
      instructions: 'Check your disk space, memory usage, and find any firefox processes running.',
      solution: 'df -h\nfree -h\npgrep -a firefox',
      commandsUsed: ['df', 'free', 'pgrep'],
    },
    net: {
      title: 'Network Diagnostics',
      instructions: 'Ping google.com 4 times. Then check your IP address.',
      solution: 'ping -c 4 google.com\nip a',
      commandsUsed: ['ping', 'ip'],
    },
    code: {
      title: 'Compile and Run C',
      instructions: 'Create a simple C program that prints "Hello, World!", compile it with gcc, and run it.',
      solution: 'nano hello.c\n# type the C program\ngcc hello.c -o hello\n./hello',
      commandsUsed: ['gcc', 'nano'],
    },
    systemd: {
      title: 'Read the Logs',
      instructions: 'Check the logs from the last boot for any errors.',
      solution: 'journalctl -b -1 | grep -Ei "error|fail"',
      commandsUsed: ['journalctl'],
    },
    time: {
      title: 'Clock Check',
      instructions: 'Check your system clock status and get the current Unix timestamp.',
      solution: 'timedatectl status\ndate +%s',
      commandsUsed: ['timedatectl', 'date'],
    },
    gui: {
      title: 'TTY Escape',
      instructions: 'If your GUI dies, switch to TTY3, then back to the GUI.',
      solution: 'Ctrl + Alt + F3\nCtrl + Alt + F2',
      commandsUsed: ['Ctrl+Alt+F'],
    },
    snap: {
      title: 'KWallet Check',
      instructions: 'Open KWallet Manager to see your stored credentials.',
      solution: 'kwalletmanager',
      commandsUsed: ['kwalletmanager'],
    },
    suspend: {
      title: 'Suspend Test',
      instructions: 'Test suspend from the terminal, then check the logs for any issues.',
      solution: 'systemctl suspend\n# after resume:\njournalctl -b -1 -k | grep -Ei "PM:|suspend|resume"',
      commandsUsed: ['systemctl', 'journalctl'],
    },
    disks: {
      title: 'Disk Map',
      instructions: 'List all disks and partitions with their mount points and free space.',
      solution: 'lsblk -o NAME,SIZE,FSTYPE,FSAVAIL,FSUSE%,MOUNTPOINTS',
      commandsUsed: ['lsblk'],
    },
    danger: {
      title: 'Danger Awareness',
      instructions: 'Read through the danger zone commands. Explain why `rm -rf /` is destructive and how to avoid it.',
      solution: 'rm -rf / deletes everything recursively with no undo. Always Tab-complete paths, ls before rm, and never use rm -rf without verifying the path first.',
      commandsUsed: ['rm'],
    },
  };

  if (exercisePatterns[sectionId]) {
    exercises.push(exercisePatterns[sectionId]);
  }

  // Add a "combine commands" exercise if section has 3+ commands
  if (cmds.length >= 3) {
    const topCmds = cmds.slice(0, 3);
    exercises.push({
      title: 'Chain Reaction',
      instructions: `Combine these three commands into a workflow: ${topCmds.map(c => `\`${c.command.split(' ')[0]}\``).join(', ')}. Describe a scenario where you'd use them together.`,
      solution: `Workflow: ${topCmds.map(c => c.description).join(' → ')}`,
      commandsUsed: topCmds.map(c => c.params.base),
    });
  }

  return exercises;
}

export function generateLesson(section: HandbookSection, userContext?: { os?: string; experience?: string }): HandbookLessonOutput {
  const depthsPresent = [...new Set(section.commands.map(c => c.depth))].sort(
    (a, b) => DEPTH_ORDER.indexOf(a) - DEPTH_ORDER.indexOf(b)
  ) as DepthLevel[];

  const commandCards = section.commands.map(buildCommandCard);
  const exercises = buildExercises(section);
  const quickRef = buildQuickRef(section);

  // Estimate time: 2 min per command + 3 min per exercise + 2 min reading
  const estimatedMinutes = commandCards.length * 2 + exercises.length * 3 + 2;

  // Build objective from section why + command count
  const objective = section.why
    ? `By the end of this lesson, you'll understand ${section.why.toLowerCase()} and be able to use ${section.commands.length} commands confidently.`
    : `Master ${section.commands.length} terminal commands in the "${section.title}" category.`;

  // Build narrative from section data
  const narrative = buildNarrative(section, userContext);

  const lesson: LessonContent = {
    objective,
    whyItMatters: narrative.whyItMatters,
    narrative: narrative.body,
    commandCards,
    exercises,
    quickRef,
    callouts: section.callouts,
  };

  return {
    type: 'handbook_lesson',
    title: section.title,
    sectionId: section.id,
    sectionNumber: section.number,
    estimatedMinutes,
    lesson,
    metadata: {
      generated_at: new Date().toISOString(),
      agent_version: '1.0.0',
      data_sources: [`terminal-handbook-section-${section.id}`],
      commandCount: section.commands.length,
      depthsRepresented: depthsPresent,
    },
  };
}

function buildNarrative(section: HandbookSection, userContext?: { os?: string; experience?: string }): { whyItMatters: string; body: string } {
  const os = userContext?.os || 'fedora';
  const exp = userContext?.experience || 'beginner';

  // Section-specific narratives
  const narratives: Record<string, { whyItMatters: string; body: string }> = {
    start: {
      whyItMatters: 'The terminal prompt looks cryptic, but it\'s just four pieces of information that tell you who you are, where you are, and what you can do. Understanding this is the difference between feeling lost and feeling in control.',
      body: 'Every terminal session starts with a prompt like `[cleme@fedora ~]$`. This isn\'t decoration — it\'s a status bar. `cleme` is your username, `fedora` is the machine name, `~` is your current folder (home), and `$` means you\'re a normal user (not root). The four survival skills in this section — `man`, `--help`, Tab completion, and `Ctrl+C` — are the first things every terminal user learns. They\'re your safety net: `man` and `--help` answer questions, Tab prevents typos, and `Ctrl+C` is the panic button that stops anything that\'s running.',
    },
    move: {
      whyItMatters: 'The terminal is always "standing" in exactly one folder. Every command you run operates relative to that location. Knowing where you are and how to move is the foundation of everything else.',
      body: 'Think of the terminal like standing in a building. `pwd` tells you which room you\'re in. `ls` shows you what\'s in the room. `cd` moves you to another room. The two key concepts are absolute paths (starting from `/`, the root of everything) and relative paths (starting from where you are). `..` means "go up one level", `~` means "go home", and `-` means "go back to where I just was".',
    },
    files: {
      whyItMatters: 'Files are the atoms of a computer. Everything is a file — documents, folders, even devices. The five commands in this section (mkdir, touch, cp, mv, rm) are the verbs that let you manipulate these atoms.',
      body: 'Creating files and folders seems simple until you realize that `cp` and `mv` have no undo, and `rm` sends files straight to the void. The `-p` flag on `mkdir` saves you from "directory not found" errors. The `-r` flag on `cp` and `rm` is required for folders. And `ln -s` creates symlinks — signposts that point to files elsewhere, so you can access them from multiple places without copying.',
    },
    read: {
      whyItMatters: 'Logs, code, configuration files — the terminal is full of text. Knowing how to read it (without flooding your screen) and find what you need is what separates beginners from power users.',
      body: '`cat` dumps a whole file to the screen — fine for small files, overwhelming for large ones. `less` is the pager that lets you scroll and search. `head` and `tail` show you the first or last lines (and `tail -f` follows a log live). `grep` is the most important search tool: it finds text inside files recursively, case-insensitively, with line numbers. `find` searches for files by name, type, or date. Together, they answer every "where did I write that?" and "which file contains X?" question.',
    },
    perm: {
      whyItMatters: '"Permission denied" is the most common error beginners see. It\'s not a bug — it\'s the system protecting files from accidental damage. Understanding permissions means you can fix it in seconds instead of rebooting in frustration.',
      body: 'Every file has three permission slots: owner (you), group (your team), and everyone else. Each slot can have read (r=4), write (w=2), and execute (x=1) permissions, added together. So `755` means you can do everything (7=4+2+1), others can read and run (5=4+1). `chmod +x` makes a script executable. `sudo` runs a single command as admin — use it for system files, never for your own files.',
    },
    edit: {
      whyItMatters: 'Sometimes you need to edit a file right there in the terminal — no GUI, no IDE. Nano is the training wheels; Vim is the jet. You\'ll use one of them every time you edit a config file on a server.',
      body: 'Nano shows its shortcuts at the bottom of the screen the whole time — `^O` to save, `^X` to quit. It\'s the editor you learn in 30 seconds. Vim is the opposite: it has modes. You start in Normal mode (keys are commands, not text). Press `i` to insert text, `Esc` to go back to Normal. `:wq` saves and quits, `:q!` quits without saving. Vim has a 30-minute built-in lesson called `vimtutor` — the best way to learn it.',
    },
    open: {
      whyItMatters: 'The terminal and GUI aren\'t enemies. `xdg-open` bridges them — it opens any file with its default app, or opens a folder in the file manager, or opens a URL in the browser.',
      body: 'Sometimes the right tool for a file is a GUI app. `xdg-open report.pdf` opens the PDF in your default viewer. `xdg-open .` opens your file manager in the current folder. `xdg-open https://site.com` opens your browser. You can also specify an app: `kate file.txt` opens Kate, `code .` opens VS Code. Append `&` to keep the terminal free.',
    },
    pkg: {
      whyItMatters: 'Installing software on Linux isn\'t like Windows — there\'s no "download .exe from website". You use a package manager. On Fedora, that\'s `dnf`. It handles searching, installing, updating, and removing software with dependencies.',
      body: '`dnf search htop` finds the package. `sudo dnf install htop` installs it. `sudo dnf remove htop` removes it. `sudo dnf upgrade --refresh` updates everything. `rpm -q` checks if something is installed. Flatpak and Snap are separate app stores on top of dnf — they\'re sandboxed, which is why they sometimes misbehave with desktop services.',
    },
    sys: {
      whyItMatters: '"Why is my laptop slow / full / hot?" You can answer all three in under 30 seconds with these four commands. They\'re the first thing to check when something feels wrong.',
      body: '`df -h` shows free space per filesystem. `du -xhd1 ~/ | sort -h` shows which folders are eating your disk (drill down by re-running inside big folders). `free -h` shows memory usage. `top` (or `htop`) shows the live process table — who\'s hogging CPU and RAM. `pgrep -a firefox` finds a process by name, and `kill 1234` asks it to close politely.',
    },
    net: {
      whyItMatters: 'Network problems feel mysterious until you can ping, check your IP, and see which ports are open. These four commands turn "the internet is down" into "DNS isn\'t resolving" or "port 3000 is already in use".',
      body: '`ping -c 4 google.com` tests if the network is alive. Replies = yes, "unknown host" = DNS problem, timeouts = connection dead. `ip a` shows your IP addresses (the modern replacement for `ifconfig`). `curl -I https://site.com` fetches just the headers — "is the site up?". `ss -tulpn` shows which ports are open and which programs hold them.',
    },
    code: {
      whyItMatters: 'You don\'t need an IDE to write code. Editor + compiler + runner, all text. The pattern is the same for every language: write → compile/build → run. Master this and you can build anything from a C program to a Node.js server.',
      body: 'For C: `nano hello.c` to write, `gcc hello.c -o hello` to compile, `./hello` to run. The `./` is required because your current folder isn\'t in PATH (for safety). `-Wall -Wextra` turns on all warnings. `-g` adds debug info for gdb. For Python: `python3 app.py`. For Node: `node app.js`. For Java: `javac App.java` then `java App`. Once a project outgrows one file, `make` reads a Makefile and rebuilds only what changed.',
    },
    systemd: {
      whyItMatters: 'Modern Linux is run by systemd. Two tools run the show: `systemctl` controls services, `journalctl` reads their logs. When something breaks, these are the first commands to run.',
      body: '`systemctl status <svc>` tells you if a service is running and shows recent errors. `sudo systemctl restart <svc>` stops and starts it. `sudo systemctl enable <svc>` makes it start at boot. The key distinction: `systemctl` is for system-wide services (network, display manager), `systemctl --user` is for your session\'s services (KDE, apps). Desktop problems are usually user services — no sudo needed. `journalctl -b` shows logs since boot. `journalctl -b -1` shows the previous boot — golden after a crash.',
    },
    time: {
      whyItMatters: 'A wrong clock breaks logins, TLS certificates, and tokens while your timezone looks perfectly fine. One command diagnoses everything.',
      body: '`timedatectl status` shows system clock, RTC (motherboard clock), timezone, and NTP state all at once. You want "System clock synchronized: yes" and "RTC in local TZ: no". `sudo timedatectl set-ntp true` turns on network time sync. `date +%s` gives the Unix timestamp — handy for debugging "token expired" errors.',
    },
    gui: {
      whyItMatters: 'Black screen doesn\'t mean "reboot". It means the graphical layer fell over — the system is fine. These commands let you switch to a text terminal, diagnose the problem, and restart the GUI.',
      body: '`Ctrl + Alt + F3` switches to a spare TTY (text terminal). Your GUI sits on F2 or F1. From the TTY, you can run commands, check logs, and restart the GUI with `sudo systemctl restart display-manager`. `loginctl list-sessions` shows which sessions are running. `systemctl status display-manager --no-pager` checks the login screen service without assuming SDDM or GDM.',
    },
    snap: {
      whyItMatters: 'Snap apps are sandboxed, so they ask KWallet for secrets — and KWallet asks you for its password. Repeatedly. Understanding the chain (app → D-Bus → KWallet → prompt) stops you from blaming the wrong thing.',
      body: 'The chain is: app → D-Bus → your session\'s credential service → KWallet → unlock prompt. The prompt proves the chain reached KWallet — not that the app or Snap is broken. `kwalletmanager` opens the wallet manager. `systemsettings` can disable the Wallet subsystem entirely. `busctl --user list` shows which session services are running. No sudo here — KWallet belongs to your user.',
    },
    suspend: {
      whyItMatters: 'Suspend involves the kernel, GPU driver, firmware, and the desktop. A machine can resume at kernel level while the screen stays black. Reading the log before changing anything saves hours of wasted effort.',
      body: '`systemctl suspend` is a controlled suspend test from the terminal. If this works, basic suspend is fine and the problem is intermittent. `journalctl -b -1 -k | grep -Ei "PM:|i915|drm|ACPI|suspend|resume"` is the money command — "PM: suspend exit" means the kernel woke up; errors after that point = GPU/desktop problem. `cat /sys/power/mem_sleep` shows which suspend modes exist.',
    },
    disks: {
      whyItMatters: 'Cleaning a Windows partition from Fedora safely requires a specific order: look → identify → verify → delete the exact target → verify. Skipping any step risks destroying data.',
      body: '`lsblk -o NAME,SIZE,FSTYPE,FSAVAIL,FSUSE%,MOUNTPOINTS` maps all disks and partitions. `sudo parted /dev/nvme0n1 print free` shows unallocated space between partitions. `find` with `-maxdepth` searches bounded paths. Always `ls` before `rm -rf`. Never bulk-delete `Users`, `Windows`, `ProgramData`. `sudo ntfsfix -n` does a read-only NTFS check.',
    },
    danger: {
      whyItMatters: 'These commands can wreck a system in one keystroke. You learn them not to use them, but to recognize them and avoid accidental destruction.',
      body: '`sudo rm -rf /` is irreversible — no trash, no undo. A typo in the path has destroyed systems. `dd if=... of=/dev/sdX` writes raw bytes to a disk, bypassing every safeguard. `curl ... | bash` runs whatever a website hands you. The mindset that keeps systems alive: diagnose the layer before changing it → change one thing → verify → repeat. Read-only commands first, mutating commands last.',
    },
  };

  const defaultNarrative = {
    whyItMatters: section.why || `Master the ${section.commands.length} commands in "${section.title}" to become more effective at the terminal.`,
    body: `This section covers ${section.commands.length} commands related to ${section.title.toLowerCase()}. ${section.why || ''} Work through them top to bottom — they climb from daily bread to advanced usage.`,
  };

  return narratives[section.id] || defaultNarrative;
}

// ── Load handbook data and generate all lessons ──

import { readFileSync } from 'fs';
import { join } from 'path';

export function loadHandbookData(): { sections: HandbookSection[]; commands: RawCommand[] } {
  const dataPath = join(__dirname, '..', '..', 'docs', 'terminal-handbook-data.json');
  const raw = readFileSync(dataPath, 'utf-8');
  const data = JSON.parse(raw);
  return { sections: data.sections, commands: data.commands };
}

export function generateAllLessons(userContext?: { os?: string; experience?: string }): HandbookLessonOutput[] {
  const { sections } = loadHandbookData();
  return sections.map(s => generateLesson(s, userContext));
}

export function generateLessonById(sectionId: string, userContext?: { os?: string; experience?: string }): HandbookLessonOutput | null {
  const { sections } = loadHandbookData();
  const section = sections.find(s => s.id === sectionId);
  return section ? generateLesson(section, userContext) : null;
}
