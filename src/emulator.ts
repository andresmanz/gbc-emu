import { Cpu } from './cpu/cpu';
import { GbMemoryBus } from './memory/gbMemoryBus';
import { MemoryBus } from './memory/memoryBus';
import { Rom } from './memory/rom';

export class Emulator {
    private memoryBus: MemoryBus;
    private cpu: Cpu;

    constructor() {
        this.memoryBus = new GbMemoryBus();
        this.cpu = new Cpu(this.memoryBus);
    }

    loadRom(data: Uint8Array): void {
        this.memoryBus.setRom(new Rom(data));
        this.cpu.reset();
    }

    step(): void {
        this.cpu.step();
    }
}
