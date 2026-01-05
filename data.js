// ========================================
// VRC改変ログ - サンプルデータ
// ========================================

const sampleAvatars = [
  { id: 'avatar_001', name: '舞夜', creator: 'まおー商店', boothUrl: 'https://booth.pm/' },
  { id: 'avatar_002', name: 'セレスティア', creator: 'SKYMY工房', boothUrl: 'https://booth.pm/' },
  { id: 'avatar_003', name: 'マヌカ', creator: 'komado', boothUrl: 'https://booth.pm/' },
  { id: 'avatar_004', name: '桔梗', creator: 'ponderogen', boothUrl: 'https://booth.pm/' },
  { id: 'avatar_005', name: 'ルーシュカ', creator: 'るしか商店', boothUrl: 'https://booth.pm/' },
  { id: 'avatar_006', name: 'リミリー', creator: 'SKYMY工房', boothUrl: 'https://booth.pm/' },
  { id: 'avatar_007', name: 'イメリス', creator: 'Atelier Krull', boothUrl: 'https://booth.pm/' }
];

const sampleParts = [
  { id: 'parts_001', name: 'ふわふわワンピース', type: '衣装', creator: 'おしゃれ工房' },
  { id: 'parts_002', name: 'ゆめかわツインテール', type: '髪', creator: 'ヘアサロンVR' },
  { id: 'parts_003', name: 'きらきらリボン', type: '小物', creator: 'アクセ屋さん' },
  { id: 'parts_004', name: 'メイド服セット', type: '衣装', creator: 'お仕え堂' },
  { id: 'parts_005', name: 'ネコミミヘッドセット', type: '小物', creator: 'ケモ耳工房' },
  { id: 'parts_006', name: 'ロングストレート', type: '髪', creator: 'ヘアサロンVR' },
  { id: 'parts_007', name: 'サイバーパンクスーツ', type: '衣装', creator: 'NeonWear' },
  { id: 'parts_008', name: 'ウェーブボブ', type: '髪', creator: '美容室ミラクル' }
];

// Unity バージョン選択肢
const unityVersionOptions = [
  '2022.3.22f1',
  '2022.3.6f1',
  '2022.3.17f1',
  '2019.4.31f1',
  'その他'
];

// VRC SDK バージョン選択肢
const vrcSdkVersionOptions = [
  '3.5.2',
  '3.5.1',
  '3.5.0',
  '3.4.2',
  '3.4.1',
  'その他'
];

const problemOptions = [
  'ボーン不一致',
  'テクスチャ調整が必要',
  'シェイプキー不足',
  'マテリアルエラー',
  'PhysBone設定',
  'アーマチュア調整',
  'UV調整',
  '貫通・めり込み',
  '特になし'
];

// 人気タグ
const popularTags = [
  '#初心者向け',
  '#簡単',
  '#対応衣装',
  '#MA対応',
  '#liltoon',
  '#PhysBone',
  '#かわいい系',
  '#クール系',
  '#ゴシック',
  '#カジュアル'
];

// 使用ツール選択肢
const toolOptions = [
  'Modular Avatar',
  'Avatar Optimizer (AAO)',
  'lilToon',
  'PhysBone',
  'VRC Quest Tools',
  'Gesture Manager',
  'Animation Validator'
];

const sampleLogs = [
  {
    id: 'log_001',
    title: '舞夜にふわふわワンピースを着せてみた',
    avatarId: 'avatar_001',
    partsIds: ['parts_001', 'parts_003'],
    unityVersion: '2022.3.22f1',
    vrcSdkVersion: '3.5.2',
    difficulty: 'beginner',
    successRate: 5,
    problems: ['特になし'],
    solution: '対応アバターだったのでそのまま着せられました！ボーンの設定も最初から合っていて、5分で完了しました。',
    tags: ['#初心者向け', '#簡単', '#対応衣装'],
    tools: ['Modular Avatar', 'lilToon'],
    referenceLinks: ['https://shop.booth.pm/items/example'],
    images: [],
    createdAt: '2026-01-05',
    userId: 'user_001'
  },
  {
    id: 'log_002',
    title: 'セレスティアにメイド服を着せる方法',
    avatarId: 'avatar_002',
    partsIds: ['parts_004'],
    unityVersion: '2022.3.22f1',
    vrcSdkVersion: '3.5.1',
    difficulty: 'intermediate',
    successRate: 4,
    problems: ['ボーン不一致', 'テクスチャ調整が必要'],
    solution: 'Clothesの正規化を行った後、ボーンをAvatar側にマージ。胸のシェイプキーを調整して、最終的にきれいに着せることができました。',
    tags: ['#かわいい系', '#liltoon'],
    tools: ['Avatar Optimizer (AAO)', 'lilToon'],
    referenceLinks: [],
    images: [],
    createdAt: '2026-01-04',
    userId: 'user_002'
  },
  {
    id: 'log_003',
    title: 'マヌカにゆめかわツインテールを付けた記録',
    avatarId: 'avatar_003',
    partsIds: ['parts_002'],
    unityVersion: '2022.3.6f1',
    vrcSdkVersion: '3.4.2',
    difficulty: 'beginner',
    successRate: 5,
    problems: ['特になし'],
    solution: 'Modular Avatar対応だったので、ドラッグ&ドロップで完了！PhysBoneの設定も自動で行われました。',
    tags: ['#初心者向け', '#MA対応', '#簡単'],
    tools: ['Modular Avatar'],
    referenceLinks: [],
    images: [],
    createdAt: '2026-01-03',
    userId: 'user_001'
  },
  {
    id: 'log_004',
    title: '桔梗にサイバーパンクスーツを改変した話',
    avatarId: 'avatar_004',
    partsIds: ['parts_007', 'parts_005'],
    unityVersion: '2022.3.22f1',
    vrcSdkVersion: '3.5.2',
    difficulty: 'advanced',
    successRate: 3,
    problems: ['ボーン不一致', 'アーマチュア調整', '貫通・めり込み'],
    solution: 'ボーン構造が異なるため、手動でリグを調整。肩と腕のウェイトを再ペイントしました。ネコミミは別途頭に付けて、PhysBone設定を新規作成。',
    tags: ['#クール系', '#PhysBone'],
    tools: ['PhysBone', 'lilToon'],
    referenceLinks: [],
    images: [],
    createdAt: '2026-01-02',
    userId: 'user_003'
  },
  {
    id: 'log_005',
    title: 'ルーシュカ × ロングストレート 組み合わせ',
    avatarId: 'avatar_005',
    partsIds: ['parts_006'],
    unityVersion: '2022.3.22f1',
    vrcSdkVersion: '3.5.0',
    difficulty: 'beginner',
    successRate: 4,
    problems: ['PhysBone設定'],
    solution: '髪の毛との衝突設定を調整。PhysBonesのコライダーを手動で追加して、めり込みを解消しました。',
    tags: ['#初心者向け', '#PhysBone'],
    tools: ['PhysBone'],
    referenceLinks: [],
    images: [],
    createdAt: '2026-01-01',
    userId: 'user_002'
  },
  {
    id: 'log_006',
    title: 'リミリーにウェーブボブヘアを着せてみた',
    avatarId: 'avatar_006',
    partsIds: ['parts_008', 'parts_003'],
    unityVersion: '2022.3.22f1',
    vrcSdkVersion: '3.5.2',
    difficulty: 'intermediate',
    successRate: 4,
    problems: ['テクスチャ調整が必要', 'マテリアルエラー'],
    solution: 'シェーダーがliltoonに対応していなかったため、マテリアルを再設定。色味の調整に少し時間がかかりました。',
    tags: ['#liltoon', '#かわいい系'],
    tools: ['lilToon'],
    referenceLinks: [],
    images: [],
    createdAt: '2025-12-30',
    userId: 'user_001'
  }
];

// アバター入力候補マスタ
const avatarPresets = [
  '舞夜',
  'セレスティア',
  'マヌカ',
  '桔梗',
  'ルーシュカ',
  'リミリー',
  'イメリス',
  'カリン',
  'ラスク',
  '萌',
  'その他'
];

// お知らせデータ
const announcements = [
  { id: 'ann_001', text: 'サイトをリニューアルしました！新機能が盛りだくさんです。', level: 'info', date: '2026-01-05' },
  { id: 'ann_002', text: '【重要】パスワードリセット機能を追加しました。', level: 'important', date: '2026-01-05' }
];

// Export for use in app.js
if (typeof window !== 'undefined') {
  window.sampleData = {
    avatars: sampleAvatars,
    parts: sampleParts,
    logs: sampleLogs.map(log => ({ ...log, comments: [] })), // Add empty comments array to initial logs
    problemOptions: problemOptions,
    toolOptions: toolOptions,
    unityVersionOptions: unityVersionOptions,
    vrcSdkVersionOptions: vrcSdkVersionOptions,
    popularTags: popularTags,
    avatarPresets: avatarPresets,
    announcements: announcements
  };
}
