import * as path from 'path';

/* =========================================================
 * 📁 IGNORED FOLDERS
 * Folders that provide no visual value for inline errors
 * ========================================================= */
const IGNORED_FOLDERS = new Set([
  'node_modules',
  'vendor',     
  'dist',         
  'build',        
  'out',          
  '.git',         
  '.next',        
  '.nuxt',        
  '.svelte-kit',
  '.angular',
  '.cache',       
  'coverage',     
]);

/* =========================================================
 * 📄 IGNORED FILENAMES
 * Exact files to ignore for performance and noise reduction
 * ========================================================= */
const IGNORED_FILENAMES = new Set([
  'bun.lock',         
  'bun.lockb',        
  'package-lock.json',
  'yarn.lock',        
  'pnpm-lock.yaml',   
  'composer.lock',    
  'cargo.lock',       
  'poetry.lock',      
  'pubspec.lock',
]);

/* =========================================================
 * 🧩 IGNORED EXTENSIONS
 * File extensions where inline errors are useless or heavy
 * ========================================================= */
const IGNORED_EXTENSIONS = new Set([
  '.min.js',  
  '.min.css', 
  '.map',     
  '.svg',
  '.log',     
  '.snap',    
  '.yaml',
  '.yml',
  '.json',
]);

/**
 * Returns `true` if the file should be **excluded** from Error Lens.
 */
export function shouldExcludeFromErrorLens(fsPath: string): boolean {
  if (!fsPath) {
    return true;
  }
  
  const normalized = fsPath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const basename = path.basename(normalized).toLowerCase();

  for (const seg of segments) {
    if (IGNORED_FOLDERS.has(seg)) {
      return true;
    }
  }

  if (IGNORED_FILENAMES.has(basename)) {
    return true;
  }

  const ext = path.extname(basename);
  if (ext && IGNORED_EXTENSIONS.has(ext)) {
    return true;
  }

  if (basename.endsWith('.min.js') || basename.endsWith('.min.css')) {
    return true;
  }

  return false;
}
