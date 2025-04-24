import { DIV_ADDRESS } from '../memory/gbMemoryBus';
import { MemoryBus } from '../memory/memoryBus';
import { Rom } from '../memory/rom';
import { Timer } from '../timer';

export class MockMemoryBus implements MemoryBus {
    private memory: Uint8Array;

    constructor(
        size: number,
        private timer: Timer,
    ) {
        this.memory = new Uint8Array(size);
    }

    setRom(_rom: Rom): void {}

    setRomData(data: Uint8Array): void {
        this.memory.set(data, 0x0100);
    }

    read(address: number): number {
        if (address === DIV_ADDRESS) {
            return this.timer.div;
        }

        return this.memory[address];
    }

    write(address: number, value: number): void {
        this.memory[address] = value;
    }
}
