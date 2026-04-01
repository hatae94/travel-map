export interface PlaceTextFields {
  name: string;
  name_ko: string | null;
  category: string | null;
  type: string | null;
  addr_province: string | null;
  addr_city: string | null;
  addr_district: string | null;
  addr_suburb: string | null;
}

/**
 * 임베딩 생성용 텍스트 조합.
 * e5 모델의 "passage: " prefix 포함.
 * 주소 계층(province → city → district → suburb)을 포함하여
 * 지역 기반 의미 검색 정확도를 높인다.
 */
export function buildEmbeddingText(row: PlaceTextFields): string {
  const parts = [row.name];
  if (row.name_ko && row.name_ko !== row.name) parts.push(row.name_ko);
  if (row.category) parts.push(row.category);
  if (row.type) parts.push(row.type);
  if (row.addr_province) parts.push(row.addr_province);
  if (row.addr_city) parts.push(row.addr_city);
  if (row.addr_district) parts.push(row.addr_district);
  if (row.addr_suburb) parts.push(row.addr_suburb);
  return `passage: ${parts.join(' ')}`;
}
