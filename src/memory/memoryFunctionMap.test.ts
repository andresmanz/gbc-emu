import { it, describe, expect, vi } from 'vitest';
import { MemoryFunctionMap } from './memoryFunctionMap';

it('should throw an error if mappings overlap', () => {
    const memoryMap = new MemoryFunctionMap();

    const mapping1 = {
        start: 0,
        end: 10,
        read: (address: number) => address,
    };

    const mapping2 = {
        start: 5,
        end: 15,
        read: (address: number) => address,
    };

    memoryMap.map(mapping1);

    expect(() => memoryMap.map(mapping2)).toThrow(
        'Overlapping memory mapping detected',
    );
});

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

    it('should call the correct read function for each mapping', () => {
        const { memoryMap, mapping1, mapping2, mapping3 } =
            setupThreeValidMappings();

        memoryMap.read(5);
        expect(mapping1.read).toHaveBeenCalledWith(5);

        memoryMap.read(15);
        expect(mapping2.read).toHaveBeenCalledWith(15);

        memoryMap.read(25);
        expect(mapping3.read).toHaveBeenCalledWith(25);
    });

    it('should call the correct write function for each mapping', () => {
        const { memoryMap, mapping1, mapping3 } = setupThreeValidMappings();

        memoryMap.write(5, 42);
        expect(mapping1.write).toHaveBeenCalledWith(5, 42);

        memoryMap.write(25, 42);
        expect(mapping3.write).toHaveBeenCalledWith(25, 42);
    });

    it('should throw an error if an invalid address is read', () => {
        const { memoryMap } = setupThreeValidMappings();

        expect(() => memoryMap.read(35)).toThrow('Invalid address 35');
    });

    it('should throw an error if an invalid address is written to', () => {
        const { memoryMap } = setupThreeValidMappings();

        expect(() => memoryMap.write(35, 42)).toThrow('Invalid address 35');
    });
});
