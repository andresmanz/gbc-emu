import { describe, expect, it } from 'vitest';
import { Cpu, R8Register, r8Registers } from './cpu';
import { MemoryBus } from '../memory/memoryBus';
import { Rom } from '../memory/rom';

class MockMemoryBus implements MemoryBus {
    private memory: Uint8Array;

    constructor(size: number) {
        this.memory = new Uint8Array(size);
    }

    setRom(_rom: Rom): void {}

    setRomData(data: Uint8Array): void {
        this.memory.set(data, 0x0100);
    }

    read(address: number): number {
        return this.memory[address];
    }

    write(address: number, value: number): void {
        this.memory[address] = value;
    }
}

interface Flags {
    z?: number;
    n?: number;
    h?: number;
    c?: number;
}

interface ArithmeticOpTestCase {
    opcode: number;
    aValue: number;
    r8Register: R8Register;
    r8Value: number;
    expected: number;
    flags?: Flags;
    description?: string;
}

function testArithmeticOp({
    opcode,
    aValue,
    r8Register,
    r8Value,
    expected,
    flags = {},
    description,
}: ArithmeticOpTestCase) {
    const label =
        description ??
        `A=0x${aValue.toString(16)}, r8=0x${r8Value.toString(16)}`;

    it(label, () => {
        const rom = new Uint8Array([opcode]);
        const cpu = setupWithRom(rom);

        cpu.registers.a = aValue;
        cpu.setR8Value(r8Register, r8Value);

        cpu.step();

        expect(cpu.registers.a).toBe(expected);

        if (flags.z !== undefined) {
            expect(cpu.registers.zeroFlag).toBe(flags.z);
        }

        if (flags.n !== undefined) {
            expect(cpu.registers.subtractFlag).toBe(flags.n);
        }

        if (flags.h !== undefined) {
            expect(cpu.registers.halfCarryFlag).toBe(flags.h);
        }

        if (flags.c !== undefined) {
            expect(cpu.registers.carryFlag).toBe(flags.c);
        }
    });
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

/**
 * Creates a CPU instance with a mock memory bus and loads the given ROM data.
 * The ROM data is written to the memory bus starting at address 0x0100, since
 * the CPU starts executing instructions from this address.
 */
function setupWithRom(romData: Uint8Array) {
    const memoryBus = new MockMemoryBus(0x100 + romData.length);
    memoryBus.setRomData(romData);

    const cpu = new Cpu(memoryBus);
    return cpu;
}

it('handles nop opcode', () => {
    const romData = new Uint8Array([0x00]);
    const cpu = setupWithRom(romData);

    cpu.step();

    expect(cpu.registers.pc).toBe(0x0101);
});

const r8RegistersWithoutA = r8Registers.filter(r => r !== 'a');

describe('add a, r8', () => {
    describe.for(r8RegistersWithoutA)('add a, %s', r8 => {
        const opcode = 0x80 + r8Registers.indexOf(r8);

        testArithmeticOp({
            description: 'adds the value of the register to A',
            opcode,
            aValue: 0x01,
            r8Register: r8,
            r8Value: 0x02,
            expected: 0x03,
        });

        testArithmeticOp({
            description: 'adds the value of the register to A with carry',
            opcode,
            aValue: 0xff,
            r8Register: r8,
            r8Value: 0x02,
            expected: 0x01,
            flags: { z: 0, c: 1 },
        });

        testArithmeticOp({
            description: 'handles overflow correctly',
            opcode,
            aValue: 0x01,
            r8Register: r8,
            r8Value: 0xff,
            expected: 0x00,
            flags: { z: 1, c: 1 },
        });

        testArithmeticOp({
            description: 'sets the zero flag when result is zero',
            opcode,
            aValue: 0x10,
            r8Register: r8,
            r8Value: 0xf0,
            expected: 0x00,
            flags: { z: 1, c: 1 },
        });
    });

    describe('add a, a', () => {
        const opcode = 0x87;

        testArithmeticOp({
            description: 'adds the value of A to itself',
            opcode,
            aValue: 0x01,
            r8Register: 'a',
            r8Value: 0x01,
            expected: 0x02,
        });

        testArithmeticOp({
            description: 'adds the value of A to itself with carry',
            opcode,
            aValue: 0xff,
            r8Register: 'a',
            r8Value: 0xff,
            expected: 0xfe,
            flags: { z: 0, c: 1 },
        });

        testArithmeticOp({
            description: 'handles overflow correctly',
            opcode,
            aValue: 0x80,
            r8Register: 'a',
            r8Value: 0x80,
            expected: 0x00,
            flags: { z: 1, c: 1 },
        });

        testArithmeticOp({
            description: 'sets the zero flag when result is zero',
            opcode,
            aValue: 0x0,
            r8Register: 'a',
            r8Value: 0x0,
            expected: 0x00,
            flags: { z: 1, c: 0 },
        });
    });
});
