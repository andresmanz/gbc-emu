import { describe, expect, it } from 'vitest';
import { Cpu } from './cpu';
import { MemoryBus } from '../memory/memoryBus';
import { Rom } from '../memory/rom';

class MockMemoryBus implements MemoryBus {
    private memory: Uint8Array;

    constructor(size: number) {
        this.memory = new Uint8Array(size);
    }

    setRom(_rom: Rom): void {}

    read(address: number): number {
        return this.memory[address];
    }

    write(address: number, value: number): void {
        this.memory[address] = value;
    }
}

describe('initially', () => {
    it('sets PC to 0x0100', () => {
        const cpu = new Cpu(new MockMemoryBus(16));
        expect(cpu.registers.pc).toBe(0x0100);
    });

    it('sets SP to 0xfffe', () => {
        const cpu = new Cpu(new MockMemoryBus(16));
        expect(cpu.registers.sp).toBe(0xfffe);
    });
});
