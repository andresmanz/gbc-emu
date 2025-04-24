import { describe, expect, it } from 'vitest';
import { Emulator } from './emulator';
import { Rom } from './memory/rom';
import {
    DIV_ADDRESS,
    TAC_ADDRESS,
    TIMA_ADDRESS,
    TMA_ADDRESS,
} from './memory/gbMemoryBus';
import { Interrupt, interruptVectors } from './interrupts';

function setupBasic() {
    const emulator = new Emulator();

    const romData = new Uint8Array(0x8000);
    romData.fill(0x00); // 0x00 = NOP
    emulator.memoryBus.setRom(new Rom(romData));

    return emulator;
}

describe('when timer is enabled and frequency set', () => {
    function setupEmulatorWithTimerInterrupt() {
        const emulator = setupBasic();

        // set up TIMA to overflow after a small number of cycles
        emulator.memoryBus.write(TAC_ADDRESS, 0b100); // TAC: enable timer, freq 4096 Hz (1024 cycles)
        emulator.memoryBus.write(TMA_ADDRESS, 0x01); // TMA: reload value
        emulator.memoryBus.write(TIMA_ADDRESS, 0xff); // TIMA: just about to overflow

        emulator.cpu.areInterruptsEnabled = true;

        return emulator;
    }

    it('requests a timer interrupt when TIMA overflows', () => {
        const emulator = setupEmulatorWithTimerInterrupt();

        emulator.step(1024); // enough to cause timer to overflow and trigger interrupt
        emulator.step(4); // next step should service interrupt

        // check that interrupt handler ran
        expect(emulator.cpu.registers.pc).toBe(
            interruptVectors[Interrupt.Timer],
        );
    });
});

it('increments DIV after 256 cycles', () => {
    const emulator = setupBasic();

    // each instruction takes at least 4 cycles, so step 252 cycles as a multiple of 4.
    // with 253 it would already take 256 cycles and thus increment DIV.
    emulator.step(252);

    // should still be 0
    expect(emulator.memoryBus.read(DIV_ADDRESS)).toBe(0);

    // now it should increment
    emulator.step(4);

    expect(emulator.memoryBus.read(DIV_ADDRESS)).toBe(1);
});
