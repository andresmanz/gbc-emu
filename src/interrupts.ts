import { IE_REGISTER_ADDRESS, IF_REGISTER_ADDRESS } from './memory/gbMemoryBus';
import { MemoryBus } from './memory/memoryBus';

export enum Interrupt {
    VBlank = 0,
    LCDStat = 1,
    Timer = 2,
    Serial = 3,
    Joypad = 4,
}

export const interrupts = [
    Interrupt.VBlank,
    Interrupt.LCDStat,
    Interrupt.Timer,
    Interrupt.Serial,
    Interrupt.Joypad,
];

export const interruptVectors: Record<Interrupt, number> = {
    [Interrupt.VBlank]: 0x40,
    [Interrupt.LCDStat]: 0x48,
    [Interrupt.Timer]: 0x50,
    [Interrupt.Serial]: 0x58,
    [Interrupt.Joypad]: 0x60,
};

export class InterruptController {
    constructor(private memoryBus: MemoryBus) {}

    requestInterrupt(interrupt: Interrupt) {
        const ieValue = this.memoryBus.read(IE_REGISTER_ADDRESS);
        const ifValue = this.memoryBus.read(IF_REGISTER_ADDRESS);

        this.memoryBus.write(IE_REGISTER_ADDRESS, ieValue | (1 << interrupt));
        this.memoryBus.write(IF_REGISTER_ADDRESS, ifValue | (1 << interrupt));
    }

    clearInterrupt(interrupt: Interrupt) {
        const value = this.memoryBus.read(IF_REGISTER_ADDRESS);
        this.memoryBus.write(IF_REGISTER_ADDRESS, value & ~(1 << interrupt));
    }

    getNextInterrupt() {
        const ieValue = this.memoryBus.read(IE_REGISTER_ADDRESS);
        const ifValue = this.memoryBus.read(IF_REGISTER_ADDRESS);

        const pending = ieValue & ifValue;

        if (pending === 0) {
            return null;
        }

        // find the highest priority interrupt (lowest bit) and service it
        for (const interrupt of interrupts) {
            if ((pending & (1 << interrupt)) !== 0) {
                return interrupt;
            }
        }

        return null;
    }

    hasPendingInterrupts() {
        const ieValue = this.memoryBus.read(IE_REGISTER_ADDRESS);
        const ifValue = this.memoryBus.read(IF_REGISTER_ADDRESS);
        return (ieValue & ifValue) !== 0;
    }
}
