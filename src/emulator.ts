import { Cpu } from './cpu/cpu';
import { GbMemoryBus } from './memory/gbMemoryBus';
import { MemoryBus } from './memory/memoryBus';
import { Rom } from './memory/rom';
import { Timer } from './timer';

export class Emulator {
    private timer: Timer;
    private memoryBus: MemoryBus;
    private cpu: Cpu;

    constructor() {
        this.timer = new Timer();
        this.memoryBus = new GbMemoryBus(this.timer);
        this.cpu = new Cpu(this.memoryBus, this.timer);
    }

    loadRom(data: Uint8Array): void {
        this.memoryBus.setRom(new Rom(data));
        this.cpu.reset();
    }

    step(): void {
        this.cpu.step();
    }
}
