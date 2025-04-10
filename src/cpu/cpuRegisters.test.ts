import { describe, expect, it } from 'vitest';
import { CpuRegisters } from './cpuRegisters';

it('correctly sets the zero flag', () => {
    const registers = new CpuRegisters();
    registers.zeroFlag = 1;

    expect(registers.zeroFlag).toBe(1);
});

it('correctly sets the subtract flag', () => {
    const registers = new CpuRegisters();
    registers.subtractFlag = 1;

    expect(registers.subtractFlag).toBe(1);
});

it('correctly sets the half carry flag', () => {
    const registers = new CpuRegisters();
    registers.halfCarryFlag = 1;

    expect(registers.halfCarryFlag).toBe(1);
});

it('correctly sets the carry flag', () => {
    const registers = new CpuRegisters();
    registers.carryFlag = 1;

    expect(registers.carryFlag).toBe(1);
});

it('wraps around the stack pointer correctly when incremented', () => {
    const registers = new CpuRegisters();
    registers.sp = 0xffff;
    registers.incrementSp();
    expect(registers.sp).toBe(0x0000);
});

it('wraps around the stack pointer correctly when decremented', () => {
    const registers = new CpuRegisters();
    registers.sp = 0x0000;
    registers.decrementSp();
    expect(registers.sp).toBe(0xffff);
});

describe('when one flag is set', () => {
    function setupWithOneFlagSet() {
        const registers = new CpuRegisters();
        registers.zeroFlag = 1;
        return registers;
    }

    it('correctly unsets the flag', () => {
        const registers = setupWithOneFlagSet();
        registers.zeroFlag = 0;
        expect(registers.zeroFlag).toBe(0);
    });

    it('has correct flags set when another flag is set', () => {
        const registers = setupWithOneFlagSet();
        registers.subtractFlag = 1;

        expect(registers.zeroFlag).toBe(1);
        expect(registers.subtractFlag).toBe(1);
        expect(registers.halfCarryFlag).toBe(0);
        expect(registers.carryFlag).toBe(0);
    });
});
