/* =========================================================
 * 🏷️ TYPES
 * ========================================================= */
export interface CommentTag {
  text: string;
  type: 'word' | 'line'; // 'word' colors only the match, 'line' colors the rest of the comment
  color?: string;
  backgroundColor?: string;
  strikethrough?: boolean;
  fontWeight?: string; // bold?
  fontStyle?: string; // italic?
}

/* =========================================================
 * 🎨 DEFAULT TAGS
 * ========================================================= */
export const defaultTags: CommentTag[] = [
  // Colorful Line Comments (colors the whole line from the tag onwards)
  { text: '!', type: 'line', color: '#FF3333', fontStyle: 'italic' },     // Alert / Error    → Red
  { text: '?', type: 'line', color: '#3297fbff', fontStyle: 'italic' },   // Question         → Blue
  { text: '*', type: 'line', color: '#464646', fontStyle: 'italic' },   // Highlight        → Purple
  { text: '^', type: 'line', color: '#FFD602', fontStyle: 'italic' },     // Warning          → Yellow
  { text: '#', type: 'line', color: '#ff7a27', fontStyle: 'italic' },     // Section / Header → Orange
  { text: '$', type: 'line', color: '#4ae4fc', fontStyle: 'italic' },   // Resource / Value → Sky Blue
  { text: '%', type: 'line', color: '#ffffff', fontStyle: 'italic' },     // Ratio / Percent  → Amber
  { text: '>', type: 'line', color: '#01b887ff', fontStyle: 'italic' },   // Reference / Tag  → Emerald
  { text: '&', type: 'line', color: '#FF4ECD', fontStyle: 'italic' },     // Important        → Pink
  { text: '~', type: 'line', color: '#aef958ff', fontStyle: 'italic' },   // Deprecated       → Lime
  { text: '////', type: 'line', color: '#5A5A5A', strikethrough: true },  // Removed          → Grey

  // Keyword badges (only the keyword itself is highlighted)
  {
    text: 'TODO:',
    type: 'word',
    color: '#1a1a1a',
    backgroundColor: '#FFD602',
    fontWeight: 'bold',
  },
  {
    text: 'FIXME:',
    type: 'word',
    color: '#ffffff',
    backgroundColor: '#ff3366ff',
    fontWeight: 'bold',
  },
  {
    text: 'NOTE:',
    type: 'word',
    color: '#ffffff',
    backgroundColor: '#23D18B',
    fontWeight: 'bold',
  },
  {
    text: 'MARK:',
    type: 'word',
    color: '#ffffff',
    backgroundColor: '#5A6A85',
    fontWeight: 'bold',
  },
];
