import { describe, expect, it } from 'vitest';
import { Word16 } from './word16';

describe('when setting a value', () => {
    it('sets the low correctly', () => {
        const word = new Word16(0xaabb);

        expect(word.low).toBe(0xbb);
    });

    it('sets the high correctly', () => {
        const word = new Word16(0xaabb);

        expect(word.high).toBe(0xaa);
    });

    it('wraps values greater than 65535', () => {
        const word = new Word16(0x10000);

        expect(word.value).toBe(0x0);
    });

    it('wraps values less than 0', () => {
        const word = new Word16(-1);

        expect(word.value).toBe(0xffff);
    });
});
