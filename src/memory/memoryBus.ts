import { MemoryFunctionMap } from './memoryFunctionMap';
import { Rom } from './rom';

const MemoryLayout = {
    romStart: 0x0000,
    romEnd: 0x7fff,
};

export class MemoryBus {
    public rom: Rom | null = null;
    private functionMap: MemoryFunctionMap;

    constructor() {
        this.functionMap = new MemoryFunctionMap();

        // Initialize the memory bus with default mappings
        this.functionMap.map({
            start: MemoryLayout.romStart,
            end: MemoryLayout.romEnd,
            read: (address: number) => {
                if (!this.rom) {
                    throw new Error(`ROM not initialized`);
                }

                return this.rom.read(address);
            },
        });
    }

    read(address: number): number {
        const mapping = this.functionMap.findMapping(address);
        // read with local address
        return mapping.read(address - mapping.start);
    }

    write(address: number, value: number): void {
        const mapping = this.functionMap.findMapping(address);

        if (mapping.write) {
            // write with local address
            mapping.write(address - mapping.start, value);
        } else {
            throw new Error(
                `Write operation not supported at address ${address}`,
            );
        }
    }
}
