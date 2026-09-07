import fs from 'node:fs/promises'; 
import path from 'node:path'; 
export function createStore(workspace = '.') { 
  const dir = path.join(workspace, '.tt-state'); 
  const file = path.join(dir, 'state.json'); 
  return { 
    async save(plan) { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(file, JSON.stringify(plan, null, 2)); return plan; }, 
    async load() { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }, 
    async clear() { try { await fs.unlink(file); } catch (error) { if (error.code !== 'ENOENT') throw error; } }, 
  }; 
} 
export default createStore;
