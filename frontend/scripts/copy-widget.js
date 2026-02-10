import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const source = join(__dirname, '../dist/widget/widget.js');
const dest = join(__dirname, '../public/widget.js');

try {
  // Ensure public directory exists
  const publicDir = join(__dirname, '../public');
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }
  
  // Check if source exists
  if (!existsSync(source)) {
    console.error('Error: widget.js not found at', source);
    console.error('Make sure you ran: vite build --config vite.widget.config.ts');
    process.exit(1);
  }
  
  // Copy widget.js to public
  copyFileSync(source, dest);
  console.log('✓ Copied widget.js to public/widget.js');
} catch (error) {
  console.error('Failed to copy widget.js:', error);
  process.exit(1);
}
