# Database Schema

**Database**: `travel_map`
**총 행 수**: 218,768개
**데이터 출처**: OpenStreetMap (GeoFabrik 한국 데이터, `south-korea-latest.osm.pbf`)
**적재 도구**: osm2pgsql (flex output, `poi.lua` 스타일)

---

## 테이블: `places`

한국 내 장소(POI) 정보를 담는 핵심 테이블.
이름·주소·위치·전화번호가 있는 OSM 노드(Node)만 필터링하여 적재.

### 컬럼 정의

| 컬럼명 | 타입 | Nullable | 설명 |
|--------|------|----------|------|
| `node_id` | `bigint` | NOT NULL | osm2pgsql 내부 시퀀스 ID |
| `osm_id` | `bigint` | NOT NULL | OpenStreetMap 원본 노드 ID |
| `name` | `text` | NULL | 장소명 (OSM 기본 `name` 태그, 주로 한국어) |
| `name_ko` | `text` | NULL | 한국어 장소명 (`name:ko` 태그) |
| `name_en` | `text` | NULL | 영어 장소명 (`name:en` 태그) |
| `category` | `text` | NULL | 장소 분류 대분류 (아래 값 참고) |
| `type` | `text` | NULL | 장소 분류 소분류 (예: `restaurant`, `cafe`, `hotel`) |
| `phone` | `text` | NULL | 전화번호 (`phone` 또는 `contact:phone` 태그) |
| `addr_full` | `text` | NULL | 전체 주소 문자열 (`addr:full` 태그) |
| `addr_province` | `text` | NULL | 시/도 (예: `경기도`, `서울특별시`) |
| `addr_city` | `text` | NULL | 시/군 (예: `수원시`, `고양시`) |
| `addr_district` | `text` | NULL | 구/읍/면 (예: `영통구`, `일산동구`) |
| `addr_suburb` | `text` | NULL | 동/리 (예: `망포동`, `마두동`) |
| `addr_street` | `text` | NULL | 도로명 (`addr:street` 태그) |
| `addr_housenumber` | `text` | NULL | 건물번호 (`addr:housenumber` 태그) |
| `geom` | `geometry(Point, 4326)` | NOT NULL | 위치 좌표 (WGS84, EPSG:4326) |
| `name_embedding` | `vector(384)` | NULL | 시맨틱 검색용 임베딩 벡터 (multilingual-e5-small) |

### category 값 분포

| category | 행 수 | 설명 |
|----------|-------|------|
| `amenity` | 125,081 | 편의시설 (식당, 카페, 병원, 학교 등) |
| `shop` | 37,945 | 상점 (편의점, 마트, 약국 등) |
| `place` | 22,105 | 지명 (동네, 마을, 섬 등) |
| `tourism` | 15,325 | 관광지 (호텔, 명소, 박물관 등) |
| `office` | 5,492 | 사무소 (정부기관, 기업 등) |
| `(null)` | 5,418 | 분류 없음 (주소/전화만 존재) |
| `leisure` | 3,816 | 여가시설 (공원, 체육관 등) |
| `historic` | 2,189 | 문화재/역사 장소 |
| `healthcare` | 1,279 | 의료시설 |
| `sport` | 118 | 스포츠 시설 |

### 컬럼 데이터 충전율

| 컬럼 | 값 있는 행 | 충전율 |
|------|-----------|--------|
| `name` | 218,768 | 100% |
| `name_ko` | 107,783 | 49% |
| `name_en` | 94,122 | 43% |
| `addr_province` | 19,475 | 9% |
| `addr_city` | 42,283 | 19% |
| `addr_street` | 52,776 | 24% |
| `addr_full` | 522 | 0.2% |
| `phone` | 19,927 | 9% |
| `geom` | 218,768 | 100% |

### 인덱스

| 인덱스명 | 대상 컬럼 | 종류 | 설명 |
|---------|-----------|------|------|
| `places_geom_idx` | `geom` | GiST | 공간 쿼리 최적화 (반경 검색, bbox 필터 등) |
| `idx_places_name_embedding` | `name_embedding` | HNSW (vector_cosine_ops) | 벡터 유사도 검색 최적화 |

### 벡터 검색 사용 예시

```sql
-- 시맨틱 검색 (벡터 유사도)
SELECT name, category, type,
       (1 - (name_embedding <=> $1::vector))::float AS score
FROM places
WHERE name_embedding IS NOT NULL
  AND (1 - (name_embedding <=> $1::vector)) > 0.3
ORDER BY name_embedding <=> $1::vector
LIMIT 10;
```

- **임베딩 모델**: `Xenova/multilingual-e5-small` (384차원)
- **입력 포맷**: `passage: {name} {name_ko} {category} {type} {addr_city}`
- **쿼리 포맷**: `query: {검색어}`
- **유사도 threshold**: 0.3 (미달 시 결과 제외)
- **생성 스크립트**: `scripts/generate-embeddings.ts`

### 좌표 사용 예시

```sql
-- 위도/경도로 조회
SELECT name, ST_Y(geom) AS latitude, ST_X(geom) AS longitude
FROM places
WHERE name ILIKE '%강남%'
LIMIT 10;

-- 특정 지점 반경 1km 내 장소 검색
SELECT name, category, type,
       ST_Distance(geom::geography, ST_MakePoint(127.0276, 37.4979)::geography) AS distance_m
FROM places
WHERE ST_DWithin(geom::geography, ST_MakePoint(127.0276, 37.4979)::geography, 1000)
ORDER BY distance_m
LIMIT 20;
```

---

## 테이블: `users`

유저 프로필 정보. 인증 방식과 무관하게 공통 프로필만 보유.

### 컬럼 정의

| 컬럼명 | 타입 | Nullable | 설명 |
|--------|------|----------|------|
| `id` | `uuid` | NOT NULL | PK, `gen_random_uuid()` |
| `nickname` | `varchar(50)` | NULL | 표시 이름 |
| `email` | `varchar(255)` | NULL | 이메일 (UNIQUE) |
| `phone` | `varchar(20)` | NULL | 전화번호 (UNIQUE) |
| `avatar_url` | `text` | NULL | 프로필 이미지 URL |
| `created_at` | `timestamptz` | NOT NULL | 생성일 |
| `updated_at` | `timestamptz` | NOT NULL | 수정일 |

### 인덱스

| 인덱스명 | 대상 컬럼 | 종류 | 설명 |
|---------|-----------|------|------|
| `users_pkey` | `id` | btree (PK) | 기본키 |
| `users_email_key` | `email` | btree (UNIQUE) | 이메일 중복 방지 |
| `users_phone_key` | `phone` | btree (UNIQUE) | 전화번호 중복 방지 |

---

## 테이블: `user_auth_providers`

유저별 인증 수단 연결. 한 유저가 여러 provider를 가질 수 있음 (1:N).

### 컬럼 정의

| 컬럼명 | 타입 | Nullable | 설명 |
|--------|------|----------|------|
| `id` | `uuid` | NOT NULL | PK, `gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL | FK → `users(id)`, CASCADE DELETE |
| `provider` | `varchar(20)` | NOT NULL | 인증 제공자 (아래 값 참고) |
| `provider_uid` | `varchar(255)` | NOT NULL | 제공자별 고유 식별자 |
| `created_at` | `timestamptz` | NOT NULL | 연결일 |

### provider 값

| provider | provider_uid 예시 | 설명 |
|----------|-------------------|------|
| `email` | `user@example.com` | 이메일 로그인 |
| `phone` | `+821012345678` | 전화번호 로그인 |
| `google` | `google-sub-claim` | Google OAuth |
| `kakao` | `kakao-user-id` | 카카오 OAuth |
| `naver` | `naver-user-id` | 네이버 OAuth |
| `apple` | `apple-sub-claim` | Apple OAuth |

### 인덱스

| 인덱스명 | 대상 컬럼 | 종류 | 설명 |
|---------|-----------|------|------|
| `user_auth_providers_pkey` | `id` | btree (PK) | 기본키 |
| `user_auth_providers_provider_provider_uid_key` | `(provider, provider_uid)` | btree (UNIQUE) | 동일 제공자 내 uid 중복 방지 |
| `idx_user_auth_providers_user_id` | `user_id` | btree | 유저별 조회 최적화 |

### Mock seed data

| nickname | email | provider | provider_uid |
|----------|-------|----------|--------------|
| 테스트유저1 | mock1@test.com | email | mock1@test.com |
| 테스트유저2 | mock2@test.com | email | mock2@test.com |
| 테스트유저3 | mock3@test.com | email | mock3@test.com |

### 인증 흐름 (Mock → Production)

```
[현재: Mock]
POST /auth/mock-login { email }
  → user_auth_providers에서 provider='email' 조회
  → JWT 발급 { sub: user_id, email, nickname }

[추후: OAuth]
POST /auth/google  → Google OAuth callback → user_auth_providers에 provider='google' upsert → JWT 발급
POST /auth/kakao   → 카카오 OAuth callback → provider='kakao' upsert → JWT 발급
(Guard 로직 변경 없음, 엔드포인트만 추가)
```

---

## 시스템 테이블: `spatial_ref_sys`

PostGIS 익스텐션이 자동 생성하는 좌표계(SRS) 참조 테이블. 직접 수정 불필요.
