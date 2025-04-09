interface MemoryFunctionMapping {
    start: number;
    end: number;
    read: (address: number) => number;
    write?: (address: number, value: number) => void;
}

export class MemoryFunctionMap {
    private mappings: MemoryFunctionMapping[] = [];

    map(mapping: MemoryFunctionMapping): void {
        if (mapping.start >= mapping.end) {
            throw new Error(
                'Invalid mapping: start address must be less than end address',
            );
        }

        for (const existingMapping of this.mappings) {
            if (
                (mapping.start >= existingMapping.start &&
                    mapping.start < existingMapping.end) ||
                (mapping.end > existingMapping.start &&
                    mapping.end <= existingMapping.end)
            ) {
                throw new Error('Overlapping memory mapping detected');
            }
        }

        this.mappings.push(mapping);
    }

    read(address: number): number {
        const mapping = this.findMapping(address);
        return mapping.read(address);
    }

    write(address: number, value: number): void {
        const mapping = this.findMapping(address);
        mapping.write?.(address, value);
    }

    private findMapping(address: number): MemoryFunctionMapping {
        for (const mapping of this.mappings) {
            if (address >= mapping.start && address < mapping.end) {
                return mapping;
            }
        }

        throw new Error(`Invalid address ${address}`);
    }
}
