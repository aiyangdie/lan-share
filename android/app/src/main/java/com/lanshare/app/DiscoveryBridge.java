package com.lanshare.app;

import android.content.Context;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DiscoveryBridge {
    private static final int DISCOVERY_PORT = 38787;
    private static final int HTTP_PORT = 8787;

    private final Context context;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Map<String, JSONObject> peers = new LinkedHashMap<>();
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private DatagramSocket socket;
    private Thread listenerThread;
    private volatile boolean running;
    private android.webkit.WebView webView;

    public DiscoveryBridge(Context context) {
        this.context = context.getApplicationContext();
        startUdpListener();
    }

    private void startUdpListener() {
        if (running) return;
        running = true;
        listenerThread = new Thread(() -> {
            try {
                socket = new DatagramSocket(DISCOVERY_PORT);
                socket.setBroadcast(true);
                byte[] buf = new byte[2048];
                while (running) {
                    DatagramPacket packet = new DatagramPacket(buf, buf.length);
                    socket.receive(packet);
                    String raw = new String(packet.getData(), 0, packet.getLength(), StandardCharsets.UTF_8);
                    JSONObject data = new JSONObject(raw);
                    if (!"lanshare".equals(data.optString("type"))) continue;
                    String ip = data.optString("ip");
                    if (ip.isEmpty()) continue;
                    synchronized (peers) {
                        data.put("seenAt", System.currentTimeMillis());
                        peers.put(ip, data);
                    }
                    notifyPeer(data);
                }
            } catch (Exception ignored) {
            }
        }, "LanShareDiscovery");
        listenerThread.setDaemon(true);
        listenerThread.start();
    }

    public void bindWebView(android.webkit.WebView view) {
        this.webView = view;
    }

    private void notifyPeer(JSONObject peer) {
        if (webView == null || peer == null) return;
        String js = "typeof window.__onLanShareDiscovered==='function' && window.__onLanShareDiscovered("
            + peer.toString() + ")";
        mainHandler.post(() -> webView.evaluateJavascript(js, null));
    }

    @JavascriptInterface
    public String getWifiIp() {
        try {
            WifiManager wm = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);
            if (wm == null) return "";
            WifiInfo info = wm.getConnectionInfo();
            int ip = info.getIpAddress();
            if (ip == 0) return "";
            return String.format("%d.%d.%d.%d",
                (ip & 0xff), (ip >> 8 & 0xff), (ip >> 16 & 0xff), (ip >> 24 & 0xff));
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public String getDiscoveredPeers() {
        prune();
        JSONArray arr = new JSONArray();
        synchronized (peers) {
            for (JSONObject p : peers.values()) {
                arr.put(p);
            }
        }
        String wifiIp = getWifiIp();
        if (!wifiIp.isEmpty()) {
            pool.execute(() -> scanSubnet(wifiIp));
        }
        return arr.toString();
    }

    private void prune() {
        long now = System.currentTimeMillis();
        synchronized (peers) {
            Iterator<Map.Entry<String, JSONObject>> it = peers.entrySet().iterator();
            while (it.hasNext()) {
                Map.Entry<String, JSONObject> e = it.next();
                if (now - e.getValue().optLong("seenAt", 0) > 30000) it.remove();
            }
        }
    }

    private void scanSubnet(String wifiIp) {
        String[] parts = wifiIp.split("\\.");
        if (parts.length != 4) return;
        String base = parts[0] + "." + parts[1] + "." + parts[2];
        for (int i = 1; i < 255; i++) {
            String ip = base + "." + i;
            JSONObject peer = probeHealth(ip);
            if (peer != null) {
                synchronized (peers) {
                    peers.put(ip, peer);
                }
            }
        }
    }

    private JSONObject probeHealth(String ip) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL("http://" + ip + ":" + HTTP_PORT + "/api/health");
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(700);
            conn.setReadTimeout(700);
            conn.setRequestMethod("GET");
            if (conn.getResponseCode() != 200) return null;
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            JSONObject j = new JSONObject(sb.toString());
            if (!j.optBoolean("ok") || !"lan-share".equals(j.optString("name"))) return null;
            JSONObject out = new JSONObject();
            out.put("ip", j.optString("ip", ip));
            out.put("port", j.optInt("port", HTTP_PORT));
            out.put("version", j.optString("version"));
            out.put("hostname", j.optString("hostname", ip));
            out.put("seenAt", System.currentTimeMillis());
            return out;
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    public void destroy() {
        running = false;
        try {
            if (socket != null) socket.close();
        } catch (Exception ignored) {}
    }
}
