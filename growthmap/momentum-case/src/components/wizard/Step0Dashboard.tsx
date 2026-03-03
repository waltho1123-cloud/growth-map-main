'use client';

import { useAssignmentStore } from '@/store/useAssignmentStore';

const TASKS = [
  {
    step: 1,
    title: 'Task 1：營收拆解樹',
    description: '建立公司營收驅動因子的樹狀結構，拆解到最小可量化的因子。',
    icon: '🌳',
  },
  {
    step: 2,
    title: 'Task 2：驅動因子設定',
    description: '為每個葉節點設定歷史貢獻度與未來成長假設百分比。',
    icon: '📊',
  },
  {
    step: 3,
    title: 'Task 3：歷史瀑布圖',
    description: '視覺化過去各驅動因子對營收成長的貢獻度。',
    icon: '📈',
  },
  {
    step: 4,
    title: 'Task 4：未來預測瀑布圖',
    description: '根據假設預測未來各因子的成長貢獻，支援匯出。',
    icon: '🔮',
  },
  {
    step: 5,
    title: 'Task 5：棘手型挑戰',
    description: '辨識並記錄各賽道面臨的棘手型挑戰與指導原則。',
    icon: '⚡',
  },
];

export default function Step0Dashboard() {
  const { setCurrentStep } = useAssignmentStore();

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="text-center py-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-3">
          歡迎來到<span className="text-[#00A651]">成長藍圖</span>實作平台
        </h2>
        <p className="text-gray-500 max-w-2xl mx-auto">
          本平台協助您完成商周百億 CEO 班的課後作業。請依序完成以下五個任務，
          建構您企業的營收成長藍圖。
        </p>
      </div>

      {/* External Survey Link */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#00A651]/20 flex items-center justify-center text-2xl">
            📋
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800">課前問卷</h3>
            <p className="text-sm text-gray-500">請先完成課前問卷，以便講師了解您的企業現況。</p>
          </div>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[#00A651] text-white hover:bg-[#00A651]/90 transition-all"
          >
            前往填寫 →
          </a>
        </div>
      </div>

      {/* Task Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TASKS.map((task) => (
          <button
            key={task.step}
            onClick={() => setCurrentStep(task.step)}
            className="glass-card glass-card-hover rounded-xl p-6 transition-all text-left group"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{task.icon}</span>
              <div>
                <h3 className="text-base font-semibold text-gray-800 group-hover:text-[#00A651] transition-colors">
                  {task.title}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{task.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
