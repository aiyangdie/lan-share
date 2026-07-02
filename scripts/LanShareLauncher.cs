// LanShare Windows Launcher — compiled to LanShare.exe (~20KB)
// Starts bundled node.exe server.mjs and opens browser UI
using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

class LanShareLauncher {
  static void Main() {
    string dir = AppDomain.CurrentDomain.BaseDirectory;
    string node = Path.Combine(dir, "node", "node.exe");
    string script = Path.Combine(dir, "server.mjs");
    Directory.CreateDirectory(Path.Combine(dir, "shared"));
    Directory.CreateDirectory(Path.Combine(dir, "uploads"));

    if (!File.Exists(node)) {
      Console.WriteLine("");
      Console.WriteLine("  [错误] 未找到 node\\node.exe");
      Console.WriteLine("  请重新解压 LanShare 完整安装包。");
      Console.WriteLine("  下载: https://aiyangdie.github.io/lan-share/");
      Console.WriteLine("");
      Console.ReadKey();
      return;
    }
    if (!File.Exists(script)) {
      Console.WriteLine("");
      Console.WriteLine("  [错误] 未找到 server.mjs");
      Console.WriteLine("");
      Console.ReadKey();
      return;
    }

    Console.Title = "LanShare Server";
    Console.OutputEncoding = System.Text.Encoding.UTF8;
    Console.WriteLine("");
    Console.WriteLine("  LanShare 电脑互传");
    Console.WriteLine("  正在启动服务…");
    Console.WriteLine("  手机请安装 LanShare APK，同一 WiFi 可自动发现本电脑");
    Console.WriteLine("  按 Ctrl+C 停止服务");
    Console.WriteLine("");

    var psi = new ProcessStartInfo {
      FileName = node,
      Arguments = "\"" + script + "\"",
      WorkingDirectory = dir,
      UseShellExecute = false,
    };
    var p = Process.Start(psi);
    if (p == null) {
      Console.WriteLine("  [错误] 无法启动服务进程");
      Console.ReadKey();
      return;
    }

    Thread.Sleep(1500);
    try {
      Process.Start(new ProcessStartInfo {
        FileName = "http://127.0.0.1:8787/",
        UseShellExecute = true,
      });
    } catch { /* browser optional */ }

    p.WaitForExit();
  }
}
