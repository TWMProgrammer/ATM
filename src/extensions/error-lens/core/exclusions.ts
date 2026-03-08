import * as path from 'path';

// ── Carpetas que no aportan valor visual para errores en línea (Error Lens)
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

// ── Archivos exactos que se deben ignorar por rendimiento y ruido (Lockfiles)
const IGNORED_FILENAMES = new Set([
  'bun.lock',         
  'bun.lockb',        
  'package-lock.json',
  'yarn.lock',        
  'pnpm-lock.yaml',   
  'composer.lock',    
  'cargo.lock',       
  'poetry.lock',      
  'pubspec.lock',      // Específico para tu ecosistema de Flutter
]);

// ── Extensiones de archivos donde mostrar errores en línea es inútil o pesado
const IGNORED_EXTENSIONS = new Set([
  '.min.js',  
  '.min.css', 
  '.map',     
  '.svg',     // Gráficos de vectores (XML gigantes, ruido visual innecesario)
  '.log',     
  '.snap',    
  '.yaml',    // Ignorado según tu requerimiento (archivos de datos muy largos)
  '.yml',     // Variante común de yaml
  '.json',    // Archivos de configuración, a menudo enormes
]);

/**
 * Retorna `true` si el archivo debe ser **excluido** de Error Lens.
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
