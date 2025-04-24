import { Cpu } from './cpu/cpu';
import { Interrupt, InterruptController } from './interrupts';
import { GbMemoryBus } from './memory/gbMemoryBus';
import { MemoryBus } from './memory/memoryBus';
import { Rom } from './memory/rom';
import { Timer } from './timer';

export class Emulator {
    public readonly timer: Timer;
    public readonly memoryBus: MemoryBus;
    public readonly interruptController: InterruptController;
    public readonly cpu: Cpu;

    constructor() {
        this.timer = new Timer();
        this.memoryBus = new GbMemoryBus(this.timer);
        this.interruptController = new InterruptController(this.memoryBus);
        this.cpu = new Cpu(this.memoryBus, this.interruptController);

        this.timer.onTimaOverflow = () =>
            this.interruptController.requestInterrupt(Interrupt.Timer);
    }

    loadRom(data: Uint8Array): void {
        this.memoryBus.setRom(new Rom(data));
        this.cpu.reset();
    }

    step(minCyclesToRun: number): void {
        let cyclesExecuted = 0;

        while (cyclesExecuted < minCyclesToRun) {
            const cycles = this.cpu.step();
            this.timer.update(cycles);
            cyclesExecuted += cycles;
        }
    }
}
