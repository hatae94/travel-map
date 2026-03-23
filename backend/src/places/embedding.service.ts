import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

const MODEL_NAME = 'Xenova/multilingual-e5-small';
const EMBEDDING_DIM = 384;

interface Extractor {
  (text: string | string[], options: { pooling: string; normalize: boolean }): Promise<{
    tolist(): number[][];
  }>;
}

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private extractor: Extractor | null = null;

  async onModuleInit() {
    try {
      const { pipeline } = await import('@xenova/transformers');
      this.extractor = (await pipeline('feature-extraction', MODEL_NAME)) as unknown as Extractor;
      this.logger.log(`Embedding model loaded: ${MODEL_NAME} (${EMBEDDING_DIM}d)`);
    } catch (err) {
      this.logger.error('Failed to load embedding model', (err as Error).message);
    }
  }

  /** 쿼리 텍스트를 384차원 벡터로 변환 (e5 모델은 "query: " prefix 권장) */
  async embed(text: string): Promise<number[]> {
    if (!this.extractor) {
      throw new Error('Embedding model not loaded');
    }
    const input = `query: ${text}`;
    const output = await this.extractor(input, { pooling: 'mean', normalize: true });
    return output.tolist()[0];
  }

  getDimension(): number {
    return EMBEDDING_DIM;
  }
}
