const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');

if (!c.includes("import Sidebar from './components/Sidebar'")) {
  c = c.replace(
    "import { PairPhoneModal } from './components/PairPhoneModal';\n",
    "import { PairPhoneModal } from './components/PairPhoneModal';\nimport Sidebar from './components/Sidebar';\n"
  );
}

const startNeedle = "{location.pathname !== '/terminal' && !solarOverlayActive && (";
const startIdx = c.indexOf(startNeedle);
if (startIdx === -1) { console.log('ERROR: start not found'); process.exit(1); }

// The inline sidebar block ends with exactly:
//        </AnimatePresence>
//      </motion.div>
//      )}
const endNeedle = "        </AnimatePresence>\n      </motion.div>\n      )}";
const endIdx = c.indexOf(endNeedle, startIdx);
if (endIdx === -1) {
  console.log('ERROR: end not found at', startIdx);
  console.log('Searching for alternatives...');
  const alt1 = "      </motion.div>\n      )}";
  const alt1Idx = c.indexOf(alt1, startIdx);
  console.log('alt1 idx', alt1Idx);
  if (alt1Idx !== -1) {
    const fullEnd = alt1Idx + alt1.length;
    const newBlock = `      {location.pathname !== '/terminal' && !solarOverlayActive && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          pathname={location.pathname}
        />
      )}`;
    c = c.substring(0, startIdx) + newBlock + c.substring(fullEnd);
    console.log('Replaced inline sidebar with Sidebar component mount (alt1)');
    fs.writeFileSync('src/App.tsx', c);
  } else {
    process.exit(1);
  }
} else {
  const fullEnd = endIdx + endNeedle.length;
  const newBlock = `      {location.pathname !== '/terminal' && !solarOverlayActive && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          pathname={location.pathname}
        />
      )}`;
  c = c.substring(0, startIdx) + newBlock + c.substring(fullEnd);
  console.log('Replaced inline sidebar with Sidebar component mount');
  fs.writeFileSync('src/App.tsx', c);
}
