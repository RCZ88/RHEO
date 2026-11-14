import { createRoot } from 'react-dom/client';
import { BootOverlay } from '/home/clementzhao/dev/rheo/src/components/boot/BootOverlay';
import type { BootAnimationConfig } from '/home/clementzhao/dev/rheo/src/components/boot/bootTimings';

const cfg: BootAnimationConfig = { enabled: true, variant: 'meridian', warmStart: false };
createRoot(document.getElementById('root') as HTMLElement).render(
  <BootOverlay
    config={cfg}
    onDone={() => {
      (window as unknown as { __DONE?: boolean }).__DONE = true;
    }}
  />,
);
