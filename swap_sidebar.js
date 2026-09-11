const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');

if (!c.includes("import Sidebar from './components/Sidebar'")) {
  c = c.replace(
    "import { PairPhoneModal } from './components/PairPhoneModal';\n",
    "import { PairPhoneModal } from './components/PairPhoneModal';\nimport Sidebar from './components/Sidebar';\n"
  );
  console.log('1. Added Sidebar import');
}

const oldBlock = `      {location.pathname !== '/terminal' && !solarOverlayActive && (
      <motion.div
        className="border-r border-zinc-800 flex flex-col h-full glass overflow-hidden shrink-0"
        animate={{ width: sidebarCollapsed ? 60 : 256 }}
        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
      >
        {/* Header */}
        <div className="flex items-center shrink-0 border-b border-zinc-800">
          {sidebarCollapsed ? (
            <div className="w-full flex justify-center py-4">
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Expand sidebar"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full pr-2">
              <div className="p-5">
                <SidebarLogo />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setReorderMode((v) => !v)}
                  className={"p-1.5 rounded-lg transition-colors " + (reorderMode ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' : 'text-zinc-500 hover:text-white hover:bg-zinc-800')}
                  title={reorderMode ? 'Done reordering' : 'Reorder navigation'}
                >
                  {reorderMode ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 flex flex-col">
            <div className="flex flex-col gap-2 items-stretch">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSidebarDragEnd}>
              <SortableContext items={sidebarItems.map((i) => i.path)} strategy={verticalListSortingStrategy}>
                {sidebarItems.map((item) => (
                  <SidebarSortableItem
                    key={item.path}
                    item={item}
                    collapsed={sidebarCollapsed}
                    reorderMode={reorderMode}
                    isActive={location.pathname === item.path}
                    onNavigate={() => { console.log('[NAV] fired – path:', item.path, 'current:', location.pathname); handleSidebarNavigation(item.path); }}
                  />
                ))}
              </SortableContext>
            </DndContext>
            </div>
            {reorderMode && !sidebarCollapsed && (
              <div className="mt-3 flex items-center justify-between px-1">
                <button
                  onClick={handleResetSidebarOrder}
                  className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg px-2 py-1.5 transition-colors"
                  title="Restore default navigation order"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset order
                </button>
                <span
                  className={"text-[11px] text-emerald-400 transition-opacity duration-300 " + (orderSaved ? 'opacity-100' : 'opacity-0')}
                  aria-hidden={!orderSaved}
                >
                  Order saved
                </span>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {sidebarCollapsed ? (
            <div className="px-2 py-2 border-t border-zinc-800 flex flex-col items-center gap-2 shrink-0">
              <ThemeToggle size="sm" />
            </div>
          ) : !sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between shrink-0 overflow-hidden"
            >
              <span className="text-[10px] text-zinc-500">Local SQLite — Zero Cloud — Privacy-First</span>
              <div className="flex items-center gap-2">
                <ThemeToggle size="sm" />
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-pair-modal', { detail: { terminalId: '', label: 'Phone Pairing' } }))}
                  className="p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                  title="Pair Phone"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-zinc-600">RHEO v1.0.0</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      )}`;

const newBlock = `      {location.pathname !== '/terminal' && !solarOverlayActive && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          pathname={location.pathname}
        />
      )}`;

if (!c.includes(oldBlock)) {
  console.log('ERROR: inline sidebar block not found');
  fs.writeFileSync('/tmp/app_debug.txt', c);
  process.exit(1);
}
c = c.replace(oldBlock, newBlock, 1);
console.log('Replaced inline sidebar with Sidebar component mount');
fs.writeFileSync('src/App.tsx', c);
