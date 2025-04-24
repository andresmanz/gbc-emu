import { Cpu } from './cpu/cpu';
import { InterruptController } from './interrupts';
import { GbMemoryBus } from './memory/gbMemoryBus';
import { MemoryBus } from './memory/memoryBus';
import { Rom } from './memory/rom';
import { Timer } from './timer';

export class Emulator {
    private timer: Timer;
    private memoryBus: MemoryBus;
    private interruptController: InterruptController;
    private cpu: Cpu;

    constructor() {
        this.timer = new Timer();
        this.memoryBus = new GbMemoryBus(this.timer);
        this.interruptController = new InterruptController(this.memoryBus);
        this.cpu = new Cpu(
            this.memoryBus,
            this.timer,
            this.interruptController,
        );
    }

    loadRom(data: Uint8Array): void {
        this.memoryBus.setRom(new Rom(data));
        this.cpu.reset();
    }

    step(): void {
        this.cpu.step();
    }
}
