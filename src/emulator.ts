import { Cpu } from './cpu/cpu';
import { MemoryBus } from './memory/memoryBus';
import { Rom } from './memory/rom';

export class Emulator {
    private memoryBus: MemoryBus;
    private cpu: Cpu;

    constructor() {
        this.memoryBus = new MemoryBus();
        this.cpu = new Cpu(this.memoryBus);
    }

    loadRom(data: Uint8Array): void {
        this.memoryBus.setRom(new Rom(data));
    }
}
