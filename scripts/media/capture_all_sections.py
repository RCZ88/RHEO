import ctypes
import ctypes.wintypes
import time
from PIL import Image
import win32gui
import win32ui
import win32con
import win32api
import win32process
from pathlib import Path
SHOTS_DIR = Path(__file__).resolve().parent.parent.parent / 'design' / 'media' / 'shots'
SHOTS_DIR.mkdir(parents=True, exist_ok=True)

# Find RHEO window by PID
def find_rheo():
    windows = []
    def enum_callback(hwnd, lParam):
        if win32gui.IsWindowVisible(hwnd):
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            if pid == 16776:
                title = win32gui.GetWindowText(hwnd)
                windows.append((hwnd, title, pid))
        return True
    win32gui.EnumWindows(enum_callback, 0)
    return windows

def capture_window(hwnd, path):
    rect = win32gui.GetWindowRect(hwnd)
    x, y, x2, y2 = rect
    width = x2 - x
    height = y2 - y
    
    hwnd_dc = win32gui.GetWindowDC(hwnd)
    mfc_dc = win32ui.CreateDCFromHandle(hwnd_dc)
    save_dc = mfc_dc.CreateCompatibleDC()
    bitmap = win32ui.CreateBitmap()
    bitmap.CreateCompatibleBitmap(mfc_dc, width, height)
    save_dc.SelectObject(bitmap)
    save_dc.BitBlt((0, 0), (width, height), mfc_dc, (0, 0), win32con.SRCCOPY)
    
    bmp_info = bitmap.GetInfo()
    bmp_str = bitmap.GetBitmapBits(True)
    img = Image.frombuffer('RGB', (bmp_info['bmWidth'], bmp_info['bmHeight']), bmp_str, 'raw', 'BGRX', 0, 1)
    img.save(path)
    
    win32gui.DeleteObject(bitmap.GetHandle())
    save_dc.DeleteDC()
    mfc_dc.DeleteDC()
    win32gui.ReleaseDC(hwnd, hwnd_dc)
    print(f"  Saved: {path}")

def click_point(x, y):
    win32api.SetCursorPos((x, y))
    time.sleep(0.1)
    win32api.mouse_event(win32con.MOUSEEVENTF_LEFTDOWN, x, y, 0, 0)
    time.sleep(0.05)
    win32api.mouse_event(win32con.MOUSEEVENTF_LEFTUP, x, y, 0, 0)
    time.sleep(0.3)

# Find RHEO
rheo_windows = find_rheo()
if not rheo_windows:
    print("No RHEO window found")
    exit(1)

main_hwnd = rheo_windows[0][0]
print(f"RHEO window: {main_hwnd}")

# Bring to front
win32gui.SetWindowPos(main_hwnd, win32con.HWND_TOPMOST, 0, 0, 0, 0, 
    win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_SHOWWINDOW)
time.sleep(0.3)
win32gui.SetWindowPos(main_hwnd, win32con.HWND_NOTOPMOST, 0, 0, 0, 0,
    win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_SHOWWINDOW)
time.sleep(0.5)

# Get window rect
rect = win32gui.GetWindowRect(main_hwnd)
wx, wy, wx2, wy2 = rect
print(f"Window at: ({wx}, {wy})")

# Button positions from SOM capture (native coordinates)
# These are relative to the screen, not the window
buttons = {
    'Dashboard': (160, 201),
    'Activity': (160, 266),
    'AI Assistant': (160, 331),
    'Life': (160, 396),
    'Documentation': (160, 461),
    'Learn': (160, 526),
    'Resume': (160, 591),
    'IDE Projects': (160, 656),
    'Finance': (160, 721),
    'Insights': (160, 786),
    'Settings': (160, 851),
    'Guide': (160, 916),
}

# Capture Dashboard first (already on it)
out_path = str(SHOTS_DIR / 'dashboard.png')
capture_window(main_hwnd, out_path)

# Click and capture each section
for section, (bx, by) in buttons.items():
    if section == 'Dashboard':
        continue  # Already captured
    print(f"\nNavigating to: {section}")
    click_point(bx, by)
    time.sleep(1.5)
    
    out_path = str(SHOTS_DIR / (section.lower().replace(' ', '_') + '.png'))
    capture_window(main_hwnd, out_path)

print("\n=== DONE ===")
