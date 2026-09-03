using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

class Program
{
    [DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    const int SW_RESTORE = 9;

    static void Main()
    {
        foreach (var proc in Process.GetProcessesByName("RHEO"))
        {
            if (proc.MainWindowTitle != "")
            {
                Console.WriteLine($"PID: {proc.Id}, Title: {proc.MainWindowTitle}, Handle: {proc.MainWindowHandle}");
                
                // Take screenshot of the screen containing the window
                ShowWindow(proc.MainWindowHandle, SW_RESTORE);
                SetForegroundWindow(proc.MainWindowHandle);
                
                System.Threading.Thread.Sleep(500);
                
                var bounds = Screen.PrimaryScreen.Bounds;
                using (var bitmap = new Bitmap(bounds.Width, bounds.Height))
                using (var graphics = Graphics.FromImage(bitmap))
                {
                    graphics.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size);
                    string path = @"C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\design\media\shots\rheo_foreground.png";
                    bitmap.Save(path, ImageFormat.Png);
                    Console.WriteLine($"Saved: {path}");
                }
                return;
            }
        }
        Console.WriteLine("No RHEO window found");
    }
}
