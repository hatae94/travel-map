/**
 * 장소 데이터 임베딩 생성 스크립트
 *
 * multilingual-e5-small 모델로 places 테이블의 텍스트를 384차원 벡터로 변환.
 * 배치 단위로 처리하며 진행률을 표시한다.
 *
 * 실행: npx ts-node scripts/generate-embeddings.ts
 */

import { pipeline } from '@xenova/transformers';
import { Pool } from 'pg';
import { buildEmbeddingText } from '../src/places/build-text';

const BATCH_SIZE = 200;
const MODEL_NAME = 'Xenova/multilingual-e5-small';

async function createPool(): Promise<Pool> {
  return new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'travel_map',
    user: process.env.PGUSER || 'travel',
    password: process.env.PGPASSWORD || 'travel',
  });
}

async function main() {
  console.log(`Loading model: ${MODEL_NAME}...`);
  const extractor = await pipeline('feature-extraction', MODEL_NAME);
  console.log('Model loaded.');

  const pool = await createPool();

  // 총 처리 대상 수
  const { rows: countRows } = await pool.query(
    'SELECT count(*) AS cnt FROM places WHERE name_embedding IS NULL',
  );
  const totalCount = Number(countRows[0].cnt);
  console.log(`Total rows to embed: ${totalCount}`);

  if (totalCount === 0) {
    console.log('All rows already have embeddings. Done.');
    await pool.end();
    return;
  }

  let processed = 0;
  const startTime = Date.now();

  while (processed < totalCount) {
    // name_embedding이 NULL인 행을 배치 단위로 가져옴
    const { rows } = await pool.query(
      `SELECT node_id, name, name_ko, category, type,
              addr_province, addr_city, addr_district, addr_suburb
       FROM places
       WHERE name_embedding IS NULL
       ORDER BY node_id
       LIMIT $1`,
      [BATCH_SIZE],
    );

    if (rows.length === 0) break;

    const texts = rows.map(buildEmbeddingText);

    // 배치 임베딩 생성
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    const embeddings: number[][] = output.tolist();

    // 배치 UPDATE
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < rows.length; i++) {
        const vecStr = `[${embeddings[i].join(',')}]`;
        await client.query(
          'UPDATE places SET name_embedding = $1::vector WHERE node_id = $2',
          [vecStr, rows[i].node_id],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    processed += rows.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = (processed / Number(elapsed)).toFixed(0);
    const pct = ((processed / totalCount) * 100).toFixed(1);
    process.stdout.write(`\r[${pct}%] ${processed}/${totalCount} (${rate} rows/s, ${elapsed}s)`);
  }

  console.log('\nEmbedding generation complete.');

  // 검증
  const { rows: verifyRows } = await pool.query(
    'SELECT count(*) AS cnt FROM places WHERE name_embedding IS NOT NULL',
  );
  console.log(`Rows with embeddings: ${verifyRows[0].cnt}`);

  const { rows: dimRows } = await pool.query(
    'SELECT vector_dims(name_embedding) AS dims FROM places WHERE name_embedding IS NOT NULL LIMIT 1',
  );
  console.log(`Embedding dimensions: ${dimRows[0].dims}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
