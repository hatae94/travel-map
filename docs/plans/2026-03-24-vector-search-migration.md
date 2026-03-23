# 벡터 검색 마이그레이션 플랜

**작성일**: 2026-03-24
**상태**: Draft
**목표**: places 검색을 ILIKE 패턴 매칭에서 벡터 기반 시맨틱 검색으로 전환

---

## 1. 현황 분석

### 현재 검색 방식

```sql
WHERE name ILIKE '%강남%'
   OR name_ko ILIKE '%강남%'
   OR addr_full ILIKE '%강남%'
   OR addr_city ILIKE '%강남%'
```

- **방식**: ILIKE + 와일드카드 (Parallel Seq Scan)
- **성능**: ~20ms (218,768행 full scan)
- **한계**:
  - 정확한 문자열 매칭만 가능 ("커피숍" → "카페" 검색 불가)
  - 오타 허용 불가 ("강남역" → "강남엮" 매칭 안됨)
  - 유사어/동의어 검색 불가 ("맛집" → restaurant 매칭 안됨)
  - 데이터 증가 시 선형 성능 저하

### DB 환경

| 항목 | 값 |
|------|-----|
| PostgreSQL | 16.11 (aarch64, Docker) |
| PostGIS | 3.6.2 |
| pg_trgm | 사용 가능 (한국어 trigram 생성 확인) |
| pgvector | **미설치** (Dockerfile 수정 필요) |
| 총 장소 수 | 218,768 |
| 평균 name 길이 | 6.2자 |
| name_ko 충전율 | 49% (107,783행) |

---

## 2. 접근 방식 비교

### Option A: pg_trgm (trigram 유사도)

```sql
-- GIN 인덱스 생성
CREATE INDEX idx_places_name_trgm ON places USING gin (name gin_trgm_ops);

-- 유사도 검색
SELECT *, similarity(name, '강남역') AS score
FROM places
WHERE name % '강남역'
ORDER BY score DESC LIMIT 10;
```

| 장점 | 단점 |
|------|------|
| 이미 설치 가능 | 시맨틱 이해 없음 |
| 인프라 변경 최소 | 오타 보정 수준만 가능 |
| 빠른 구현 (~1일) | "커피숍"→"카페" 불가 |
| GIN 인덱스로 성능 향상 | 한국어 trigram 품질 제한적 |

### Option B: pgvector + 임베딩 (추천)

```sql
-- 벡터 컬럼 추가
ALTER TABLE places ADD COLUMN name_embedding vector(384);

-- HNSW 인덱스 생성
CREATE INDEX idx_places_embedding ON places
  USING hnsw (name_embedding vector_cosine_ops);

-- 시맨틱 검색
SELECT *, 1 - (name_embedding <=> $1::vector) AS score
FROM places
ORDER BY name_embedding <=> $1::vector
LIMIT 10;
```

| 장점 | 단점 |
|------|------|
| 시맨틱 검색 가능 | 임베딩 모델 필요 |
| 오타/유사어/동의어 처리 | 초기 임베딩 생성 시간 |
| "맛집"→restaurant 매칭 | pgvector 설치 필요 |
| 다국어(한/영) 통합 검색 | 임베딩 API 비용 (1회성) |

### Option C: 하이브리드 (pg_trgm + pgvector)

- 1단계: pg_trgm으로 빠르게 개선 (오타 보정)
- 2단계: pgvector 추가하여 시맨틱 검색
- 최종: 두 점수를 가중 합산하여 랭킹

**선택: Option B (pgvector + 임베딩)** — 목표가 "벡터 기반 검색"이므로 직접 구현

---

## 3. 임베딩 모델 선택

| 모델 | 차원 | 한국어 | 크기 | 비고 |
|------|------|--------|------|------|
| `multilingual-e5-small` | 384 | 좋음 | 118MB | 로컬 실행 가능, 경량 |
| `multilingual-e5-base` | 768 | 우수 | 278MB | 균형잡힌 성능 |
| OpenAI `text-embedding-3-small` | 1536 | 우수 | API | 고품질, 유료 |
| `paraphrase-multilingual-MiniLM-L12-v2` | 384 | 좋음 | 118MB | sentence-transformers 인기 모델 |

**추천: `multilingual-e5-small` (384차원)**
- 한국어 성능 검증됨
- 로컬 실행 가능 (API 비용 없음)
- 218K 행 × 384차원 = ~320MB 스토리지 (허용 범위)

---

## 4. 구현 플랜 (TDD)

### Phase 1: 인프라 준비

#### Step 1.1: pgvector 설치 (Dockerfile 수정)

```dockerfile
# docker/db.Dockerfile
FROM postgres:16.11-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       postgresql-16-postgis-3 \
       postgresql-16-postgis-3-scripts \
       postgresql-16-pgvector \        # 추가
    && rm -rf /var/lib/apt/lists/*
```

**검증**: `SELECT * FROM pg_available_extensions WHERE name = 'vector';`

#### Step 1.2: 벡터 컬럼 추가

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE places ADD COLUMN name_embedding vector(384);

CREATE INDEX idx_places_name_embedding
  ON places USING hnsw (name_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### Phase 2: 임베딩 생성 파이프라인

#### Step 2.1: 임베딩 스크립트 작성

```
backend/scripts/generate-embeddings.ts
```

- `multilingual-e5-small` 모델 로드 (onnxruntime-node 또는 Python subprocess)
- places 테이블에서 name + name_ko + category + addr_city 결합
- 배치 처리 (500건씩)
- 결과를 name_embedding 컬럼에 UPDATE

**입력 텍스트 포맷**:
```
query: {name} {name_ko} {category} {type} {addr_city}
```

**예상 소요**: 218K × ~2ms/row ≈ 7분 (CPU), ~1분 (GPU)

#### Step 2.2: 임베딩 검증

```sql
-- NULL이 아닌 임베딩 수 확인
SELECT count(*) FROM places WHERE name_embedding IS NOT NULL;

-- 차원 확인
SELECT vector_dims(name_embedding) FROM places WHERE name_embedding IS NOT NULL LIMIT 1;
```

### Phase 3: 검색 API 전환 (TDD)

#### Step 3.1: RED — 시맨틱 검색 테스트 작성

```typescript
// test/places.e2e-spec.ts 에 추가

it('should find semantically similar places', async () => {
  // "커피숍"으로 검색하면 "카페"가 결과에 포함되어야 함
  const res = await request(app.getHttpServer())
    .get('/places/search')
    .query({ q: '커피숍' })
    .expect(200);

  const names = res.body.map(p => p.name.toLowerCase());
  const hasRelated = res.body.some(p =>
    p.type === 'cafe' || p.name.includes('카페') || p.name.includes('커피')
  );
  expect(hasRelated).toBe(true);
});

it('should return places with relevance score', async () => {
  const res = await request(app.getHttpServer())
    .get('/places/search')
    .query({ q: '강남역' })
    .expect(200);

  expect(res.body[0]).toHaveProperty('score');
  expect(typeof res.body[0].score).toBe('number');
  expect(res.body[0].score).toBeGreaterThan(0);
  expect(res.body[0].score).toBeLessThanOrEqual(1);
});

it('should return results ordered by relevance score descending', async () => {
  const res = await request(app.getHttpServer())
    .get('/places/search')
    .query({ q: '서울 맛집' })
    .expect(200);

  if (res.body.length > 1) {
    for (let i = 0; i < res.body.length - 1; i++) {
      expect(res.body[i].score).toBeGreaterThanOrEqual(res.body[i + 1].score);
    }
  }
});
```

#### Step 3.2: GREEN — 검색 서비스 구현

```typescript
// places.service.ts
async search(q: string) {
  // 1. 쿼리 텍스트를 임베딩으로 변환
  const queryEmbedding = await this.getEmbedding(q);

  // 2. 벡터 유사도 검색
  const { rows } = await this.pool.query(
    `SELECT
       osm_id, name, name_ko, name_en, category, type,
       phone, addr_full, addr_province, addr_city,
       addr_district, addr_suburb, addr_street, addr_housenumber,
       ST_X(geom) AS longitude, ST_Y(geom) AS latitude,
       1 - (name_embedding <=> $1::vector) AS score
     FROM places
     WHERE name_embedding IS NOT NULL
     ORDER BY name_embedding <=> $1::vector
     LIMIT 10`,
    [`[${queryEmbedding.join(',')}]`],
  );
  return rows;
}
```

#### Step 3.3: REFACTOR

- 임베딩 캐싱 (자주 검색되는 쿼리)
- fallback: 임베딩 없는 행은 ILIKE로 보충
- 쿼리 임베딩 서비스 분리

### Phase 4: 기존 테스트 호환성

기존 19개 E2E 테스트가 모두 통과해야 함. 변경되는 부분:

| 기존 테스트 | 영향 | 대응 |
|-----------|------|------|
| 정상 검색 → 배열 반환 | 호환 | 응답 형태 동일 |
| 스키마 검증 | **변경** | `score` 필드 추가 |
| 최대 10건 | 호환 | LIMIT 동일 |
| 빈 배열 (no match) | **변경** | 벡터 검색은 항상 결과 반환 → threshold 필요 |
| 빈 검색어 → 400 | 호환 | 검증 로직 동일 |
| 좌표 범위 | 호환 | geom 동일 |

**주의**: 벡터 검색은 "매칭 없음"이 없음. 최소 유사도 threshold (예: 0.3) 필터 필요.

---

## 5. 필요 패키지

| 패키지 | 용도 | 설치 위치 |
|--------|------|----------|
| `pgvector` | PostgreSQL 벡터 익스텐션 | Docker DB |
| `onnxruntime-node` | 임베딩 모델 로컬 추론 | backend |
| `@xenova/transformers` | JS에서 임베딩 모델 로드 | backend |

---

## 6. 마이그레이션 순서 (안전한 전환)

```
1. pgvector 설치 + 벡터 컬럼 추가     (DB만 변경, API 무영향)
2. 임베딩 생성 스크립트 실행            (백그라운드, API 무영향)
3. RED: 새 테스트 작성 → 실패 확인
4. GREEN: 검색 로직 전환 → 테스트 통과
5. REFACTOR: 성능 최적화, ILIKE fallback 제거
6. 기존 19개 테스트 전체 통과 확인
```

**롤백 전략**: `name_embedding` 컬럼 삭제 + 검색 쿼리를 ILIKE로 복원 (기존 코드 git revert)

---

## 7. 예상 일정

| Phase | 작업 | 예상 |
|-------|------|------|
| Phase 1 | 인프라 (pgvector + 스키마) | 0.5일 |
| Phase 2 | 임베딩 파이프라인 | 1일 |
| Phase 3 | 검색 API 전환 (TDD) | 1일 |
| Phase 4 | 테스트 호환성 + 정리 | 0.5일 |
| **합계** | | **3일** |

---

## 8. 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 한국어 임베딩 품질 | 검색 정확도 저하 | multilingual-e5 한국어 벤치마크 사전 확인 |
| 임베딩 생성 시간 | 마이그레이션 지연 | 배치 처리 + 진행률 표시 |
| 런타임 임베딩 지연 | 검색 응답 느려짐 | onnxruntime 웜업, 모델 캐싱 |
| pgvector 미지원 패키지 | Docker 빌드 실패 | apt 패키지 사전 확인 완료 필요 |
| 벡터 검색 "항상 결과 반환" | UX 혼란 | score threshold 적용 |
