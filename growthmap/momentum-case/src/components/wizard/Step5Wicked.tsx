'use client';

import { useAssignmentStore } from '@/store/useAssignmentStore';

const FIELDS = [
  { key: 'track', label: '賽道', placeholder: '例：AI 解決方案' },
  { key: 'description', label: '說明', placeholder: '簡述此賽道的業務範疇' },
  { key: 'challenge', label: '挑戰', placeholder: '目前面臨的主要挑戰' },
  { key: 'wickedType', label: '棘手型挑戰', placeholder: '為何此挑戰特別棘手？' },
  { key: 'guideline', label: '指導原則', placeholder: '建議的應對方向' },
] as const;

export default function Step5Wicked() {
  const {
    wickedChallenges,
    addWickedChallenge,
    updateWickedChallenge,
    removeWickedChallenge,
  } = useAssignmentStore();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">棘手型挑戰</h2>
          <p className="text-sm text-gray-400 mt-1">
            辨識並記錄各賽道面臨的棘手型（Wicked）挑戰與指導原則。
          </p>
        </div>
        <button
          onClick={addWickedChallenge}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00A651] text-white hover:bg-[#00A651]/90 transition-all flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span>
          新增挑戰
        </button>
      </div>

      {wickedChallenges.length === 0 ? (
        <div className="bg-[#242442] rounded-xl border border-white/10 p-12 text-center">
          <p className="text-gray-500">尚無棘手型挑戰。點擊上方按鈕新增。</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {wickedChallenges.map((wc, idx) => (
            <div
              key={wc.id}
              className="bg-[#242442] rounded-xl border border-white/10 p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">
                  挑戰 #{idx + 1}
                </h3>
                <button
                  onClick={() => removeWickedChallenge(wc.id)}
                  className="text-red-400 hover:text-red-300 text-sm transition-colors"
                >
                  刪除
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className={field.key === 'description' || field.key === 'wickedType' || field.key === 'guideline' ? 'md:col-span-2' : ''}
                  >
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      {field.label}
                    </label>
                    {(field.key === 'description' || field.key === 'wickedType' || field.key === 'guideline') ? (
                      <textarea
                        value={wc[field.key]}
                        onChange={(e) =>
                          updateWickedChallenge(wc.id, { [field.key]: e.target.value })
                        }
                        placeholder={field.placeholder}
                        rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00A651] transition-colors resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={wc[field.key]}
                        onChange={(e) =>
                          updateWickedChallenge(wc.id, { [field.key]: e.target.value })
                        }
                        placeholder={field.placeholder}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00A651] transition-colors"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
