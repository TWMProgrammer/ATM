export interface CommentTag {
  text: string;
  type: 'word' | 'line'; // 'word' paints only the match, 'line' paints the rest of the comment
  color?: string;
  backgroundColor?: string;
  strikethrough?: boolean;
  fontWeight?: string; // bold?
}

export const defaultTags: CommentTag[] = [
  // Colorful Comments (Afectan a toda la línea a partir del tag)
  { text: '!', type: 'line', color: '#FF2D00' }, // Alert / Error
  { text: '?', type: 'line', color: '#3498DB' }, // Question / Detail
  { text: '*', type: 'line', color: '#98C379' }, // Highlight
  { text: '////', type: 'line', color: '#474747', strikethrough: true }, // Striked

  // Todo Highlight (Afectan solo a la palabra)
  {
    text: 'TODO:',
    type: 'word',
    color: '#ffffff',
    backgroundColor: '#ffbd2a',
    fontWeight: 'bold',
  },
  {
    text: 'TODO',
    type: 'word',
    color: '#ffffff',
    backgroundColor: '#ffbd2a',
    fontWeight: 'bold',
  }, // sin dos puntos también
  {
    text: 'FIXME:',
    type: 'word',
    color: '#ffffff',
    backgroundColor: '#f06292',
    fontWeight: 'bold',
  },
  {
    text: 'FIXME',
    type: 'word',
    color: '#ffffff',
    backgroundColor: '#f06292',
    fontWeight: 'bold',
  },
  {
    text: 'NOTE:',
    type: 'word',
    color: '#ffffff',
    backgroundColor: '#4caf50',
    fontWeight: 'bold',
  },
];
