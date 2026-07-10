import type { CommitEmojiEntry } from '../core/types';
import { features } from './features';
import { fixes } from './fixes';
import { tooling } from './tooling';
import { misc } from './misc';

const CommitEmoji: CommitEmojiEntry[] = [
	...features,
	...fixes,
	...tooling,
	...misc,
];

export default CommitEmoji;
