'use client';

import { useAssignmentStore } from '@/store/useAssignmentStore';
import { IMEInput, IMETextarea } from '@/components/IMEInput';

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
          <h2 className="text-2xl font-bold text-gray-800">棘手型挑戰</h2>
          <p className="text-sm text-gray-500 mt-1">
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
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-gray-500">尚無棘手型挑戰。點擊上方按鈕新增。</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {wickedChallenges.map((wc, idx) => (
            <div
              key={wc.id}
              className="glass-card rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800">
                  挑戰 #{idx + 1}
                </h3>
                <button
                  onClick={() => removeWickedChallenge(wc.id)}
                  className="text-red-500 hover:text-red-600 text-sm transition-colors"
                >
                  刪除
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className={field.key === 'description' || field.key === 'challenge' || field.key === 'wickedType' || field.key === 'guideline' ? 'md:col-span-2' : ''}
                  >
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">
                      {field.label}
                    </label>
                    {(field.key === 'description' || field.key === 'challenge' || field.key === 'wickedType' || field.key === 'guideline') ? (
                      <IMETextarea
                        value={wc[field.key]}
                        onValueChange={(v) =>
                          updateWickedChallenge(wc.id, { [field.key]: v })
                        }
                        placeholder={field.placeholder}
                        rows={2}
                        className="w-full neu-input rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none resize-none"
                      />
                    ) : (
                      <IMEInput
                        type="text"
                        value={wc[field.key]}
                        onValueChange={(v) =>
                          updateWickedChallenge(wc.id, { [field.key]: v })
                        }
                        placeholder={field.placeholder}
                        className="w-full neu-input rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none"
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
