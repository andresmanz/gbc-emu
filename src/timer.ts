import { Word16 } from './cpu/word16';

export type TimerFrequency = 0b00 | 0b01 | 0b10 | 0b11;

export const timerCycleThresholds: Record<TimerFrequency, number> = {
    0b00: 1024,
    0b01: 16,
    0b10: 64,
    0b11: 256,
} as const;

const watchedDivBits: Record<TimerFrequency, number> = {
    0b00: 9, // 4096 Hz -> bit 9
    0b01: 3, // 262144 Hz -> bit 3
    0b10: 5, // 65536 Hz -> bit 5
    0b11: 7, // 16384 Hz -> bit 7
} as const;

export class Timer {
    private divCounter = new Word16();
    private previousDivCounter = new Word16();

    // divider register
    div = 0;
    // timer counter
    tima = 0;
    // timer modulo
    tma = 0;
    // timer control
    tac = 0;

    constructor(public onTimaOverflow?: () => void) {}

    update(cycles: number) {
        this.updateDiv(cycles);
        this.updateTima();
    }

    private updateDiv(cycles: number) {
        this.previousDivCounter.value = this.divCounter.value;
        this.divCounter.value += cycles;
        this.div = this.divCounter.value >> 8;
    }

    private updateTima() {
        if (!this.isTimerEnabled) {
            return;
        }

        const previousBit =
            (this.previousDivCounter.value >> this.counterBitToCheck) & 1;

        const currentBit =
            (this.divCounter.value >> this.counterBitToCheck) & 1;

        // detect falling edge (1 -> 0 transition)
        if (previousBit === 1 && currentBit === 0) {
            this.incrementTima();
        }
    }

    /**
     * Increments TIMA. If it overflows, it gets set to the value of TMA and calls the
     * onTimaOverflow handler.
     */
    private incrementTima() {
        ++this.tima;

        if (this.tima > 0xff) {
            this.tima = this.tma;

            if (this.onTimaOverflow) {
                this.onTimaOverflow();
            }
        }
    }

    private get isTimerEnabled() {
        return (this.tac & 0b100) !== 0;
    }

    private get timerFrequency(): TimerFrequency {
        return (this.tac & 0b11) as TimerFrequency;
    }

    private get counterBitToCheck() {
        return watchedDivBits[this.timerFrequency];
    }

    resetDiv() {
        this.div = 0;
        this.divCounter.value = 0;
    }
}
