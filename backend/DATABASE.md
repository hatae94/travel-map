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

## 시스템 테이블: `spatial_ref_sys`

PostGIS 익스텐션이 자동 생성하는 좌표계(SRS) 참조 테이블. 직접 수정 불필요.
