// 檔案下載共用（code-review #14：此前 P14/P06/Settings 各有一份複本且已漂移——
// 本檔為唯一正本；appendChild 是跨瀏覽器可靠性要件，勿省）

function trigger(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJson(filename, obj) {
  trigger(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename);
}

export function downloadText(filename, text, mime = 'text/markdown') {
  trigger(new Blob([text], { type: mime }), filename);
}
