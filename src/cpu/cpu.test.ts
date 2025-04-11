import { describe, expect, it } from 'vitest';
import { Cpu, r16Registers, R8Register, r8Registers } from './cpu';
import { MemoryBus } from '../memory/memoryBus';
import { Rom } from '../memory/rom';
import { Opcode } from './opcodes';

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
    const memoryBus = new MockMemoryBus(0x10000);
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

describe('ld r16, imm16', () => {
    it('loads immediate 16-bit value into BC', () => {
        const romData = new Uint8Array([0x01, 0x34, 0x12]);
        const cpu = setupWithRom(romData);

        cpu.step();

        expect(cpu.registers.bc).toBe(0x1234);
        expect(cpu.registers.pc).toBe(0x0103);
    });

    it('loads immediate 16-bit value into DE', () => {
        const romData = new Uint8Array([0x11, 0x34, 0x12]);
        const cpu = setupWithRom(romData);

        cpu.step();

        expect(cpu.registers.de).toBe(0x1234);
        expect(cpu.registers.pc).toBe(0x0103);
    });

    it('loads immediate 16-bit value into HL', () => {
        const romData = new Uint8Array([0x21, 0x34, 0x12]);
        const cpu = setupWithRom(romData);

        cpu.step();

        expect(cpu.registers.hl).toBe(0x1234);
        expect(cpu.registers.pc).toBe(0x0103);
    });

    it('loads immediate 16-bit value into SP', () => {
        const romData = new Uint8Array([0x31, 0x34, 0x12]);
        const cpu = setupWithRom(romData);

        cpu.step();

        expect(cpu.registers.sp).toBe(0x1234);
        expect(cpu.registers.pc).toBe(0x0103);
    });
});

describe('ld [r16mem], a', () => {
    it('loads the value of A into the memory location pointed by BC', () => {
        const romData = new Uint8Array([0x02]);
        const cpu = setupWithRom(romData);
        cpu.registers.bc = 0x1234;
        cpu.registers.a = 0x42;

        cpu.step();

        expect(cpu.memoryBus.read(0x1234)).toBe(0x42);
        expect(cpu.registers.pc).toBe(0x0101);
    });

    it('loads the value of A into the memory location pointed by DE', () => {
        const romData = new Uint8Array([0x12]);
        const cpu = setupWithRom(romData);
        cpu.registers.de = 0x5678;
        cpu.registers.a = 0x84;

        cpu.step();

        expect(cpu.memoryBus.read(0x5678)).toBe(0x84);
        expect(cpu.registers.pc).toBe(0x0101);
    });

    it('loads the value of A into the memory location pointed by HL (increment)', () => {
        const romData = new Uint8Array([0x22]);
        const cpu = setupWithRom(romData);
        cpu.registers.hl = 0x9abc;
        cpu.registers.a = 0x99;

        cpu.step();

        expect(cpu.memoryBus.read(0x9abc)).toBe(0x99);
        expect(cpu.registers.hl).toBe(0x9abd);
        expect(cpu.registers.pc).toBe(0x0101);
    });

    it('loads the value of A into the memory location pointed by HL (decrement)', () => {
        const romData = new Uint8Array([0x32]);
        const cpu = setupWithRom(romData);
        cpu.registers.hl = 0x9abc;
        cpu.registers.a = 0x99;

        cpu.step();

        expect(cpu.memoryBus.read(0x9abc)).toBe(0x99);
        expect(cpu.registers.hl).toBe(0x9abb);
        expect(cpu.registers.pc).toBe(0x0101);
    });
});

describe('ld a, [r16mem]', () => {
    it('loads the value from the memory location pointed by BC into A', () => {
        const romData = new Uint8Array([0x0a]);
        const cpu = setupWithRom(romData);
        cpu.registers.bc = 0x1234;
        cpu.memoryBus.write(0x1234, 0x42);

        cpu.step();

        expect(cpu.registers.a).toBe(0x42);
        expect(cpu.registers.pc).toBe(0x0101);
    });

    it('loads the value from the memory location pointed by DE into A', () => {
        const romData = new Uint8Array([0x1a]);
        const cpu = setupWithRom(romData);
        cpu.registers.de = 0x5678;
        cpu.memoryBus.write(0x5678, 0x84);

        cpu.step();

        expect(cpu.registers.a).toBe(0x84);
        expect(cpu.registers.pc).toBe(0x0101);
    });

    it('loads the value from the memory location pointed by HL into A (increment)', () => {
        const romData = new Uint8Array([0x2a]);
        const cpu = setupWithRom(romData);
        cpu.registers.hl = 0x9abc;
        cpu.memoryBus.write(0x9abc, 0x99);

        cpu.step();

        expect(cpu.registers.a).toBe(0x99);
        expect(cpu.registers.hl).toBe(0x9abd);
        expect(cpu.registers.pc).toBe(0x0101);
    });

    it('loads the value from the memory location pointed by HL into A (decrement)', () => {
        const romData = new Uint8Array([0x3a]);
        const cpu = setupWithRom(romData);
        cpu.registers.hl = 0x9abc;
        cpu.memoryBus.write(0x9abc, 0x99);

        cpu.step();

        expect(cpu.registers.a).toBe(0x99);
        expect(cpu.registers.hl).toBe(0x9abb);
        expect(cpu.registers.pc).toBe(0x0101);
    });
});

describe('ld [imm16], sp', () => {
    it('loads the value of SP into the memory location pointed by the immediate 16-bit value', () => {
        const romData = new Uint8Array([0x08, 0x34, 0x12]);
        const cpu = setupWithRom(romData);
        cpu.registers.sp = 0x5678;

        cpu.step();

        expect(cpu.memoryBus.read(0x1234)).toBe(0x78);
        expect(cpu.memoryBus.read(0x1235)).toBe(0x56);
        expect(cpu.registers.pc).toBe(0x0103);
    });
});

describe.for(r16Registers)('inc %s', r16 => {
    const opcode = 0x03 + r16Registers.indexOf(r16) * 0x10;

    it(`increments the value of ${r16}`, () => {
        const romData = new Uint8Array([opcode]);
        const cpu = setupWithRom(romData);
        cpu.registers[r16] = 0x1234;

        cpu.step();

        expect(cpu.registers[r16]).toBe(0x1235);
        expect(cpu.registers.pc).toBe(0x0101);
    });
});

describe.for(r16Registers)('dec %s', r16 => {
    const opcode = 0x0b + r16Registers.indexOf(r16) * 0x10;

    it(`decrements the value of ${r16}`, () => {
        const romData = new Uint8Array([opcode]);
        const cpu = setupWithRom(romData);
        cpu.registers[r16] = 0x1234;

        cpu.step();

        expect(cpu.registers[r16]).toBe(0x1233);
        expect(cpu.registers.pc).toBe(0x0101);
    });
});

const r16RegistersWithoutHL = r16Registers.filter(r => r !== 'hl');

describe.for(r16RegistersWithoutHL)('add hl, %s', r16 => {
    const opcode = 0x09 + r16Registers.indexOf(r16) * 0x10;

    it(`adds the value of ${r16} to HL`, () => {
        const romData = new Uint8Array([opcode]);
        const cpu = setupWithRom(romData);
        cpu.registers.hl = 0x1234;
        cpu.registers[r16] = 0x5678;

        cpu.step();

        expect(cpu.registers.hl).toBe(0x68ac);
        expect(cpu.registers.pc).toBe(0x0101);
    });
});

describe('add hl, hl', () => {
    const opcode = 0x29;

    it('adds the value of HL to itself', () => {
        const romData = new Uint8Array([opcode]);
        const cpu = setupWithRom(romData);
        cpu.registers.hl = 0x1234;

        cpu.step();

        expect(cpu.registers.hl).toBe(0x2468);
        expect(cpu.registers.pc).toBe(0x0101);
    });
});

describe('inc r8', () => {
    describe.for(r8Registers)('inc %s', r8 => {
        const opcode = 0x04 + (r8Registers.indexOf(r8) << 3);

        it(`increments the value of ${r8}`, () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.setR8Value(r8, 0x01);

            cpu.step();

            expect(cpu.getR8Value(r8)).toBe(0x02);
        });
    });
});

describe('dec r8', () => {
    describe.for(r8Registers)('dec %s', r8 => {
        const opcode = 0x05 + (r8Registers.indexOf(r8) << 3);

        it(`decrements the value of ${r8}`, () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.setR8Value(r8, 0x02);

            cpu.step();

            expect(cpu.getR8Value(r8)).toBe(0x01);
        });
    });
});

describe('ld r8, imm8', () => {
    describe.for(r8Registers)('ld %s, imm8', r8 => {
        const opcode = 0x06 + (r8Registers.indexOf(r8) << 3);

        it(`loads immediate 8-bit value into ${r8}`, () => {
            const romData = new Uint8Array([opcode, 0x42]);
            const cpu = setupWithRom(romData);

            cpu.step();

            expect(cpu.getR8Value(r8)).toBe(0x42);
            expect(cpu.registers.pc).toBe(0x0102);
        });
    });
});

describe('rlca', () => {
    it('rotates A left', () => {
        const romData = new Uint8Array([0x07]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00010101;

        cpu.step();

        expect(cpu.registers.a).toBe(0b00101010);
    });

    it('clears the zero flag', () => {
        const romData = new Uint8Array([0x07]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtract flag', () => {
        const romData = new Uint8Array([0x07]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const romData = new Uint8Array([0x07]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag', () => {
        const romData = new Uint8Array([0x07]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b10100000;

        cpu.step();

        expect(cpu.registers.a).toBe(0b01000001);
        expect(cpu.registers.carryFlag).toBe(1);
    });
});

describe('rrca', () => {
    it('rotates A right', () => {
        const romData = new Uint8Array([0x0f]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00010101;

        cpu.step();

        expect(cpu.registers.a).toBe(0b10001010);
    });

    it('clears the zero flag', () => {
        const romData = new Uint8Array([0x0f]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtract flag', () => {
        const romData = new Uint8Array([0x0f]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const romData = new Uint8Array([0x0f]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag', () => {
        const romData = new Uint8Array([0x0f]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00000001;

        cpu.step();

        expect(cpu.registers.a).toBe(0b10000000);
        expect(cpu.registers.carryFlag).toBe(1);
    });
});

describe('rla', () => {
    it('rotates A left through carry', () => {
        const romData = new Uint8Array([0x17]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00010101;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0b00101011);
    });

    it('clears the zero flag', () => {
        const romData = new Uint8Array([0x17]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtract flag', () => {
        const romData = new Uint8Array([0x17]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const romData = new Uint8Array([0x17]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00001111;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag', () => {
        const romData = new Uint8Array([0x17]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b10000000;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag correctly', () => {
        const romData = new Uint8Array([0x17]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b01000000;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0b10000001);
        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe('rra', () => {
    it('rotates A right through carry', () => {
        const romData = new Uint8Array([0x1f]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00010101;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0b10001010);
    });

    it('clears the zero flag', () => {
        const romData = new Uint8Array([0x1f]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtract flag', () => {
        const romData = new Uint8Array([0x1f]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const romData = new Uint8Array([0x1f]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00001111;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag', () => {
        const romData = new Uint8Array([0x1f]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00000001;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag correctly', () => {
        const romData = new Uint8Array([0x1f]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0b00000010;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0b10000001);
        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe('daa', () => {
    describe('after an addition', () => {
        it('does not adjust the value of A when result is less than 0x99', () => {
            const romData = new Uint8Array([0x27]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x77;

            cpu.step();

            expect(cpu.registers.a).toBe(0x77);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });

        it('adjusts the value of A correctly when unit digit is greater than 9', () => {
            const romData = new Uint8Array([0x27]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x42 + 0x29; // = 0x6b -> 0x71

            cpu.step();

            expect(cpu.registers.a).toBe(0x71);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });

        it('adjusts the value of A correctly when tens digit is greater than 9', () => {
            const romData = new Uint8Array([Opcode.DAA]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x54 + 0x70; // = 0xc4 -> 0x24 + carry

            cpu.step();

            expect(cpu.registers.a).toBe(0x24);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(1);
        });

        it('adjusts the value of A correctly when both digits are greater than 9', () => {
            const romData = new Uint8Array([Opcode.DAA]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x98 + 0x04; // = 0x9c -> 0x02 + carry

            cpu.step();

            expect(cpu.registers.a).toBe(0x02);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(1);
        });

        it('adjusts the value of A correctly when both digits are greater than 9 and carry is set', () => {
            const romData = new Uint8Array([Opcode.DAA]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x90 + 0x80; // = 0x10 -> 0x70 + carry
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0x70);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(1);
        });

        it('adjusts the value of A correctly when half carry is set', () => {
            const romData = new Uint8Array([Opcode.DAA]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x09 + 0x08; // = 0x11 -> 0x17
            cpu.registers.halfCarryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0x17);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });

        it('sets the zero flag when result is zero', () => {
            const romData = new Uint8Array([Opcode.DAA]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x00;

            cpu.step();

            expect(cpu.registers.a).toBe(0x00);
            expect(cpu.registers.zeroFlag).toBe(1);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });
    });

    describe('after a subtraction', () => {
        function setupAfterSubtraction() {
            const romData = new Uint8Array([Opcode.DAA]);
            const cpu = setupWithRom(romData);
            cpu.registers.subtractFlag = 1;

            return cpu;
        }

        it('does not adjust the value of A when result is less than 0x99', () => {
            const cpu = setupAfterSubtraction();
            cpu.registers.a = 0x77 - 0x55; // = 0x22

            cpu.step();

            expect(cpu.registers.a).toBe(0x22);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });

        it('adjusts the value of A correctly when half carry is set', () => {
            const cpu = setupAfterSubtraction();
            cpu.registers.a = 0x20 - 0x13; // = 0x0d -> 0x07
            cpu.registers.halfCarryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0x07);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });

        it('adjusts the value of A correctly when carry is set', () => {
            const cpu = setupAfterSubtraction();
            cpu.registers.a = 0x05 - 0x21; // = 0xe4 -> 0x84
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0x84);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });

        it('does not adjust A when the tens digit is greater than 9', () => {
            const cpu = setupAfterSubtraction();
            cpu.registers.a = 0xf0;

            cpu.step();

            expect(cpu.registers.a).toBe(0xf0);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });

        it('sets the zero flag when result is zero', () => {
            const cpu = setupAfterSubtraction();
            cpu.registers.a = 0x00;

            cpu.step();

            expect(cpu.registers.a).toBe(0x00);
            expect(cpu.registers.zeroFlag).toBe(1);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });
    });
});

describe('cpl', () => {
    it('correctly complements the value of A', () => {
        const cpu = setupWithRom(new Uint8Array([Opcode.CPL]));
        cpu.registers.a = 0b01010101;

        cpu.step();

        expect(cpu.registers.a).toBe(0b10101010);
    });

    it('sets the subtract flag', () => {
        const cpu = setupWithRom(new Uint8Array([Opcode.CPL]));

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(1);
    });

    it('sets the half carry flag', () => {
        const cpu = setupWithRom(new Uint8Array([Opcode.CPL]));

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(1);
    });
});

describe('scf', () => {
    it('sets the carry flag', () => {
        const cpu = setupWithRom(new Uint8Array([Opcode.SCF]));

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the subtract flag', () => {
        const cpu = setupWithRom(new Uint8Array([Opcode.SCF]));
        cpu.registers.subtractFlag = 1;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const cpu = setupWithRom(new Uint8Array([Opcode.SCF]));
        cpu.registers.halfCarryFlag = 1;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });
});

describe('ccf', () => {
    it('toggles the carry flag', () => {
        const cpu = setupWithRom(new Uint8Array([Opcode.CCF]));
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });

    it('clears the subtract flag', () => {
        const cpu = setupWithRom(new Uint8Array([Opcode.CCF]));
        cpu.registers.subtractFlag = 1;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const cpu = setupWithRom(new Uint8Array([Opcode.CCF]));
        cpu.registers.halfCarryFlag = 1;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });
});

describe('jr imm8', () => {
    it('jumps to the address specified by the signed immediate value', () => {
        const romData = new Uint8Array([Opcode.JR_imm8, 0x02]);
        const cpu = setupWithRom(romData);

        cpu.step();

        expect(cpu.registers.pc).toBe(0x0104);
    });

    it('jumps to the address specified by the signed immediate value (negative offset)', () => {
        const romData = new Uint8Array([Opcode.JR_imm8, 0xfe]);
        const cpu = setupWithRom(romData);

        cpu.step();

        expect(cpu.registers.pc).toBe(0x0100);
    });
});

describe('jr cond, imm8', () => {
    const conditions = [
        {
            opcode: Opcode.JR_Z_imm8,
            flag: 'zeroFlag' as const,
            trueValue: 1,
        },
        {
            opcode: Opcode.JR_NZ_imm8,
            flag: 'zeroFlag' as const,
            trueValue: 0,
        },
        {
            opcode: Opcode.JR_C_imm8,
            flag: 'carryFlag' as const,
            trueValue: 1,
        },
        {
            opcode: Opcode.JR_NC_imm8,
            flag: 'carryFlag' as const,
            trueValue: 0,
        },
    ];

    describe.for(conditions)('jr %s, imm8', conditionInfo => {
        it(`jumps to the address specified by the signed immediate value if condition is met`, () => {
            const romData = new Uint8Array([conditionInfo.opcode, 0x02]);
            const cpu = setupWithRom(romData);
            cpu.registers[conditionInfo.flag] = conditionInfo.trueValue;

            cpu.step();

            expect(cpu.registers.pc).toBe(0x0104);
        });

        it(`does not jump to the address specified by the signed immediate value if condition is not met`, () => {
            const romData = new Uint8Array([conditionInfo.opcode, 0x02]);
            const cpu = setupWithRom(romData);
            cpu.registers[conditionInfo.flag] = conditionInfo.trueValue ^ 1;

            cpu.step();

            expect(cpu.registers.pc).toBe(0x0102);
        });
    });
});
