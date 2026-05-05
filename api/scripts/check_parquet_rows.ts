import duckdb from 'duckdb';
import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const db = new duckdb.Database(':memory:');

function query(sql: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

async function analyze() {
  const dirPath = resolve('../banco local');
  const files = readdirSync(dirPath).filter(f => f.endsWith('.parquet'));

  console.log('| File Name | Row Count | Size (Bytes) |');
  console.log('| :--- | :--- | :--- |');

  for (const file of files) {
    const filePath = join(dirPath, file).replace(/\\/g, '/');
    const stats = statSync(join(dirPath, file));
    
    try {
      const result = await query(`SELECT COUNT(*) as count FROM read_parquet('${filePath}')`);
      const rowCount = result[0].count;
      console.log(`| ${file} | ${rowCount} | ${stats.size} |`);
    } catch (error) {
      console.log(`| ${file} | ERROR | ${stats.size} |`);
    }
  }
}

analyze().catch(console.error);
