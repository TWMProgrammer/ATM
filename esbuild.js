const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const extensionEsbuildProblemMatcherPlugin = {
	name: 'extension-esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

const browserEsbuildProblemMatcherPlugin = {
	name: 'browser-esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[browser-watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[browser-watch] build finished');
		});
	},
};

async function main() {
	const extensionCtx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [extensionEsbuildProblemMatcherPlugin],
	});

	const browserCtx = await esbuild.context({
		entryPoints: [
			'src/extensions/markdown-md/ui/mermaidPreview.ts',
			'src/extensions/markdown-mdx/ui/mdxPreviewWebview.ts',
			'src/extensions/git-better/gitlab-panel/panels/header/header.ts',
			'src/extensions/git-better/gitlab-panel/panels/graphics-top/graphics.ts',
			'src/extensions/git-better/gitlab-panel/panels/stats-left/stats.ts',
			'src/extensions/git-better/gitlab-panel/panels/commits-center/commits.ts',
			'src/extensions/git-better/gitlab-panel/panels/inspect-right/inspect.ts',
			'src/extensions/screenshot-code/ui/webview.ts',
			'src/extensions/screenshot-code/ui/styles.css',
			'src/extensions/focus/screens/atm-data/screenshot/ui/index.ts'
		],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		target: ['es2020'],
		outdir: 'dist',
		entryNames: '[name]',
		logLevel: 'silent',
		plugins: [browserEsbuildProblemMatcherPlugin],
	});

	const focusWebviewCtx = await esbuild.context({
		entryPoints: ['src/extensions/focus/view/ui/index.ts'],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'dist/atm-music-webview.js',
		logLevel: 'silent',
		plugins: [browserEsbuildProblemMatcherPlugin],
	});

	if (watch) {
		await extensionCtx.watch();
		await browserCtx.watch();
		await focusWebviewCtx.watch();
	} else {
		await extensionCtx.rebuild();
		await extensionCtx.dispose();
		await browserCtx.rebuild();
		await browserCtx.dispose();
		await focusWebviewCtx.rebuild();
		await focusWebviewCtx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
