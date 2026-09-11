import os
from pathlib import Path
os.chdir(Path(__file__).resolve().parent)

with open('src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add activeNavPct calculation after activeGroup useMemo
old_active_group = '''  const activeGroup = useMemo(() => {
    for (const item of SIDEBAR_ITEMS) {
      const p = item.path.split('?')[0];
      if (p === '/' ? activePath === '/' : activePath === p || activePath.startsWith(p + '/')) {
        return item.group;
      }
    }
    return undefined;
  }, [activePath]);

  return ('''

new_active_group = '''  const activeGroup = useMemo(() => {
    for (const item of SIDEBAR_ITEMS) {
      const p = item.path.split('?')[0];
      if (p === '/' ? activePath === '/' : activePath === p || activePath.startsWith(p + '/')) {
        return item.group;
      }
    }
    return undefined;
  }, [activePath]);

  // Nav marker position: map active item to a rough percentage of sidebar height
  const activeNavPct = useMemo(() => {
    const idx = SIDEBAR_ITEMS.findIndex((item) => {
      const p = item.path.split('?')[0];
      return p === '/' ? activePath === '/' : activePath === p || activePath.startsWith(p + '/');
    });
    if (idx < 0) return 0;
    // Approximate: spread items across the ruler strip
    return (idx / Math.max(SIDEBAR_ITEMS.length - 1, 1)) * 100;
  }, [activePath]);

  return ('''

if old_active_group in content:
    content = content.replace(old_active_group, new_active_group)
    print('Added activeNavPct calculation')
else:
    print('ERROR: old_active_group not found')

with open('src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
