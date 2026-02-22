export interface CommentTag {
  text: string;
  type: 'word' | 'line'; // 'word' paints only the match, 'line' paints the rest of the comment
  color?: string;
  backgroundColor?: string;
  strikethrough?: boolean;
  fontWeight?: string; // bold?
}

export const defaultTags: CommentTag[] = [
  // Colorful Comments (paint the whole line from the tag onwards)
  { text: '!', type: 'line', color: '#FF3333' }, // Alert / Error      → Red
  { text: '?', type: 'line', color: '#3B9EFF' }, // Question           → Blue
  { text: '*', type: 'line', color: '#23D18B' }, // Highlight          → Green
  { text: '^', type: 'line', color: '#FFD602' }, // Warning            → Yellow
  { text: '#', type: 'line', color: '#FF922B' }, // Section / Header   → Orange
  { text: '$', type: 'line', color: '#20C5C5' }, // Resource / Value   → Cyan
  { text: '%', type: 'line', color: '#F4A261' }, // Ratio / Percent    → Amber
  { text: '@', type: 'line', color: '#A8FF3E' }, // Reference / Tag    → Lime
  { text: '&', type: 'line', color: '#FF4ECD' }, // Important          → Pink
  { text: '~', type: 'line', color: '#B267E6' }, // Deprecated         → Purple
  { text: '////', type: 'line', color: '#5A5A5A', strikethrough: true }, // Removed → Grey

  // Keyword badges (only the keyword itself is painted)
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
