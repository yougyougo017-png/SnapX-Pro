export const DEMO_CAPTURES = [
  {
    id: 'demo-aurora',
    demo: true,
    title: 'Aurora analytics dashboard',
    src: 'snapx://sample/aurora-analytics.svg',
    thumbnailUrl: 'snapx://sample/aurora-analytics.svg',
    width: 1600,
    height: 1000,
    bytes: 2482000,
    createdAt: '2026-10-18T09:24:00.000Z',
    source: 'window',
    kind: 'image',
    tags: ['dashboard', 'design', 'data'],
    favorite: true,
    aiSummary: 'A polished SaaS analytics overview with revenue, active users, conversion, and acquisition source breakdowns.'
  },
  {
    id: 'demo-checkout',
    demo: true,
    title: 'SnapX Pro — secure checkout',
    src: 'snapx://sample/secure-checkout.svg',
    thumbnailUrl: 'snapx://sample/secure-checkout.svg',
    width: 1600,
    height: 1000,
    bytes: 2098000,
    createdAt: '2026-10-17T16:05:00.000Z',
    source: 'browser',
    kind: 'image',
    tags: ['checkout', 'design', 'sensitive'],
    favorite: false,
    aiSummary: 'A secure checkout page for SnapX Pro. The screenshot contains email, password, card number and CVC fields that Auto Blur can hide.'
  },
  {
    id: 'demo-kyoto',
    demo: true,
    title: 'Kyoto in eleven quiet moments',
    src: 'snapx://sample/kyoto-journal.svg',
    thumbnailUrl: 'snapx://sample/kyoto-journal.svg',
    width: 1600,
    height: 2600,
    bytes: 3184000,
    createdAt: '2026-10-12T11:40:00.000Z',
    source: 'scrolling',
    kind: 'image',
    tags: ['travel', 'editorial', 'long capture'],
    favorite: false,
    aiSummary: 'A long-form editorial travel page about Kyoto, captured as a full-page scrolling screenshot.'
  },
  {
    id: 'demo-code',
    demo: true,
    title: 'CaptureToolbar.tsx',
    src: 'snapx://sample/midnight-code.svg',
    thumbnailUrl: 'snapx://sample/midnight-code.svg',
    width: 1600,
    height: 1000,
    bytes: 1976000,
    createdAt: '2026-10-08T20:15:00.000Z',
    source: 'window',
    kind: 'image',
    tags: ['code', 'typescript', 'ai'],
    favorite: true,
    aiSummary: 'A TypeScript React capture toolbar component with an AI code insight panel. Detected language: TypeScript.'
  },
  {
    id: 'demo-velocity',
    demo: true,
    title: 'Neon Velocity — lap 3',
    src: 'snapx://sample/neon-velocity.svg',
    thumbnailUrl: 'snapx://sample/neon-velocity.svg',
    width: 1600,
    height: 1000,
    bytes: 2847000,
    createdAt: '2026-09-29T22:10:00.000Z',
    source: 'game',
    kind: 'image',
    tags: ['game', 'neon', 'fps'],
    favorite: false,
    aiSummary: 'A frame-perfect game capture from a neon racing game, showing a lap 3 HUD and 284 km/h speed readout.'
  },
  {
    id: 'demo-atelier',
    demo: true,
    title: 'Aurelia — golden hour',
    src: 'snapx://sample/golden-atelier.svg',
    thumbnailUrl: 'snapx://sample/golden-atelier.svg',
    width: 1600,
    height: 1000,
    bytes: 2319000,
    createdAt: '2026-09-21T17:30:00.000Z',
    source: 'browser',
    kind: 'image',
    tags: ['web', 'design', 'luxury'],
    favorite: false,
    aiSummary: 'A luxury e-commerce landing page in a warm editorial style, with liquid-gold sculptural artwork.'
  }
];

export const QUICK_MODES = [
  {
    id: 'region',
    name: 'Rectangle',
    description: 'Drag a precise area',
    icon: 'rectangle',
    shortcut: 'Ctrl Shift 1',
    accent: true
  },
  {
    id: 'window',
    name: 'Window',
    description: 'Grab any open window',
    icon: 'window',
    shortcut: 'Ctrl Shift 3'
  },
  {
    id: 'full',
    name: 'Full display',
    description: 'Every pixel, instantly',
    icon: 'monitor',
    shortcut: 'Ctrl Shift 2'
  },
  {
    id: 'scroll',
    name: 'Scrolling',
    description: 'Entire pages & apps',
    icon: 'scroll',
    badge: 'BETA'
  },
  {
    id: 'lasso',
    name: 'Freeform',
    description: 'Draw any shape',
    icon: 'lasso',
    badge: 'NEW'
  },
  {
    id: 'delay',
    name: 'Delayed',
    description: '1s · 3s · 5s · 10s',
    icon: 'timer'
  },
  {
    id: 'video',
    name: 'Video',
    description: 'Cinematic screen capture',
    icon: 'video',
    badge: '60 FPS'
  },
  {
    id: 'gif',
    name: 'GIF',
    description: 'Tiny, perfect loops',
    icon: 'gif',
    badge: 'NEW'
  }
];

export const CAPTURE_MODES = [
  { id: 'region', name: 'Rectangle', icon: 'rectangle', hint: 'Drag to capture any area' },
  { id: 'window', name: 'Window', icon: 'window', hint: 'Pick an open window' },
  { id: 'full', name: 'Display', icon: 'monitor', hint: 'Capture the full display' },
  { id: 'multi', name: 'All displays', icon: 'monitors', hint: 'Capture every monitor' },
  { id: 'scroll', name: 'Scrolling', icon: 'scroll', hint: 'Full pages and apps', badge: 'BETA' },
  { id: 'lasso', name: 'Freeform', icon: 'lasso', hint: 'Draw any shape', badge: 'NEW' },
  { id: 'video', name: 'Record', icon: 'video', hint: 'Record a display', badge: '60 FPS' },
  { id: 'gif', name: 'GIF', icon: 'gif', hint: 'Create a looping clip', badge: 'NEW' }
];

export const AI_TOOLS = [
  {
    id: 'ocr',
    name: 'AI OCR',
    label: 'Extract text',
    icon: 'scanText',
    description: 'Copy every word from pixels — even from screenshots that were never text.',
    action: 'Run OCR'
  },
  {
    id: 'blur',
    name: 'Auto Blur',
    label: 'Hide sensitive info',
    icon: 'shield',
    description: 'Find emails, passwords, keys and personal details, then blur them in one click.',
    action: 'Find sensitive data'
  },
  {
    id: 'summary',
    name: 'AI Summary',
    label: 'Understand instantly',
    icon: 'sparkle',
    description: 'Turn any screenshot into a clean title, summary, bullet points and tags.',
    action: 'Summarize capture'
  },
  {
    id: 'code',
    name: 'Code Detection',
    label: 'Extract clean code',
    icon: 'fileCode',
    description: 'Detect the language, copy the code and explain what it does.',
    action: 'Detect code'
  },
  {
    id: 'colors',
    name: 'Color Palette',
    label: 'Pull the palette',
    icon: 'themes',
    description: 'Extract the dominant colors from any capture and copy their hex values.',
    action: 'Extract palette',
    local: true
  },
  {
    id: 'upscale',
    name: 'Smart Upscale',
    label: 'Sharpen every pixel',
    icon: 'upscale',
    description: 'Create a crisp 2× version locally with high-quality resampling.',
    action: 'Upscale 2×',
    local: true
  },
  {
    id: 'qr',
    name: 'QR Scanner',
    label: 'Read any code',
    icon: 'qr',
    description: 'Detect QR codes inside screenshots and open or copy the result.',
    action: 'Scan for QR',
    local: true
  },
  {
    id: 'remove',
    name: 'Object Removal',
    label: 'Erase distractions',
    icon: 'wand',
    description: 'Describe anything you want gone. SnapX AI rebuilds the scene behind it.',
    action: 'Remove object',
    premium: true
  }
];

export const NAV_ITEMS = [
  { section: 'Workspace', items: [
    { id: 'dashboard', name: 'Dashboard', icon: 'dashboard' },
    { id: 'capture', name: 'Capture Studio', icon: 'capture', badge: 'LIVE' },
    { id: 'gallery', name: 'Library', icon: 'gallery' },
    { id: 'editor', name: 'Editor', icon: 'editor' },
    { id: 'ai', name: 'AI Studio', icon: 'ai', badge: 'AI' }
  ]},
  { section: 'Customize', items: [
    { id: 'themes', name: 'Themes', icon: 'themes' },
    { id: 'settings', name: 'Settings', icon: 'settings' }
  ]}
];

export const SMART_COLLECTIONS = [
  { id: 'all', label: 'All captures' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'design', label: 'Design' },
  { id: 'code', label: 'Code' },
  { id: 'game', label: 'Gaming' },
  { id: 'long', label: 'Long captures' }
];

export const DEMO_AI_RESULTS = {
  ocr: {
    text: `Good morning, Maya
Here’s what’s happening across your workspace today.

TOTAL REVENUE
$84,240
↑ 18.4% vs last month

ACTIVE USERS
12,892
↑ 9.7% vs last month

CONVERSION
6.82%
↓ 2.1% vs last month

AVG. SESSION
8m 42s
↑ 4.2% vs last month

Revenue flow
Monthly recurring revenue · last 12 months
$120k / $90k / $60k / $30k / $0
Dec · Jan · Feb · Mar · Apr · May · Jun · Jul · Aug · Sep · Oct · Nov

Quarterly goal
73% of $150k goal
Enterprise $52.4k
Growth $31.8k
Starter $25.6k`
  },
  summary: {
    title: 'Aurora analytics overview',
    summary: 'A polished SaaS analytics dashboard showing healthy revenue growth and audience engagement. Revenue is up 18.4% month over month, with enterprise customers driving nearly half of the quarterly goal.',
    bullets: [
      'Total revenue reached $84,240, up 18.4% month over month.',
      'Active users are up 9.7% to 12,892, while conversion softened slightly.',
      'Enterprise accounts contribute $52.4k of the $150k quarterly target.',
      'Google Search remains the strongest acquisition source at 7.84% conversion.'
    ],
    tags: ['analytics', 'saas', 'revenue', 'dashboard']
  },
  code: {
    language: 'TypeScript / React',
    code: `export function CaptureToolbar({ onOpenEditor, theme }: Props) {
  const { capture, isCapturing } = useCapture();
  const [active, setActive] = useState<Mode>('region');

  const handleCapture = async (mode: Mode) => {
    await capture({ mode, copyToClipboard: true });
    toast.success('Captured in 18ms');
  };

  return (
    <Glass className="capture-toolbar">
      <AnimatePresence>
        <motion.div layout>
          <GoldButton onClick={() => handleCapture(active)}
            disabled={isCapturing}>
            {isCapturing ? 'Capturing…' : 'Capture now'}
          </GoldButton>
        </motion.div>
      </AnimatePresence>
    </Glass>
  );
}`,
    explanation: 'This React component renders the floating capture toolbar. It uses a custom useCapture hook to grab the screen, copies the result to the clipboard first, and shows a toast once complete.'
  },
  blur: {
    regions: [
      { x: 0.479, y: 0.28, w: 0.448, h: 0.05, label: 'Email address', confidence: 0.99 },
      { x: 0.479, y: 0.378, w: 0.448, h: 0.05, label: 'Password', confidence: 0.98 },
      { x: 0.479, y: 0.476, w: 0.448, h: 0.054, label: 'Card number', confidence: 0.99 },
      { x: 0.71, y: 0.576, w: 0.216, h: 0.05, label: 'Security code', confidence: 0.97 },
      { x: 0.479, y: 0.674, w: 0.448, h: 0.05, label: 'Full name', confidence: 0.93 }
    ]
  },
  colors: {
    palette: [
      { hex: '#FFD700', name: 'Liquid Gold', share: 24 },
      { hex: '#0B4DFF', name: 'Royal Sapphire', share: 19 },
      { hex: '#070A12', name: 'Deep Space', share: 28 },
      { hex: '#7EA4FF', name: 'Frost Blue', share: 12 },
      { hex: '#3BE3A0', name: 'Mint Signal', share: 9 },
      { hex: '#FF6078', name: 'Soft Coral', share: 8 }
    ]
  }
};

export const CAPTURE_DELAYS = [0, 1, 3, 5, 10];

export const FORMAT_OPTIONS = ['png', 'jpeg', 'webp'];

export const FPS_OPTIONS = [30, 60, 120];
