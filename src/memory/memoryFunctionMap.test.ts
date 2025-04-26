import { it, describe, expect, vi } from 'vitest';
import { MemoryFunctionMap } from './memoryFunctionMap';

describe('when three valid mappings are provided', () => {
    function setupThreeValidMappings() {
        const memoryMap = new MemoryFunctionMap();

        const mapping1 = {
            start: 0,
            end: 10,
            read: vi.fn((address: number) => address),
            write: vi.fn((_address: number, _value: number) => {}),
        };

        const mapping2 = {
            start: 10,
            end: 20,
            read: vi.fn((address: number) => address),
        };

        const mapping3 = {
            start: 20,
            end: 30,
            read: vi.fn((address: number) => address),
            write: vi.fn((_address: number, _value: number) => {}),
        };

        memoryMap.map(mapping1);
        memoryMap.map(mapping2);
        memoryMap.map(mapping3);

        return { memoryMap, mapping1, mapping2, mapping3 };
    }

    it('returns the correct mapping for each address', () => {
        const { memoryMap, mapping1, mapping2, mapping3 } =
            setupThreeValidMappings();

        const address1 = 5;
        const address2 = 15;
        const address3 = 25;

        expect(memoryMap.findMapping(address1)).toEqual(mapping1);
        expect(memoryMap.findMapping(address2)).toEqual(mapping2);
        expect(memoryMap.findMapping(address3)).toEqual(mapping3);
    });

    it('throws an error for an invalid address', () => {
        const { memoryMap } = setupThreeValidMappings();

        expect(() => memoryMap.findMapping(35)).toThrow(/invalid address/i);
    });
});
