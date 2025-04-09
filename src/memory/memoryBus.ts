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
        return this.functionMap.read(address);
    }

    write(address: number, value: number): void {
        this.functionMap.write(address, value);
    }
}
