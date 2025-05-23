interface MemoryFunctionMapping {
    start: number;
    end: number;
    read: (address: number) => number;
    write?: (address: number, value: number) => void;
}

interface SingleAddressFunctionMapping {
    address: number;
    read: () => number;
    write?: (value: number) => void;
}

export class MemoryFunctionMap {
    private mappings: MemoryFunctionMapping[] = [];

    map(mapping: MemoryFunctionMapping) {
        if (mapping.start > mapping.end) {
            throw new Error(
                'Invalid mapping: start address must be less than end address',
            );
        }

        this.mappings.push(mapping);
    }

    mapSingleAddress(mapping: SingleAddressFunctionMapping) {
        this.map({
            start: mapping.address,
            end: mapping.address,
            read: mapping.read,
            write: (_address, value) => mapping.write?.(value),
        });
    }

    public findMapping(address: number): MemoryFunctionMapping {
        for (const mapping of this.mappings) {
            if (address >= mapping.start && address <= mapping.end) {
                return mapping;
            }
        }

        throw new Error(`Invalid address 0x${address.toString(16)}`);
    }
}
