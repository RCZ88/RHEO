import ctypes
import ctypes.wintypes
import time

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

# Constants
SW_RESTORE = 9
SW_SHOW = 5

# Callback for EnumWindows
EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int))

def enum_callback(hwnd, lParam):
    if user32.IsWindowVisible(hwnd):
        length = user32.GetWindowTextLengthW(hwnd)
        if length > 0:
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            title = buff.value
            if 'RHEO' in title and title != '':
                print(f"Found: hwnd={hwnd}, title='{title}'")
                # Restore and bring to front
                user32.ShowWindow(hwnd, SW_RESTORE)
                user32.SetForegroundWindow(hwnd)
                time.sleep(0.5)
    return True

print("Searching for RHEO windows...")
user32.EnumWindows(EnumWindowsProc(enum_callback), 0)
print("Done")
