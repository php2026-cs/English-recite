import { dictionaryCacheRepository } from '../../repositories/dictionaryCacheRepository';
import { DictionaryApiProvider } from './dictionaryApiProvider';
import { DictionaryServiceCore } from './dictionaryServiceCore';
import { MyMemoryMeaningEnhancer } from './myMemoryMeaningEnhancer';

export const dictionaryService = new DictionaryServiceCore(
  new DictionaryApiProvider(),
  new MyMemoryMeaningEnhancer(),
  dictionaryCacheRepository
);

export type {
  DictionaryLookupOptions,
  DictionaryLookupResponse
} from './dictionaryServiceCore';
export type {
  DictionaryLookupResult,
  DictionaryProvider,
  RawDictionaryMeaning
} from './dictionaryProvider';
