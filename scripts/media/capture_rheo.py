import ctypes
import ctypes.wintypes
import time
from PIL import Image
import win32gui
import win32ui
import win32con
import win32api
from pathlib import Path
SHOTS_DIR = Path(__file__).resolve().parent.parent.parent / 'design' / 'media' / 'shots'
SHOTS_DIR.mkdir(parents=True, exist_ok=True)

# Find RHEO window
def find_rheo():
    windows = []
    def enum_callback(hwnd, lParam):
        if win32gui.IsWindowVisible(hwnd):
            title = win32gui.GetWindowText(hwnd)
            if 'RHEO' in title:
                windows.append((hwnd, title))
        return True
    win32gui.EnumWindows(enum_callback, 0)
    return windows

rheo_windows = find_rheo()
print(f"Found {len(rheo_windows)} RHEO windows")
for hwnd, title in rheo_windows:
    print(f"  hwnd={hwnd}, title='{title}'")

if not rheo_windows:
    print("No RHEO window found")
    exit(1)

main_hwnd = rheo_windows[0][0]

# Bring to front
win32gui.ShowWindow(main_hwnd, win32con.SW_RESTORE)
win32gui.SetForegroundWindow(main_hwnd)
time.sleep(0.5)

# Get window rect
rect = win32gui.GetWindowRect(main_hwnd)
x, y, x2, y2 = rect
width = x2 - x
height = y2 - y
print(f"Window: {width}x{height} at ({x},{y})")

# Take screenshot
hwnd_dc = win32gui.GetWindowDC(main_hwnd)
mfc_dc = win32ui.CreateDCFromHandle(hwnd_dc)
save_dc = mfc_dc.CreateCompatibleDC()
bitmap = win32ui.CreateBitmap()
bitmap.CreateCompatibleBitmap(mfc_dc, width, height)
save_dc.SelectObject(bitmap)
save_dc.BitBlt((0, 0), (width, height), mfc_dc, (0, 0), win32con.SRCCOPY)

# Convert to PIL
bmp_info = bitmap.GetInfo()
bmp_str = bitmap.GetBitmapBits(True)
img = Image.frombuffer('RGB', (bmp_info['bmWidth'], bmp_info['bmHeight']), bmp_str, 'raw', 'BGRX', 0, 1)

out_path = str(SHOTS_DIR / 'dashboard.png')
img.save(out_path)
print(f"Saved: {out_path}")

# Cleanup
win32gui.DeleteObject(bitmap.GetHandle())
save_dc.DeleteDC()
mfc_dc.DeleteDC()
win32gui.ReleaseDC(main_hwnd, hwnd_dc)
