import { buildEmbeddingText } from './build-text';

describe('buildEmbeddingText', () => {
  it('includes all address hierarchy fields when available', () => {
    const text = buildEmbeddingText({
      name: 'Starbucks',
      name_ko: '스타벅스',
      category: 'amenity',
      type: 'cafe',
      addr_province: '서울특별시',
      addr_city: '강남구',
      addr_district: '역삼동',
      addr_suburb: '역삼1동',
    });

    expect(text).toBe(
      'passage: Starbucks 스타벅스 amenity cafe 서울특별시 강남구 역삼동 역삼1동',
    );
  });

  it('omits null fields gracefully', () => {
    const text = buildEmbeddingText({
      name: 'Cafe',
      name_ko: null,
      category: 'amenity',
      type: 'cafe',
      addr_province: '서울특별시',
      addr_city: null,
      addr_district: null,
      addr_suburb: null,
    });

    expect(text).toBe('passage: Cafe amenity cafe 서울특별시');
  });

  it('skips name_ko when identical to name', () => {
    const text = buildEmbeddingText({
      name: 'Seoul Tower',
      name_ko: 'Seoul Tower',
      category: 'tourism',
      type: 'attraction',
      addr_province: null,
      addr_city: '서울',
      addr_district: null,
      addr_suburb: null,
    });

    expect(text).toBe('passage: Seoul Tower tourism attraction 서울');
  });

  it('handles minimal data (name only)', () => {
    const text = buildEmbeddingText({
      name: 'Unknown Place',
      name_ko: null,
      category: null,
      type: null,
      addr_province: null,
      addr_city: null,
      addr_district: null,
      addr_suburb: null,
    });

    expect(text).toBe('passage: Unknown Place');
  });
});
