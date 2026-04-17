import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CloudProvider } from "@/components/CloudProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BW CEO 班 — 成長藍圖實作平台",
  description: "商周百億 CEO 班課後作業：營收拆解樹 × 瀑布圖視覺化",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          #app-loading{font-family:system-ui,-apple-system,sans-serif;position:fixed;inset:0;z-index:9999;background:#eef1f5;display:flex;flex-direction:column}
          #app-loading .al-hdr{background:rgba(255,255,255,.6);border-bottom:1px solid rgba(255,255,255,.4);padding:16px 24px;box-shadow:0 2px 12px rgba(0,0,0,.04)}
          #app-loading .al-wrap{max-width:80rem;margin:0 auto;width:100%}
          #app-loading .al-row{display:flex;align-items:center;gap:16px}
          #app-loading .al-title{font-size:1.25rem;font-weight:700;color:#1f2937}
          #app-loading .al-green{color:#00A651}
          #app-loading .al-sub{font-size:.875rem;color:#6b7280;margin-top:2px}
          #app-loading .al-nav{background:rgba(255,255,255,.6);border-bottom:1px solid rgba(255,255,255,.4);padding:12px 24px}
          #app-loading .al-steps{display:flex;gap:4px}
          #app-loading .al-step{height:40px;width:80px;border-radius:8px;background:#e5e7eb;animation:al-p 1.5s ease-in-out infinite}
          #app-loading .al-center{flex:1;display:flex;align-items:center;justify-content:center}
          #app-loading .al-spin{width:40px;height:40px;border:4px solid #00A651;border-top-color:transparent;border-radius:50%;animation:al-s .8s linear infinite;margin-bottom:16px}
          #app-loading .al-hint{color:#9ca3af;font-size:.875rem}
          #app-loading .al-progress{width:220px;height:6px;background:#e5e7eb;border-radius:3px;margin:16px auto 0;overflow:hidden}
          #app-loading .al-bar{height:100%;width:0;background:#00A651;border-radius:3px;transition:width 1s ease-out}
          @keyframes al-s{to{transform:rotate(360deg)}}
          @keyframes al-p{0%,100%{opacity:.6}50%{opacity:1}}
        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        {/* Fixed overlay skeleton — removed by WizardShell on mount */}
        <div id="app-loading">
          <div className="al-hdr">
            <div className="al-wrap">
              <div className="al-row">
                <div>
                  <div className="al-title"><span className="al-green">BW</span> 成長藍圖實作平台</div>
                  <div className="al-sub">建立自然增長情境（Momentum Case）</div>
                </div>
              </div>
            </div>
          </div>
          <div className="al-nav">
            <div className="al-wrap">
              <div className="al-steps">
                <div className="al-step" /><div className="al-step" /><div className="al-step" />
                <div className="al-step" /><div className="al-step" /><div className="al-step" />
              </div>
            </div>
          </div>
          <div className="al-center">
            <div style={{ textAlign: 'center' }}>
              <div className="al-spin" style={{ margin: '0 auto 16px' }} />
              <div className="al-hint">載入中…</div>
              <div className="al-progress"><div className="al-bar" id="al-bar" /></div>
            </div>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var b=document.getElementById('al-bar');if(!b)return;var p=0,i=setInterval(function(){p+=p<60?6:p<85?2:0.3;if(p>95)p=95;b.style.width=p+'%'},1000)})()` }} />
        <CloudProvider />
        {children}
      </body>
    </html>
  );
}
