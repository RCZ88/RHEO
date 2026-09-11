import ctypes
import ctypes.wintypes
import time
from PIL import Image
from pathlib import Path
SHOTS_DIR = Path(__file__).resolve().parent.parent.parent / 'design' / 'media' / 'shots'
SHOTS_DIR.mkdir(parents=True, exist_ok=True)

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

# Constants
SRCCOPY = 0x00CC0020

# Get screen dimensions
screen_width = user32.GetSystemMetrics(0)
screen_height = user32.GetSystemMetrics(1)
print(f"Screen: {screen_width}x{screen_height}")

# Create device contexts
hwnd_desktop = user32.GetDesktopWindow()
hdc_desktop = user32.GetDC(hwnd_desktop)
hdc_mem = gdi32.CreateCompatibleDC(hdc_desktop)
hbitmap = gdi32.CreateCompatibleBitmap(hdc_desktop, screen_width, screen_height)
gdi32.SelectObject(hdc_mem, hbitmap)

# Copy screen to bitmap
gdi32.BitBlt(hdc_mem, 0, 0, screen_width, screen_height, hdc_desktop, 0, 0, SRCCOPY)

# Get bitmap info
class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ('biSize', ctypes.c_uint32),
        ('biWidth', ctypes.c_int32),
        ('biHeight', ctypes.c_int32),
        ('biPlanes', ctypes.c_uint16),
        ('biBitCount', ctypes.c_uint16),
        ('biCompression', ctypes.c_uint32),
        ('biSizeImage', ctypes.c_uint32),
        ('biXPelsPerMeter', ctypes.c_int32),
        ('biYPelsPerMeter', ctypes.c_int32),
        ('biClrUsed', ctypes.c_uint32),
        ('biClrImportant', ctypes.c_uint32),
    ]

bmi = BITMAPINFOHEADER()
bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
bmi.biWidth = screen_width
bmi.biHeight = -screen_height  # Negative = top-down
bmi.biPlanes = 1
bmi.biBitCount = 32
bmi.biCompression = 0

# Get bitmap data
buffer_size = screen_width * screen_height * 4
buffer = ctypes.create_string_buffer(buffer_size)
gdi32.GetDIBits(hdc_mem, hbitmap, 0, screen_height, buffer, ctypes.byref(bmi), 0)

# Create PIL image
img = Image.frombytes('RGBA', (screen_width, screen_height), buffer)

# Save
out_path = str(SHOTS_DIR / 'rheo_focused.png')
img.save(out_path)
print(f"Saved: {out_path}")

# Cleanup
gdi32.DeleteObject(hbitmap)
gdi32.DeleteDC(hdc_mem)
user32.ReleaseDC(hwnd_desktop, hdc_desktop)
