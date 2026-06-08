// Firebase ID token 驗證（無 firebase-admin 重依賴；用 Node 內建 crypto 驗 RS256）
//
// 驗證項目（對齊 Firebase 官方「手動驗證 ID token」規範）：
//   - JWT 結構與 header：alg=RS256、typ=JWT、kid 對應 Google 公鑰
//   - 簽章：用 securetoken@system 的 x509 公鑰以 RSA-SHA256 驗證
//   - claims：exp 未過期、iat 已生效、aud == projectId、
//             iss == https://securetoken.google.com/<projectId>、sub 非空
//
// 公鑰來源（Google 會輪替）：依 Cache-Control max-age 在記憶體快取。
import { createPublicKey, createVerify } from 'node:crypto';

const CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let certCache = { keys: null, expiresAt: 0 };

async function getCerts() {
  const now = Date.now();
  if (certCache.keys && now < certCache.expiresAt) return certCache.keys;

  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error(`無法取得 Firebase 公鑰（HTTP ${res.status}）`);
  const keys = await res.json();

  // 依 Cache-Control: max-age 決定快取時間；取不到時保守快取 1 小時
  let maxAge = 3600;
  const cc = res.headers.get('cache-control') || '';
  const m = cc.match(/max-age=(\d+)/);
  if (m) maxAge = Number(m[1]);
  certCache = { keys, expiresAt: now + maxAge * 1000 };
  return keys;
}

function b64urlToJson(seg) {
  return JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'));
}

/**
 * 驗證 Firebase ID token；成功回傳 decoded payload，失敗丟出 Error。
 * @param {string} token  ID token（不含 "Bearer " 前綴）
 * @param {string} projectId  Firebase 專案 ID
 */
export async function verifyFirebaseIdToken(token, projectId) {
  if (!projectId) throw new Error('伺服器未設定 FIREBASE_PROJECT_ID');
  if (!token || typeof token !== 'string') throw new Error('缺少 token');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('token 格式錯誤');
  const [headerSeg, payloadSeg, sigSeg] = parts;

  let header, payload;
  try {
    header = b64urlToJson(headerSeg);
    payload = b64urlToJson(payloadSeg);
  } catch {
    throw new Error('token 無法解析');
  }

  // 1) header
  if (header.alg !== 'RS256') throw new Error('簽章演算法須為 RS256');
  if (!header.kid) throw new Error('token 缺少 kid');

  // 2) 簽章
  const certs = await getCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('找不到對應的簽章公鑰（kid 不符或已輪替）');
  const publicKey = createPublicKey(cert);
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerSeg}.${payloadSeg}`);
  verifier.end();
  const valid = verifier.verify(publicKey, Buffer.from(sigSeg, 'base64url'));
  if (!valid) throw new Error('簽章驗證失敗');

  // 3) claims
  const nowSec = Math.floor(Date.now() / 1000);
  const skew = 60; // 容許 60 秒時鐘誤差
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec - skew) {
    throw new Error('token 已過期');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + skew) {
    throw new Error('token 尚未生效');
  }
  if (payload.aud !== projectId) throw new Error('token aud 不符');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('token iss 不符');
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('token sub 無效');
  }

  return payload;
}
