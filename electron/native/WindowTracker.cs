using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class WindowTracker {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;

    public static void Main(string[] args) {
        uint ignorePid = 0;
        bool once = false;

        for (int i = 0; i < args.Length; i++) {
            if (args[i] == "--ignore-pid" && i + 1 < args.Length) {
                uint.TryParse(args[i + 1], out ignorePid);
            } else if (args[i] == "--once") {
                once = true;
            }
        }

        IntPtr lastHwnd = IntPtr.Zero;
        RECT lastRect = new RECT();

        while (true) {
            IntPtr hwnd = GetForegroundWindow();
            if (hwnd != IntPtr.Zero && IsWindowVisible(hwnd) && !IsIconic(hwnd)) {
                uint pid = 0;
                GetWindowThreadProcessId(hwnd, out pid);

                if (ignorePid == 0 || pid != ignorePid) {
                    RECT rect = new RECT();
                    int hr = DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, out rect, Marshal.SizeOf(typeof(RECT)));
                    if (hr != 0 || (rect.Right == 0 && rect.Bottom == 0)) {
                        GetWindowRect(hwnd, out rect);
                    }

                    int width = rect.Right - rect.Left;
                    int height = rect.Bottom - rect.Top;

                    // Ensure minimum reasonable window dimensions
                    if (width > 120 && height > 120) {
                        StringBuilder className = new StringBuilder(256);
                        GetClassName(hwnd, className, 256);
                        string cls = className.ToString();

                        // Filter out Windows shell chrome and desktop backdrops
                        if (cls != "Progman" && cls != "WorkerW" && cls != "Shell_TrayWnd" && cls != "Shell_SecondaryTrayWnd") {
                            bool changed = (hwnd != lastHwnd) ||
                                           (Math.Abs(rect.Left - lastRect.Left) > 2) ||
                                           (Math.Abs(rect.Top - lastRect.Top) > 2) ||
                                           (Math.Abs(rect.Right - lastRect.Right) > 2) ||
                                           (Math.Abs(rect.Bottom - lastRect.Bottom) > 2);

                            if (changed) {
                                lastHwnd = hwnd;
                                lastRect = rect;

                                StringBuilder title = new StringBuilder(512);
                                GetWindowText(hwnd, title, 512);
                                string cleanTitle = title.ToString()
                                    .Replace("\\", "\\\\")
                                    .Replace("\"", "\\\"")
                                    .Replace("\r", "")
                                    .Replace("\n", "");

                                Console.WriteLine(string.Format(
                                    "{{\"hwnd\":{0},\"pid\":{1},\"title\":\"{2}\",\"className\":\"{3}\",\"left\":{4},\"top\":{5},\"width\":{6},\"height\":{7}}}",
                                    hwnd.ToInt64(), pid, cleanTitle, cls, rect.Left, rect.Top, width, height
                                ));
                                Console.Out.Flush();

                                if (once) {
                                    return;
                                }
                            }
                        }
                    }
                }
            }

            if (once) {
                Console.WriteLine("{}");
                return;
            }

            Thread.Sleep(200);
        }
    }
}
