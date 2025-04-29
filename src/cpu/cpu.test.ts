import { describe, expect, it } from 'vitest';
import {
    Cpu,
    r16Registers,
    r16StackRegisters,
    r8Registers,
    Register8,
} from './cpu';
import { Opcode, PrefixedOpcode, rstOpcodes } from './opcodes';
import { Word16 } from './word16';
import {
    IE_REGISTER_ADDRESS,
    IF_REGISTER_ADDRESS,
} from '../memory/gbMemoryBus';
import { Timer } from '../timer';
import {
    Interrupt,
    InterruptController,
    interrupts,
    interruptVectors,
} from '../interrupts';
import { MockMemoryBus } from '../tests/mockMemoryBus';

interface Flags {
    z?: number;
    n?: number;
    h?: number;
    c?: number;
}

interface ArithmeticOpTestCase {
    opcode: number;
    aValue: number;
    r8Register: Register8;
    r8Value: number;
    initialFlags?: Flags;
    expectedValue: number;
    expectedFlags?: Flags;
    description?: string;
}

const r8RegistersWithoutA = r8Registers.filter(r => r !== 'a');

function testArithmeticOp({
    opcode,
    aValue,
    r8Register,
    r8Value,
    initialFlags = {},
    expectedValue,
    expectedFlags = {},
    description,
}: ArithmeticOpTestCase) {
    const label =
        description ??
        `A=0x${aValue.toString(16)}, r8=0x${r8Value.toString(16)}`;

    it(label, () => {
        const rom = new Uint8Array([opcode]);
        const cpu = setupWithRom(rom);

        cpu.registers.a = aValue;
        cpu.registers.zeroFlag = initialFlags.z ?? 0;
        cpu.registers.subtractFlag = initialFlags.n ?? 0;
        cpu.registers.halfCarryFlag = initialFlags.h ?? 0;
        cpu.registers.carryFlag = initialFlags.c ?? 0;
        cpu.setR8Value(r8Register, r8Value);

        cpu.step();

        expect(cpu.registers.a).toBe(expectedValue);

        if (expectedFlags.z !== undefined) {
            expect(cpu.registers.zeroFlag).toBe(expectedFlags.z);
        }

        if (expectedFlags.n !== undefined) {
            expect(cpu.registers.subtractFlag).toBe(expectedFlags.n);
        }

        if (expectedFlags.h !== undefined) {
            expect(cpu.registers.halfCarryFlag).toBe(expectedFlags.h);
        }

        if (expectedFlags.c !== undefined) {
            expect(cpu.registers.carryFlag).toBe(expectedFlags.c);
        }
    });
}

const conditions = [
    {
        name: 'Z' as const,
        flag: 'zeroFlag' as const,
        trueValue: 1,
    },
    {
        name: 'NZ' as const,
        flag: 'zeroFlag' as const,
        trueValue: 0,
    },
    {
        name: 'C' as const,
        flag: 'carryFlag' as const,
        trueValue: 1,
    },
    {
        name: 'NC' as const,
        flag: 'carryFlag' as const,
        trueValue: 0,
    },
];

describe('initially', () => {
    function setupCpu() {
        const timer = new Timer();
        const memoryBus = new MockMemoryBus(16, timer);
        const interruptController = new InterruptController(memoryBus);
        return new Cpu(memoryBus, interruptController);
    }

    it('sets PC to 0x0100', () => {
        const cpu = setupCpu();

        expect(cpu.registers.pc).toBe(0x0100);
    });

    it('sets SP to 0xfffe', () => {
        const cpu = setupCpu();

        expect(cpu.registers.sp).toBe(0xfffe);
    });
});

/**
 * Creates a CPU instance with a mock memory bus and loads the given ROM data.
 * The ROM data is written to the memory bus starting at address 0x0100, since
 * the CPU starts executing instructions from this address.
 */
function setupWithRom(romData: Uint8Array) {
    const timer = new Timer();
    const memoryBus = new MockMemoryBus(0x10000, timer);
    const interruptController = new InterruptController(memoryBus);
    memoryBus.setRomData(romData);
    const cpu = new Cpu(memoryBus, interruptController);

    return cpu;
}

function setupWithRomData(data: number[]) {
    const timer = new Timer();
    const memoryBus = new MockMemoryBus(0x10000, timer);
    const interruptController = new InterruptController(memoryBus);
    memoryBus.setRomData(new Uint8Array(data));
    const cpu = new Cpu(memoryBus, interruptController);

    return { cpu, memoryBus, interruptController };
}

it('handles nop opcode', () => {
    const romData = new Uint8Array([0x00]);
    const cpu = setupWithRom(romData);

    cpu.step();

    expect(cpu.registers.pc).toBe(0x0101);
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

// TODO handle AF!

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

        it(`sets the zero flag if the new value is 0`, () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.setR8Value(r8, 0xff);

            cpu.step();

            expect(cpu.getR8Value(r8)).toBe(0x00);
            expect(cpu.registers.zeroFlag).toBe(1);
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

        it(`sets the zero flag if the new value is 0`, () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.setR8Value(r8, 0x01);

            cpu.step();

            expect(cpu.registers.zeroFlag).toBe(1);
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
        it('correctly increments', () => {
            const romData = new Uint8Array([
                Opcode.ADD_A_imm8,
                0x01,
                Opcode.DAA,
            ]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x09;

            cpu.step();
            cpu.step();

            expect(cpu.registers.a).toBe(0x10);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.subtractFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });

        it('correctly increments with half carry', () => {
            const romData = new Uint8Array([
                Opcode.ADD_A_imm8,
                0x01,
                Opcode.DAA,
            ]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x0f;

            cpu.step();
            cpu.step();

            expect(cpu.registers.a).toBe(0x16);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.subtractFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });

        it('correctly increments with carry', () => {
            const romData = new Uint8Array([
                Opcode.ADD_A_imm8,
                0x99,
                Opcode.DAA,
            ]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x99;

            cpu.step();
            cpu.step();

            expect(cpu.registers.a).toBe(0x98);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.subtractFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(1);
        });

        it('does not adjust the value of A when result is less than 0x99', () => {
            const romData = new Uint8Array([Opcode.DAA]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x77;

            cpu.step();

            expect(cpu.registers.a).toBe(0x77);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });

        it('adjusts the value of A correctly when unit digit is greater than 9', () => {
            const romData = new Uint8Array([Opcode.DAA]);
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

        it('correctly acts after subtraction without half carry', () => {
            const { cpu } = setupWithRomData([
                Opcode.LD_A_imm8,
                0x15,
                Opcode.SUB_A_imm8,
                0x06,
                Opcode.DAA,
            ]);

            cpu.step();
            cpu.step();
            cpu.step();

            expect(cpu.registers.a).toBe(0x09);
            expect(cpu.registers.zeroFlag).toBe(0);
            expect(cpu.registers.subtractFlag).toBe(1);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });

        it('sets zero flag when result is 0', () => {
            const { cpu } = setupWithRomData([
                Opcode.LD_A_imm8,
                0x10,
                Opcode.SUB_A_imm8,
                0x10,
                Opcode.DAA,
            ]);

            cpu.step();
            cpu.step();
            cpu.step();

            expect(cpu.registers.a).toBe(0x00);
            expect(cpu.registers.zeroFlag).toBe(1);
            expect(cpu.registers.subtractFlag).toBe(1);
            expect(cpu.registers.halfCarryFlag).toBe(0);
            expect(cpu.registers.carryFlag).toBe(0);
        });

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
            expect(cpu.registers.carryFlag).toBe(1);
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
    describe.for(conditions)('jr %s, imm8', conditionInfo => {
        const opcode = Opcode[`JR_${conditionInfo.name}_imm8`];

        it(`jumps to the address specified by the signed immediate value if condition is met`, () => {
            const romData = new Uint8Array([opcode, 0x02]);
            const cpu = setupWithRom(romData);
            cpu.registers[conditionInfo.flag] = conditionInfo.trueValue;

            cpu.step();

            expect(cpu.registers.pc).toBe(0x0104);
        });

        it(`does not jump to the address specified by the signed immediate value if condition is not met`, () => {
            const romData = new Uint8Array([opcode, 0x02]);
            const cpu = setupWithRom(romData);
            cpu.registers[conditionInfo.flag] = conditionInfo.trueValue ^ 1;

            cpu.step();

            expect(cpu.registers.pc).toBe(0x0102);
        });
    });
});

describe('ld r8, r8', () => {
    // create cross product of r8 registers
    const r8RegisterPairs = [];

    for (const r8From of r8Registers) {
        for (const r8To of r8Registers) {
            r8RegisterPairs.push([r8From, r8To]);
        }
    }

    describe.for(r8RegisterPairs)('ld %s, %s', ([r8To, r8From]) => {
        const opcode =
            Opcode.LD_B_B +
            (r8Registers.indexOf(r8To) << 3) +
            r8Registers.indexOf(r8From);

        it(`loads the value of ${r8From} into ${r8To}`, () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.setR8Value(r8From, 0x42);

            cpu.step();

            expect(cpu.getR8Value(r8To)).toBe(0x42);
        });
    });
});

describe('ei', () => {
    it('does not enable interrupts immediately', () => {
        const romData = new Uint8Array([Opcode.EI]);
        const cpu = setupWithRom(romData);

        cpu.step();

        expect(cpu.areInterruptsEnabled).toBe(false);
    });

    it('enables interrupts after the next instruction', () => {
        const romData = new Uint8Array([Opcode.EI, Opcode.NOP]);
        const cpu = setupWithRom(romData);

        cpu.step();
        cpu.step();

        expect(cpu.areInterruptsEnabled).toBe(true);
    });
});

describe('di', () => {
    it('disables interrupts immediately', () => {
        const romData = new Uint8Array([Opcode.DI]);
        const cpu = setupWithRom(romData);

        cpu.step();

        expect(cpu.areInterruptsEnabled).toBe(false);
    });

    it('cancels the EI instruction', () => {
        const romData = new Uint8Array([Opcode.EI, Opcode.DI]);
        const cpu = setupWithRom(romData);

        cpu.step();
        cpu.step();

        expect(cpu.areInterruptsEnabled).toBe(false);
    });
});

describe('add a, r8', () => {
    describe.for(r8RegistersWithoutA)('add a, %s', r8 => {
        const opcode = 0x80 + r8Registers.indexOf(r8);

        testArithmeticOp({
            description: 'adds the value of the register to A',
            opcode,
            aValue: 0x01,
            r8Register: r8,
            r8Value: 0x02,
            expectedValue: 0x03,
        });

        testArithmeticOp({
            description: 'adds the value of the register to A with carry',
            opcode,
            aValue: 0xff,
            r8Register: r8,
            r8Value: 0x02,
            expectedValue: 0x01,
            expectedFlags: { z: 0, c: 1 },
        });

        testArithmeticOp({
            description: 'handles overflow correctly',
            opcode,
            aValue: 0x01,
            r8Register: r8,
            r8Value: 0xff,
            expectedValue: 0x00,
            expectedFlags: { z: 1, c: 1 },
        });

        testArithmeticOp({
            description: 'sets the zero flag when result is zero',
            opcode,
            aValue: 0x10,
            r8Register: r8,
            r8Value: 0xf0,
            expectedValue: 0x00,
            expectedFlags: { z: 1, c: 1 },
        });

        testArithmeticOp({
            description: 'sets the half carry flag when there is a half carry',
            opcode,
            aValue: 0x0f,
            r8Register: r8,
            r8Value: 0x01,
            expectedValue: 0x10,
            expectedFlags: { z: 0, c: 0, h: 1 },
        });

        testArithmeticOp({
            description:
                'clears the half carry flag when there is no half carry',
            opcode,
            aValue: 0x08,
            r8Register: r8,
            r8Value: 0x01,
            initialFlags: { h: 1 },
            expectedValue: 0x9,
            expectedFlags: { z: 0, c: 0, h: 0 },
        });

        testArithmeticOp({
            description: 'sets the carry flag when there is a carry',
            opcode,
            aValue: 0xff,
            r8Register: r8,
            r8Value: 0x01,
            expectedValue: 0x00,
            expectedFlags: { z: 1, c: 1 },
        });

        testArithmeticOp({
            description: 'clears the carry flag when there is no carry',
            opcode,
            aValue: 0x01,
            r8Register: r8,
            r8Value: 0x01,
            initialFlags: { c: 1 },
            expectedValue: 0x02,
            expectedFlags: { z: 0, c: 0 },
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
            expectedValue: 0x02,
        });

        testArithmeticOp({
            description: 'adds the value of A to itself with carry',
            opcode,
            aValue: 0xff,
            r8Register: 'a',
            r8Value: 0xff,
            expectedValue: 0xfe,
            expectedFlags: { z: 0, c: 1 },
        });

        testArithmeticOp({
            description: 'handles overflow correctly',
            opcode,
            aValue: 0x80,
            r8Register: 'a',
            r8Value: 0x80,
            expectedValue: 0x00,
            expectedFlags: { z: 1, c: 1 },
        });

        testArithmeticOp({
            description: 'sets the zero flag when result is zero',
            opcode,
            aValue: 0x0,
            r8Register: 'a',
            r8Value: 0x0,
            expectedValue: 0x00,
            expectedFlags: { z: 1, c: 0 },
        });
    });
});

describe('adc a, r8', () => {
    function setupAdcTest(r8: Register8) {
        const opcode = Opcode.ADC_A_B + r8Registers.indexOf(r8);
        const romData = new Uint8Array([opcode]);
        const cpu = setupWithRom(romData);

        return cpu;
    }

    describe.for(r8RegistersWithoutA)('adc a, %s', r8 => {
        it(`adds the value of ${r8} to A with carry`, () => {
            const cpu = setupAdcTest(r8);
            cpu.registers.a = 0x01;
            cpu.setR8Value(r8, 0x02);
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0x04);
        });

        it('sets the zero flag when result is zero', () => {
            const cpu = setupAdcTest(r8);
            cpu.registers.a = 0;
            cpu.setR8Value(r8, 0xff);
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0);
            expect(cpu.registers.zeroFlag).toBe(1);
        });

        it('clears the subtraction flag', () => {
            const cpu = setupAdcTest(r8);
            cpu.registers.subtractFlag = 1;
            cpu.registers.a = 0x01;
            cpu.setR8Value(r8, 0x02);
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.subtractFlag).toBe(0);
        });

        it('sets the half carry flag when there is a half carry', () => {
            const cpu = setupAdcTest(r8);
            cpu.registers.a = 0x0f;
            cpu.setR8Value(r8, 0x08);
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.halfCarryFlag).toBe(1);
        });

        it('sets the carry flag when there is a carry', () => {
            const cpu = setupAdcTest(r8);
            cpu.registers.a = 0xff;
            cpu.setR8Value(r8, 0x01);
            cpu.registers.carryFlag = 0;

            cpu.step();

            expect(cpu.registers.carryFlag).toBe(1);
        });

        it('clears the half carry flag when there is no half carry', () => {
            const cpu = setupAdcTest(r8);
            cpu.registers.a = 0x05;
            cpu.setR8Value(r8, 0x05);
            cpu.registers.carryFlag = 1;
            cpu.registers.halfCarryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0x0b);
            expect(cpu.registers.halfCarryFlag).toBe(0);
        });

        it('clears the carry flag when there is no carry', () => {
            const cpu = setupAdcTest(r8);
            cpu.registers.a = 0x05;
            cpu.setR8Value(r8, 0x05);
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0x0b);
            expect(cpu.registers.carryFlag).toBe(0);
        });
    });

    describe('adc a, a', () => {
        it(`adds the value of A to A with carry`, () => {
            const cpu = setupAdcTest('a');
            cpu.registers.a = 0x02;
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0x05);
        });
    });
});

describe('sub a, r8', () => {
    describe.for(r8RegistersWithoutA)('sub %s', r8 => {
        const opcode = Opcode.SUB_A_B + r8Registers.indexOf(r8);

        testArithmeticOp({
            description: 'subtracts the value of the register from A',
            opcode,
            aValue: 0x03,
            r8Register: r8,
            r8Value: 0x02,
            expectedValue: 0x01,
        });

        testArithmeticOp({
            description:
                'subtracts the value of the register from A with borrow',
            opcode,
            aValue: 0x01,
            r8Register: r8,
            r8Value: 0x02,
            expectedValue: 0xff,
            expectedFlags: { z: 0, c: 1 },
        });

        testArithmeticOp({
            description: 'handles underflow correctly',
            opcode,
            aValue: 0x00,
            r8Register: r8,
            r8Value: 0xff,
            expectedValue: 0x01,
            expectedFlags: { z: 0, c: 1 },
        });

        testArithmeticOp({
            description:
                'sets the zero flag when result is zero after subtraction',
            opcode,
            aValue: 0x00,
            r8Register: r8,
            r8Value: 0x00,
            expectedValue: 0x00,
            expectedFlags: { z: 1, c: 0 },
        });

        testArithmeticOp({
            description: 'sets the half carry flag when there is a half borrow',
            opcode,
            aValue: 0x10,
            r8Register: r8,
            r8Value: 0x08,
            expectedValue: 0x08,
            expectedFlags: { z: 0, c: 0, h: 1 },
        });

        testArithmeticOp({
            description:
                'clears the half carry flag when there is no half borrow',
            opcode,
            aValue: 0x09,
            r8Register: r8,
            r8Value: 0x01,
            initialFlags: { h: 1 },
            expectedValue: 0x08,
            expectedFlags: { z: 0, c: 0, h: 0 },
        });

        testArithmeticOp({
            description: 'sets the carry flag when there is a borrow',
            opcode,
            aValue: 0x00,
            r8Register: r8,
            r8Value: 0x01,
            expectedValue: 0xff,
            expectedFlags: { z: 0, c: 1 },
        });

        testArithmeticOp({
            description: 'clears the carry flag when there is no borrow',
            opcode,
            aValue: 0x01,
            r8Register: r8,
            r8Value: 0x01,
            initialFlags: { c: 1 },
            expectedValue: 0x00,
            expectedFlags: { z: 1, c: 0 },
        });
    });

    describe('sub a, a', () => {
        const opcode = Opcode.SUB_A_A;

        testArithmeticOp({
            description: 'subtracts the value of A from itself without borrow',
            opcode,
            aValue: 0x03,
            r8Register: 'a',
            r8Value: 0x03,
            expectedValue: 0x00,
        });

        testArithmeticOp({
            description: 'subtracts the value of A from itself with borrow',
            opcode,
            aValue: 0x01,
            r8Register: 'a',
            r8Value: 0x01,
            expectedValue: 0x0,
            expectedFlags: { z: 1, c: 0 },
        });
    });
});

describe('sbc a, r8', () => {
    function setupSbcTest(r8: Register8) {
        const opcode = Opcode.SBC_A_B + r8Registers.indexOf(r8);
        const romData = new Uint8Array([opcode]);
        const cpu = setupWithRom(romData);

        return cpu;
    }

    describe.for(r8RegistersWithoutA)('sbc a, %s', r8 => {
        it(`subtracts the value of ${r8} and carry from A`, () => {
            const cpu = setupSbcTest(r8);
            cpu.registers.a = 0x03;
            cpu.setR8Value(r8, 0x02);
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0x00);
        });

        it('sets the zero flag when result is zero', () => {
            const cpu = setupSbcTest(r8);
            cpu.registers.a = 0x00;
            cpu.setR8Value(r8, 0xff);
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0);
            expect(cpu.registers.zeroFlag).toBe(1);
        });

        it('sets the subtract flag', () => {
            const cpu = setupSbcTest(r8);
            cpu.registers.subtractFlag = 0;
            cpu.registers.a = 0x01;
            cpu.setR8Value(r8, 0x02);

            cpu.step();

            expect(cpu.registers.subtractFlag).toBe(1);
        });

        it('sets the half carry flag when there is a half borrow', () => {
            const cpu = setupSbcTest(r8);
            cpu.registers.a = 0x10;
            cpu.setR8Value(r8, 0x08);
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.halfCarryFlag).toBe(1);
        });

        it('clears the half carry flag when there is no half borrow', () => {
            const cpu = setupSbcTest(r8);
            cpu.registers.a = 0x09;
            cpu.setR8Value(r8, 0x01);
            cpu.registers.carryFlag = 1;
            cpu.registers.halfCarryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0x07);
            expect(cpu.registers.halfCarryFlag).toBe(0);
        });

        it('sets the carry flag when there is a borrow', () => {
            const cpu = setupSbcTest(r8);
            cpu.registers.a = 0x00;
            cpu.setR8Value(r8, 0x01);
            cpu.registers.carryFlag = 0;

            cpu.step();

            expect(cpu.registers.carryFlag).toBe(1);
        });

        it('clears the carry flag when there is no borrow', () => {
            const cpu = setupSbcTest(r8);
            cpu.registers.a = 0x02;
            cpu.setR8Value(r8, 0x01);
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0x00);
            expect(cpu.registers.carryFlag).toBe(0);
        });
    });

    describe('sbc a, a', () => {
        it('subtracts the value of A from itself without borrow', () => {
            const cpu = setupSbcTest('a');
            cpu.registers.a = 0x03;
            cpu.registers.carryFlag = 0;

            cpu.step();

            expect(cpu.registers.a).toBe(0x00);
        });

        it('subtracts the value of A from itself with borrow', () => {
            const cpu = setupSbcTest('a');
            cpu.registers.a = 0x01;
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.a).toBe(0xff);
        });
    });
});

describe('and a, r8', () => {
    describe.for(r8RegistersWithoutA)('and %s', r8 => {
        const opcode = Opcode.AND_A_B + r8Registers.indexOf(r8);

        it('correctly performs a bitwise AND operation', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0b11001100;
            cpu.setR8Value(r8, 0b10101010);

            cpu.step();

            expect(cpu.registers.a).toBe(0b10001000);
        });

        it('sets the zero flag when result is zero', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0b00000000;
            cpu.setR8Value(r8, 0b00000000);

            cpu.step();

            expect(cpu.registers.zeroFlag).toBe(1);
        });

        it('clears the subtraction flag', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.subtractFlag = 1;

            cpu.step();

            expect(cpu.registers.subtractFlag).toBe(0);
        });

        it('sets the half carry flag', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.halfCarryFlag = 0;

            cpu.step();

            expect(cpu.registers.halfCarryFlag).toBe(1);
        });

        it('clears the carry flag', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.carryFlag).toBe(0);
        });
    });

    describe('and a, a', () => {
        const opcode = Opcode.AND_A_A;

        it('correctly performs a bitwise AND operation', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0b11001100;

            cpu.step();

            expect(cpu.registers.a).toBe(0b11001100);
        });
    });
});

describe('xor a, r8', () => {
    describe.for(r8RegistersWithoutA)('xor a, %s', r8 => {
        const opcode = Opcode.XOR_A_B + r8Registers.indexOf(r8);

        it('correctly performs a bitwise XOR operation', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0b11001100;
            cpu.setR8Value(r8, 0b10101010);

            cpu.step();

            expect(cpu.registers.a).toBe(0b01100110);
        });

        it('sets the zero flag when result is zero', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0b00000000;
            cpu.setR8Value(r8, 0b00000000);

            cpu.step();

            expect(cpu.registers.zeroFlag).toBe(1);
        });

        it('clears the subtraction flag', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.subtractFlag = 1;

            cpu.step();

            expect(cpu.registers.subtractFlag).toBe(0);
        });

        it('clears the half carry flag', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.halfCarryFlag = 1;

            cpu.step();

            expect(cpu.registers.halfCarryFlag).toBe(0);
        });

        it('clears the carry flag', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.carryFlag).toBe(0);
        });
    });

    describe('xor a, a', () => {
        const opcode = Opcode.XOR_A_A;

        it('correctly performs a bitwise XOR operation', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0b11001100;

            cpu.step();

            expect(cpu.registers.a).toBe(0b00000000);
        });
    });
});

describe('or a, r8', () => {
    describe.for(r8RegistersWithoutA)('or a, %s', r8 => {
        const opcode = Opcode.OR_A_B + r8Registers.indexOf(r8);

        it('correctly performs a bitwise OR operation', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0b11001100;
            cpu.setR8Value(r8, 0b10101010);

            cpu.step();

            expect(cpu.registers.a).toBe(0b11101110);
        });

        it('sets the zero flag when result is zero', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0b00000000;
            cpu.setR8Value(r8, 0b00000000);

            cpu.step();

            expect(cpu.registers.zeroFlag).toBe(1);
        });

        it('clears the subtraction flag', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.subtractFlag = 1;

            cpu.step();

            expect(cpu.registers.subtractFlag).toBe(0);
        });

        it('clears the half carry flag', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.halfCarryFlag = 1;

            cpu.step();

            expect(cpu.registers.halfCarryFlag).toBe(0);
        });

        it('clears the carry flag', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.carryFlag).toBe(0);
        });
    });

    describe('or a, a', () => {
        const opcode = Opcode.OR_A_A;

        it('correctly performs a bitwise or operation', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0b11001100;

            cpu.step();

            expect(cpu.registers.a).toBe(0b11001100);
        });
    });
});

describe('cp a, r8', () => {
    describe.for(r8RegistersWithoutA)('cp a, %s', r8 => {
        const opcode = Opcode.CP_A_B + r8Registers.indexOf(r8);

        it('does not change the value of A', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x42;
            cpu.setR8Value(r8, 0x01);

            cpu.step();

            expect(cpu.registers.a).toBe(0x42);
        });

        it('sets the zero flag when result is zero', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0b00000000;
            cpu.setR8Value(r8, 0b00000000);

            cpu.step();

            expect(cpu.registers.zeroFlag).toBe(1);
        });

        it('sets the subtraction flag', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.subtractFlag = 0;

            cpu.step();

            expect(cpu.registers.subtractFlag).toBe(1);
        });

        it('sets the half carry flag when there is a half borrow', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x10;
            cpu.setR8Value(r8, 0x08);
            cpu.registers.halfCarryFlag = 0;

            cpu.step();

            expect(cpu.registers.halfCarryFlag).toBe(1);
        });

        it('clears the half carry flag when there is no half borrow', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x09;
            cpu.setR8Value(r8, 0x01);
            cpu.registers.halfCarryFlag = 1;

            cpu.step();

            expect(cpu.registers.halfCarryFlag).toBe(0);
        });

        it('sets the carry flag when A is less than the register', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x00;
            cpu.setR8Value(r8, 0x01);

            cpu.step();

            expect(cpu.registers.carryFlag).toBe(1);
        });

        it('clears the carry flag when A is greater than or equal to the register', () => {
            const romData = new Uint8Array([opcode]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x01;
            cpu.setR8Value(r8, 0x00);

            cpu.step();

            expect(cpu.registers.carryFlag).toBe(0);
        });
    });

    describe('cp a, a', () => {
        it('clears the carry flag', () => {
            const romData = new Uint8Array([Opcode.CP_A_A]);
            const cpu = setupWithRom(romData);
            cpu.registers.a = 0x01;
            cpu.registers.carryFlag = 1;

            cpu.step();

            expect(cpu.registers.carryFlag).toBe(0);
        });
    });
});

describe('add a, imm8', () => {
    it('adds an immediate value to A', () => {
        const romData = new Uint8Array([Opcode.ADD_A_imm8, 0x02]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0x01;

        cpu.step();

        expect(cpu.registers.a).toBe(0x03);
    });

    it('correctly increases PC', () => {
        const romData = new Uint8Array([Opcode.ADD_A_imm8, 0x02]);
        const cpu = setupWithRom(romData);

        cpu.step();

        expect(cpu.registers.pc).toBe(0x0102);
    });

    it('sets the zero flag when result is zero', () => {
        const romData = new Uint8Array([Opcode.ADD_A_imm8, 0x00]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0x00;

        cpu.step();

        expect(cpu.registers.a).toBe(0x00);
        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the subtract flag', () => {
        const romData = new Uint8Array([Opcode.ADD_A_imm8, 0x01]);
        const cpu = setupWithRom(romData);
        cpu.registers.subtractFlag = 1;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('sets the half carry flag when there is a half carry', () => {
        const romData = new Uint8Array([Opcode.ADD_A_imm8, 0x01]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0x0f;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(1);
    });

    it('clears the half carry flag when there is no half carry', () => {
        const romData = new Uint8Array([Opcode.ADD_A_imm8, 0x01]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0x08;
        cpu.registers.halfCarryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0x09);
        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag when there is a carry', () => {
        const romData = new Uint8Array([Opcode.ADD_A_imm8, 0x02]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0xff;

        cpu.step();

        expect(cpu.registers.a).toBe(0x01);
        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag when there is no carry', () => {
        const romData = new Uint8Array([Opcode.ADD_A_imm8, 0x01]);
        const cpu = setupWithRom(romData);
        cpu.registers.a = 0x01;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0x02);
        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe('adc a, imm8', () => {
    it(`adds the immediate value to A with carry`, () => {
        const { cpu } = setupWithRomData([Opcode.ADC_A_imm8, 0x02]);
        cpu.registers.a = 0x01;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0x04);
    });

    it('correctly increases PC', () => {
        const { cpu } = setupWithRomData([Opcode.ADC_A_imm8, 0x02]);

        cpu.step();

        expect(cpu.registers.pc).toBe(0x0102);
    });

    it('sets the zero flag when result is zero', () => {
        const { cpu } = setupWithRomData([Opcode.ADC_A_imm8, 0xff]);
        cpu.registers.a = 0;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0);
        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the subtraction flag', () => {
        const { cpu } = setupWithRomData([Opcode.ADC_A_imm8, 0x01]);
        cpu.registers.subtractFlag = 1;
        cpu.registers.a = 0x01;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('sets the half carry flag when there is a half carry', () => {
        const { cpu } = setupWithRomData([Opcode.ADC_A_imm8, 0x01]);
        cpu.registers.a = 0x0f;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(1);
    });

    it('clears the half carry flag when there is no half carry', () => {
        const { cpu } = setupWithRomData([Opcode.ADC_A_imm8, 0x01]);
        cpu.registers.a = 0x05;
        cpu.registers.carryFlag = 1;
        cpu.registers.halfCarryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0x07);
        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag when there is a carry', () => {
        const { cpu } = setupWithRomData([Opcode.ADC_A_imm8, 0x02]);
        cpu.registers.a = 0xff;
        cpu.registers.carryFlag = 0;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag when there is no carry', () => {
        const { cpu } = setupWithRomData([Opcode.ADC_A_imm8, 0x01]);
        cpu.registers.a = 0x05;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0x07);
        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe('sub a, imm8', () => {
    it(`subtracts the immediate value from A`, () => {
        const { cpu } = setupWithRomData([Opcode.SUB_A_imm8, 0x02]);
        cpu.registers.a = 0x03;

        cpu.step();

        expect(cpu.registers.a).toBe(0x01);
    });

    it('correctly increases PC', () => {
        const { cpu } = setupWithRomData([Opcode.SUB_A_imm8, 0x02]);

        cpu.step();

        expect(cpu.registers.pc).toBe(0x0102);
    });

    it('sets the zero flag when result is zero', () => {
        const { cpu } = setupWithRomData([Opcode.SUB_A_imm8, 0x01]);
        cpu.registers.a = 0x01;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag when result is not zero', () => {
        const { cpu } = setupWithRomData([Opcode.SUB_A_imm8, 0x01]);
        cpu.registers.a = 0x02;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('sets the subtraction flag', () => {
        const { cpu } = setupWithRomData([Opcode.SUB_A_imm8, 0x21]);
        cpu.registers.subtractFlag = 0;
        cpu.registers.a = 0x01;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(1);
    });

    it('sets the half carry flag when there is a half carry', () => {
        const { cpu } = setupWithRomData([Opcode.SUB_A_imm8, 0x01]);
        cpu.registers.a = 0x10;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(1);
    });

    it('clears the half carry flag when there is no half carry', () => {
        const { cpu } = setupWithRomData([Opcode.SUB_A_imm8, 0x01]);
        cpu.registers.a = 0x09;
        cpu.registers.halfCarryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0x08);
        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag when there is a carry', () => {
        const { cpu } = setupWithRomData([Opcode.SUB_A_imm8, 0x02]);
        cpu.registers.a = 0x00;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag when there is no carry', () => {
        const { cpu } = setupWithRomData([Opcode.SUB_A_imm8, 0x01]);
        cpu.registers.a = 0x01;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0x00);
        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe('sbc a, imm8', () => {
    it(`subtracts the immediate value from A with carry`, () => {
        const { cpu } = setupWithRomData([Opcode.SBC_A_imm8, 0x02]);
        cpu.registers.a = 0x03;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0x00);
    });

    it('correctly increases PC', () => {
        const { cpu } = setupWithRomData([Opcode.SBC_A_imm8, 0x02]);

        cpu.step();

        expect(cpu.registers.pc).toBe(0x0102);
    });

    it('sets the zero flag when result is zero', () => {
        const { cpu } = setupWithRomData([Opcode.SBC_A_imm8, 0x01]);
        cpu.registers.a = 0x02;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag when result is not zero', () => {
        const { cpu } = setupWithRomData([Opcode.SBC_A_imm8, 0x01]);
        cpu.registers.a = 0x03;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('sets the subtraction flag', () => {
        const { cpu } = setupWithRomData([Opcode.SBC_A_imm8, 0x21]);
        cpu.registers.subtractFlag = 0;
        cpu.registers.a = 0x01;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(1);
    });

    it('sets the half carry flag when there is a half carry', () => {
        const { cpu } = setupWithRomData([Opcode.SBC_A_imm8, 0x01]);
        cpu.registers.a = 0x10;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(1);
    });

    it('clears the half carry flag when there is no half carry', () => {
        const { cpu } = setupWithRomData([Opcode.SBC_A_imm8, 0x01]);
        cpu.registers.a = 0x09;
        cpu.registers.carryFlag = 1;
        cpu.registers.halfCarryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0x07);
        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag when there is a carry', () => {
        const { cpu } = setupWithRomData([Opcode.SBC_A_imm8, 0x02]);
        cpu.registers.a = 0x00;
        cpu.registers.carryFlag = 0;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag when there is no carry', () => {
        const { cpu } = setupWithRomData([Opcode.SBC_A_imm8, 0x01]);
        cpu.registers.a = 0x02;
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.a).toBe(0x00);
        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe('and a, imm8', () => {
    const opcode = Opcode.AND_A_imm8;

    it('correctly performs a bitwise AND operation', () => {
        const { cpu } = setupWithRomData([opcode, 0b10101010]);
        cpu.registers.a = 0b11001100;

        cpu.step();

        expect(cpu.registers.a).toBe(0b10001000);
    });

    it('correctly increases PC', () => {
        const { cpu } = setupWithRomData([opcode, 0b10101010]);

        cpu.step();

        expect(cpu.registers.pc).toBe(0x0102);
    });

    it('sets the zero flag when result is zero', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000000]);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag when result is not zero', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000001]);
        cpu.registers.a = 0b00000001;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtraction flag', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000001]);
        cpu.registers.subtractFlag = 1;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('sets the half carry flag', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000001]);
        cpu.registers.halfCarryFlag = 0;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(1);
    });

    it('clears the carry flag', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000001]);
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe('xor a, imm8', () => {
    const opcode = Opcode.XOR_A_imm8;

    it('correctly performs a bitwise XOR operation', () => {
        const { cpu } = setupWithRomData([opcode, 0b10101010]);
        cpu.registers.a = 0b11001100;

        cpu.step();

        expect(cpu.registers.a).toBe(0b01100110);
    });

    it('correctly increases PC', () => {
        const { cpu } = setupWithRomData([opcode, 0b10101010]);

        cpu.step();

        expect(cpu.registers.pc).toBe(0x0102);
    });

    it('sets the zero flag when result is zero', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000000]);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag when result is not zero', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000000]);
        cpu.registers.a = 0b00000001;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtraction flag', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000001]);
        cpu.registers.subtractFlag = 1;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000001]);
        cpu.registers.halfCarryFlag = 1;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('clears the carry flag', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000001]);
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe('or a, imm8', () => {
    const opcode = Opcode.OR_A_imm8;

    it('correctly performs a bitwise OR operation', () => {
        const { cpu } = setupWithRomData([opcode, 0b10101010]);
        cpu.registers.a = 0b11001100;

        cpu.step();

        expect(cpu.registers.a).toBe(0b11101110);
    });

    it('correctly increases PC', () => {
        const { cpu } = setupWithRomData([opcode, 0b10101010]);

        cpu.step();

        expect(cpu.registers.pc).toBe(0x0102);
    });

    it('sets the zero flag when result is zero', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000000]);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag when result is not zero', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000000]);
        cpu.registers.a = 0b00000001;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtraction flag', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000001]);
        cpu.registers.subtractFlag = 1;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000001]);
        cpu.registers.halfCarryFlag = 1;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('clears the carry flag', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000001]);
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe('cp a, imm8', () => {
    const opcode = Opcode.CP_A_imm8;

    it('does not change the value of A', () => {
        const { cpu } = setupWithRomData([opcode, 0x01]);
        cpu.registers.a = 0x42;

        cpu.step();

        expect(cpu.registers.a).toBe(0x42);
    });

    it('correctly increases PC', () => {
        const { cpu } = setupWithRomData([opcode, 0b10101010]);

        cpu.step();

        expect(cpu.registers.pc).toBe(0x0102);
    });

    it('sets the zero flag when result is zero', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000000]);
        cpu.registers.a = 0b00000000;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag when result is not zero', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000000]);
        cpu.registers.a = 0b00000001;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('sets the subtraction flag', () => {
        const { cpu } = setupWithRomData([opcode, 0b00000001]);
        cpu.registers.subtractFlag = 0;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(1);
    });

    it('sets the half carry flag when there is a half borrow', () => {
        const { cpu } = setupWithRomData([opcode, 0x08]);
        cpu.registers.a = 0x10;
        cpu.registers.halfCarryFlag = 0;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(1);
    });

    it('clears the half carry flag when there is no half borrow', () => {
        const { cpu } = setupWithRomData([opcode, 0x01]);
        cpu.registers.a = 0x09;
        cpu.registers.halfCarryFlag = 1;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag when A is less than the immediate value', () => {
        const { cpu } = setupWithRomData([opcode, 0x01]);
        cpu.registers.a = 0x00;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag when A is greater than or equal to the immediate value', () => {
        const { cpu } = setupWithRomData([opcode, 0x01]);
        cpu.registers.a = 0x01;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

function readWordFromStack(cpu: Cpu) {
    const low = cpu.memoryBus.read(cpu.registers.sp);
    const high = cpu.memoryBus.read(cpu.registers.sp + 1);
    return (high << 8) | low;
}

describe('when executing a CALL imm16', () => {
    function setupAfterCall() {
        // sets up a CALL to address 0x110, followed by a NOP
        const callAddress = 0x110;
        const { cpu } = setupWithRomData([
            Opcode.CALL_imm16,
            0x10,
            0x1,
            Opcode.NOP,
        ]);

        return { cpu, callAddress };
    }

    it('pushes the instruction address after CALL on the stack', () => {
        const { cpu } = setupAfterCall();
        const initialSp = cpu.registers.sp;

        cpu.step();

        expect(cpu.registers.sp).toBe(initialSp - 2);
        expect(readWordFromStack(cpu)).toBe(0x103);
    });

    it('sets PC to the correct CALL address', () => {
        const { cpu, callAddress } = setupAfterCall();

        cpu.step();

        expect(cpu.registers.pc).toBe(callAddress);
    });

    describe('when executing RET', () => {
        function setupAfterRet() {
            // sets up a CALL to address 0x110, followed by a NOP
            const callAddress = new Word16(0x110);
            const { cpu, memoryBus } = setupWithRomData([
                Opcode.CALL_imm16,
                callAddress.low,
                callAddress.high,
                Opcode.NOP,
            ]);

            memoryBus.write(callAddress.value, Opcode.NOP);
            memoryBus.write(callAddress.value + 1, Opcode.RET);

            // CALL
            cpu.step();
            // NOP
            cpu.step();

            return { cpu, callAddress };
        }

        it('pops the CALL target address from the stack', () => {
            const { cpu } = setupAfterRet();
            const initialSp = cpu.registers.sp;

            cpu.step();

            expect(cpu.registers.sp).toBe(initialSp + 2);
        });

        it('sets PC to the address stored on the stack', () => {
            const { cpu } = setupAfterRet();

            cpu.step();

            expect(cpu.registers.pc).toBe(0x103);
        });
    });

    describe('when executing RETI', () => {
        function setupAfterReti() {
            // sets up a CALL to address 0x110, followed by a NOP
            const callAddress = new Word16(0x110);
            const { cpu, memoryBus } = setupWithRomData([
                Opcode.CALL_imm16,
                callAddress.low,
                callAddress.high,
                Opcode.NOP,
            ]);

            memoryBus.write(callAddress.value, Opcode.NOP);
            memoryBus.write(callAddress.value + 1, Opcode.RETI);

            // CALL
            cpu.step();
            // NOP
            cpu.step();

            return { cpu, callAddress };
        }

        it('enables interrupts', () => {
            const { cpu } = setupAfterReti();

            cpu.step();

            expect(cpu.areInterruptsEnabled).toBe(true);
        });

        it('pops the CALL target address from the stack', () => {
            const { cpu } = setupAfterReti();
            const initialSp = cpu.registers.sp;

            cpu.step();

            expect(cpu.registers.sp).toBe(initialSp + 2);
        });

        it('sets PC to the address stored on the stack', () => {
            const { cpu } = setupAfterReti();

            cpu.step();

            expect(cpu.registers.pc).toBe(0x103);
        });
    });

    describe('when executing RET cond', () => {
        describe.for(conditions)('ret %s', conditionInfo => {
            describe('when condition is met', () => {
                function setupForRetWithConditionWhenConditionMet() {
                    // sets up a CALL to address 0x110, followed by a NOP
                    const callAddress = new Word16(0x110);
                    const { cpu, memoryBus } = setupWithRomData([
                        Opcode.CALL_imm16,
                        callAddress.low,
                        callAddress.high,
                        Opcode.NOP,
                    ]);

                    const opcode = Opcode[`RET_${conditionInfo.name}`];

                    memoryBus.write(callAddress.value, Opcode.NOP);
                    memoryBus.write(callAddress.value + 1, opcode);

                    // CALL
                    cpu.step();
                    // NOP
                    cpu.step();

                    cpu.registers[conditionInfo.flag] = conditionInfo.trueValue;

                    return { cpu, callAddress };
                }

                it('pops the CALL target address from the stack', () => {
                    const { cpu } = setupForRetWithConditionWhenConditionMet();
                    const initialSp = cpu.registers.sp;

                    cpu.step();

                    expect(cpu.registers.sp).toBe(initialSp + 2);
                });

                it('sets PC to the address stored on the stack', () => {
                    const { cpu } = setupForRetWithConditionWhenConditionMet();

                    cpu.step();

                    expect(cpu.registers.pc).toBe(0x103);
                });
            });

            describe('when condition is not met', () => {
                function setupForRetWithConditionWhenConditionNotMet() {
                    // sets up a CALL to address 0x110, followed by a NOP
                    const callAddress = new Word16(0x110);
                    const { cpu, memoryBus } = setupWithRomData([
                        Opcode.CALL_imm16,
                        callAddress.low,
                        callAddress.high,
                        Opcode.NOP,
                    ]);

                    const opcode = Opcode[`RET_${conditionInfo.name}`];

                    memoryBus.write(callAddress.value, Opcode.NOP);
                    memoryBus.write(callAddress.value + 1, opcode);

                    // CALL
                    cpu.step();
                    // NOP
                    cpu.step();

                    cpu.registers[conditionInfo.flag] =
                        conditionInfo.trueValue ^ 1;

                    return { cpu, callAddress };
                }

                it('does not pop the CALL target address from the stack', () => {
                    const { cpu } =
                        setupForRetWithConditionWhenConditionNotMet();
                    const initialSp = cpu.registers.sp;

                    cpu.step();

                    expect(cpu.registers.sp).toBe(initialSp);
                });

                it('increments PC', () => {
                    const { cpu } =
                        setupForRetWithConditionWhenConditionNotMet();
                    const initialPc = cpu.registers.pc;

                    cpu.step();

                    expect(cpu.registers.pc).toBe(initialPc + 1);
                });
            });
        });
    });
});

describe('call cond, imm16', () => {
    describe.for(conditions)('call %s, imm16', conditionInfo => {
        const opcode = Opcode[`CALL_${conditionInfo.name}_imm16`];

        describe('when condition is met', () => {
            function setupAfterCallWhenConditionIsMet() {
                // sets up a CALL to address 0x110, followed by a NOP
                const callAddress = 0x110;
                const { cpu } = setupWithRomData([
                    opcode,
                    0x10,
                    0x1,
                    Opcode.NOP,
                ]);

                cpu.registers[conditionInfo.flag] = conditionInfo.trueValue;

                return { cpu, callAddress };
            }

            it('pushes the instruction address after CALL on the stack', () => {
                const { cpu } = setupAfterCallWhenConditionIsMet();
                const initialSp = cpu.registers.sp;

                cpu.step();

                expect(cpu.registers.sp).toBe(initialSp - 2);
                expect(readWordFromStack(cpu)).toBe(0x103);
            });

            it('sets PC to the correct CALL address', () => {
                const { cpu, callAddress } = setupAfterCallWhenConditionIsMet();

                cpu.step();

                expect(cpu.registers.pc).toBe(callAddress);
            });
        });

        describe('when condition is not met', () => {
            function setupAfterCallWhenConditionIsNotMet() {
                // sets up a CALL to address 0x110, followed by a NOP
                const callAddress = 0x110;
                const { cpu } = setupWithRomData([
                    opcode,
                    0x10,
                    0x1,
                    Opcode.NOP,
                ]);

                cpu.registers[conditionInfo.flag] = conditionInfo.trueValue ^ 1;

                return { cpu, callAddress };
            }

            it('does not push the instruction address after CALL on the stack', () => {
                const { cpu } = setupAfterCallWhenConditionIsNotMet();
                const initialSp = cpu.registers.sp;

                cpu.step();

                expect(cpu.registers.sp).toBe(initialSp);
            });

            it('does not set PC to the call address', () => {
                const { cpu } = setupAfterCallWhenConditionIsNotMet();

                cpu.step();

                expect(cpu.registers.pc).toBe(0x103);
            });
        });
    });
});

describe.for(rstOpcodes)('when executing RST %i', opcode => {
    function setupAfterCall(opcode: Opcode) {
        // sets up a CALL to address 0x110, followed by a NOP
        const callAddress = 0x110;
        const { cpu } = setupWithRomData([opcode, Opcode.NOP]);

        return { cpu, callAddress };
    }

    it('pushes the instruction address after RST on the stack', () => {
        const { cpu } = setupAfterCall(opcode);
        const initialSp = cpu.registers.sp;

        cpu.step();

        expect(cpu.registers.sp).toBe(initialSp - 2);
        expect(readWordFromStack(cpu)).toBe(0x101);
    });

    it('sets PC to the correct CALL address', () => {
        const { cpu } = setupAfterCall(opcode);

        cpu.step();

        expect(cpu.registers.pc).toBe(opcode & 0x38);
    });
});

describe('when executing JP imm16', () => {
    it('sets PC to the correct address', () => {
        const { cpu } = setupWithRomData([Opcode.JP_imm16, 0x34, 0x12]);

        cpu.step();

        expect(cpu.registers.pc).toBe(0x1234);
    });
});

describe('when executing JP cond, imm16', () => {
    describe.for(conditions)('JP %s, imm16', condition => {
        const opcode = Opcode[`JP_${condition.name}_imm16`];

        describe('when condition is met', () => {
            it('sets PC to the correct address', () => {
                const { cpu } = setupWithRomData([opcode, 0x34, 0x12]);
                cpu.registers[condition.flag] = condition.trueValue;

                cpu.step();

                expect(cpu.registers.pc).toBe(0x1234);
            });
        });

        describe('when condition is not met', () => {
            it('increments PC', () => {
                const { cpu } = setupWithRomData([opcode, 0x34, 0x12]);
                cpu.registers[condition.flag] = condition.trueValue ^ 1;

                cpu.step();

                expect(cpu.registers.pc).toBe(0x103);
            });
        });
    });
});

describe('when executing JP HL', () => {
    it('sets PC to the value in HL', () => {
        const { cpu } = setupWithRomData([Opcode.JP_HL]);
        cpu.registers.hl = 0x1234;

        cpu.step();

        expect(cpu.registers.pc).toBe(0x1234);
    });
});

describe.for(r16StackRegisters)('when executing PUSH %s', register => {
    const pushOpcode =
        Opcode.PUSH_BC + r16StackRegisters.indexOf(register) * 0x10;
    const popOpcode =
        Opcode.POP_BC + r16StackRegisters.indexOf(register) * 0x10;

    it('stores the value of %s on the stack', () => {
        const { cpu } = setupWithRomData([pushOpcode]);
        cpu.registers[register] = 0x1234;
        const initialSp = cpu.registers.sp;

        cpu.step();

        expect(cpu.registers.sp).toBe(initialSp - 2);
        expect(readWordFromStack(cpu)).toBe(0x1234);
    });

    describe('when executing POP %s', () => {
        it('pops the value from the stack', () => {
            const { cpu } = setupWithRomData([pushOpcode, popOpcode]);
            cpu.registers[register] = 0x1234;
            const initialSp = cpu.registers.sp;

            // PUSH
            cpu.step();

            // reset value
            cpu.registers[register] = 0x0000;

            // POP
            cpu.step();

            expect(cpu.registers.sp).toBe(initialSp);
            expect(cpu.registers[register]).toBe(0x1234);
        });
    });
});

describe('when executing LDH [imm16], A', () => {
    it('sets the value at the correct address to the value of A', () => {
        const { cpu } = setupWithRomData([Opcode.LDH_pa8_A, 0x12]);
        cpu.registers.a = 0x34;

        cpu.step();

        expect(cpu.memoryBus.read(0xff12)).toBe(0x34);
    });
});

describe('when executing LDH [C], A', () => {
    it('sets the value at 0xff00 + C to the value in A', () => {
        const { cpu } = setupWithRomData([Opcode.LDH_pC_A]);
        cpu.registers.c = 0x24;
        cpu.registers.a = 0x34;

        cpu.step();

        expect(cpu.memoryBus.read(0xff24)).toBe(0x34);
    });
});

describe('when executing LDH A, [imm16]', () => {
    it('sets A to the value at the correct address', () => {
        const { cpu } = setupWithRomData([Opcode.LDH_A_pa8, 0x12]);
        cpu.memoryBus.write(0xff12, 0x34);

        cpu.step();

        expect(cpu.registers.a).toBe(0x34);
    });
});

describe('when executing LDH A, [C]', () => {
    it('sets A to the value at 0xff00 + C', () => {
        const { cpu } = setupWithRomData([Opcode.LDH_A_pC]);
        cpu.registers.c = 0x24;
        cpu.memoryBus.write(0xff24, 0x34);

        cpu.step();

        expect(cpu.registers.a).toBe(0x34);
    });
});

describe('when executing LDH [imm16], A', () => {
    it('sets the value at the correct address to the value in A', () => {
        const { cpu } = setupWithRomData([Opcode.LD_p16_A, 0x34, 0x12]);
        cpu.registers.a = 0x56;

        cpu.step();

        expect(cpu.memoryBus.read(0x1234)).toBe(0x56);
    });
});

describe('when executing LDH A, [imm16]', () => {
    it('sets A to the value at the correct address', () => {
        const { cpu } = setupWithRomData([Opcode.LD_A_p16, 0x34, 0x12]);
        cpu.memoryBus.write(0x1234, 0x56);

        cpu.step();

        expect(cpu.registers.a).toBe(0x56);
    });
});

describe('when executing ADD SP, imm8', () => {
    it('adds the signed positive value imm8 to SP', () => {
        const { cpu } = setupWithRomData([Opcode.ADD_SP_imm8, 0x34]);
        cpu.registers.sp = 0x1200;

        cpu.step();

        expect(cpu.registers.sp).toBe(0x1234);
    });

    it('adds the signed negative value imm8 to SP', () => {
        const { cpu } = setupWithRomData([Opcode.ADD_SP_imm8, 0x84]);
        cpu.registers.sp = 0x1200; // 0x1200 + (-0x7c)

        cpu.step();

        expect(cpu.registers.sp).toBe(0x1184);
    });

    it('clears the zero flag', () => {
        const { cpu } = setupWithRomData([Opcode.ADD_SP_imm8, 0x0]);
        cpu.registers.sp = 0x0;
        cpu.registers.zeroFlag = 1;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtraction flag', () => {
        const { cpu } = setupWithRomData([Opcode.ADD_SP_imm8, 0x34]);
        cpu.registers.sp = 0x1200;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('sets both half carry and carry flag if there were both', () => {
        const { cpu } = setupWithRomData([Opcode.ADD_SP_imm8, 0xff]);
        cpu.registers.sp = 0x0001;

        cpu.step();

        expect(cpu.registers.sp).toBe(0x0);
        expect(cpu.registers.halfCarryFlag).toBe(1);
        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('sets the half carry flag if there was a half carry', () => {
        const { cpu } = setupWithRomData([Opcode.ADD_SP_imm8, 0x01]);
        cpu.registers.sp = 0x12ff;

        cpu.step();

        expect(cpu.registers.sp).toBe(0x1300);
        expect(cpu.registers.halfCarryFlag).toBe(1);
    });

    it('clears the half carry flag if there was no half carry', () => {
        const { cpu } = setupWithRomData([Opcode.ADD_SP_imm8, 0x00]);
        cpu.registers.sp = 0x12ff;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag if there was a carry', () => {
        const { cpu } = setupWithRomData([Opcode.ADD_SP_imm8, 0x01]);
        cpu.registers.sp = 0xffff;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag if there was no carry', () => {
        const { cpu } = setupWithRomData([Opcode.ADD_SP_imm8, 0x00]);
        cpu.registers.sp = 0xffff;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe('when executing LD HL, SP+imm8', () => {
    it('adds the signed positive value imm8 to SP and copies result to HL', () => {
        const { cpu } = setupWithRomData([Opcode.LD_HL_SP_imm8, 0x34]);
        cpu.registers.sp = 0x1200;

        cpu.step();

        expect(cpu.registers.sp).toBe(0x1200);
        expect(cpu.registers.hl).toBe(0x1234);
    });

    it('clears the zero flag', () => {
        const { cpu } = setupWithRomData([Opcode.LD_HL_SP_imm8, 0]);
        cpu.registers.sp = 0;
        cpu.registers.zeroFlag = 1;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('adds the signed negative value imm8 to SP and copies to HL', () => {
        const { cpu } = setupWithRomData([Opcode.LD_HL_SP_imm8, 0x84]);
        cpu.registers.sp = 0x1200; // 0x1200 + (-0x7c)

        cpu.step();

        expect(cpu.registers.sp).toBe(0x1200);
        expect(cpu.registers.hl).toBe(0x1184);
    });

    it('clears the subtraction flag', () => {
        const { cpu } = setupWithRomData([Opcode.LD_HL_SP_imm8, 0x34]);
        cpu.registers.sp = 0x1200;

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('sets the half carry flag if there was a half carry', () => {
        const { cpu } = setupWithRomData([Opcode.LD_HL_SP_imm8, 0x01]);
        cpu.registers.sp = 0x12ff;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(1);
    });

    it('clears the half carry flag if there was no half carry', () => {
        const { cpu } = setupWithRomData([Opcode.LD_HL_SP_imm8, 0x00]);
        cpu.registers.sp = 0x12ff;

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag if there was a carry', () => {
        const { cpu } = setupWithRomData([Opcode.LD_HL_SP_imm8, 0x01]);
        cpu.registers.sp = 0xffff;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag if there was no carry', () => {
        const { cpu } = setupWithRomData([Opcode.LD_HL_SP_imm8, 0x00]);
        cpu.registers.sp = 0xffff;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe('when executing LD SP, HL', () => {
    it('sets SP to the value of HL', () => {
        const { cpu } = setupWithRomData([Opcode.LD_SP_HL]);
        cpu.registers.hl = 0x1234;

        cpu.step();

        expect(cpu.registers.sp).toBe(0x1234);
    });
});

describe.for(r8Registers)('RLC %s', register => {
    const opcode = PrefixedOpcode.RLC_B + r8Registers.indexOf(register);

    it('rotates left', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b11010100);

        cpu.step();

        expect(cpu.getR8Value(register)).toBe(0b010101001);
    });

    it('sets the zero flag if result is 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000000);

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag if result is not 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtraction flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag if there is a carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000001);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag if there is no carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe.for(r8Registers)('RRC %s', register => {
    const opcode = PrefixedOpcode.RRC_B + r8Registers.indexOf(register);

    it('rotates right', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b11010100);

        cpu.step();

        expect(cpu.getR8Value(register)).toBe(0b01101010);
    });

    it('sets the zero flag if result is 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000000);

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag if result is not 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000000);

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtraction flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000000);

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag if there is a carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000001);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag if there is no carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000000);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe.for(r8Registers)('RL %s', register => {
    const opcode = PrefixedOpcode.RL_B + r8Registers.indexOf(register);

    it('rotates left including the carry 1', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b01010100);
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.getR8Value(register)).toBe(0b10101001);
    });

    it('rotates left including the carry 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b01010100);
        cpu.registers.carryFlag = 0;

        cpu.step();

        expect(cpu.getR8Value(register)).toBe(0b10101000);
    });

    it('sets the carry to 1 if bit 7 is 1', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b11010100);
        cpu.registers.carryFlag = 0;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('sets the carry to 0 if bit 7 is 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b01010100);
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });

    it('sets the zero flag if result is 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000000);
        cpu.registers.carryFlag = 0;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag if result is not 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);
        cpu.registers.carryFlag = 0;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtraction flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag if there is a carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000001);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag if there is no carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe.only.for(r8Registers)('RR %s', register => {
    const opcode = PrefixedOpcode.RR_B + r8Registers.indexOf(register);

    it('rotates right correctly', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0x47);
        cpu.registers.f = 0x00;

        cpu.step();

        expect(cpu.getR8Value(register)).toBe(0x23);
    });

    it('rotates right including the carry 1', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b01010100);
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.getR8Value(register)).toBe(0b10101010);
    });

    it('rotates right including the carry 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b01010100);
        cpu.registers.carryFlag = 0;

        cpu.step();

        expect(cpu.getR8Value(register)).toBe(0b00101010);
    });

    it('sets the carry to 1 if bit 0 is 1', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b01010101);
        cpu.registers.carryFlag = 0;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('sets the carry to 0 if bit 0 is 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b11010100);
        cpu.registers.carryFlag = 1;

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });

    it('sets the zero flag if result is 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000000);
        cpu.registers.carryFlag = 0;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag if result is not 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000000);
        cpu.registers.carryFlag = 0;

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtraction flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag if there is a carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000001);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag if there is no carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000000);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe.for(r8Registers)('SLA %s', register => {
    const opcode = PrefixedOpcode.SLA_B + r8Registers.indexOf(register);

    it('shifts left', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b11010100);

        cpu.step();

        expect(cpu.getR8Value(register)).toBe(0b10101000);
    });

    it('sets the zero flag if result is 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000000);

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag if result is not 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtraction flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag if there is a carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000001);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag if there is no carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe.for(r8Registers)('SRA %s', register => {
    const opcode = PrefixedOpcode.SRA_B + r8Registers.indexOf(register);

    it('shifts right and keeps bit 7 at 1', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b11010100);

        cpu.step();

        expect(cpu.getR8Value(register)).toBe(0b11101010);
    });

    it('shifts right and keeps bit 7 at 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b01010100);

        cpu.step();

        expect(cpu.getR8Value(register)).toBe(0b00101010);
    });

    it('sets the zero flag if result is 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000000);

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag if result is not 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000000);

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtraction flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag if there is a carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag if there is no carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000000);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe.for(r8Registers)('SWAP %s', register => {
    const opcode = PrefixedOpcode.SWAP_B + r8Registers.indexOf(register);

    it('swaps the upper and lower 4 bits', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00001111);

        cpu.step();

        expect(cpu.getR8Value(register)).toBe(0b11110000);
    });

    it('sets the zero flag if result is 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000000);

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag if result is not 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000000);

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtract flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000000);

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000000);

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('clears the carry flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000000);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe.for(r8Registers)('SRL %s', register => {
    const opcode = PrefixedOpcode.SRL_B + r8Registers.indexOf(register);

    it('shifts right and sets bit 7 to 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b11010100);

        cpu.step();

        expect(cpu.getR8Value(register)).toBe(0b01101010);
    });

    it('sets the zero flag if result is 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000000);

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(1);
    });

    it('clears the zero flag if result is not 0', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000000);

        cpu.step();

        expect(cpu.registers.zeroFlag).toBe(0);
    });

    it('clears the subtraction flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.subtractFlag).toBe(0);
    });

    it('clears the half carry flag', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.halfCarryFlag).toBe(0);
    });

    it('sets the carry flag if there is a carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b00000001);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(1);
    });

    it('clears the carry flag if there is no carry', () => {
        const { cpu } = setupWithRomData([Opcode.PREFIX_CB, opcode]);
        cpu.setR8Value(register, 0b10000000);

        cpu.step();

        expect(cpu.registers.carryFlag).toBe(0);
    });
});

describe('BIT u3, %s', () => {
    function setupBitTest(r8: Register8, bit: number, bitSet: boolean) {
        const opcode =
            PrefixedOpcode.BIT0_B + (bit << 3) + r8Registers.indexOf(r8);
        const romData = new Uint8Array([0xcb, opcode]);
        const cpu = setupWithRom(romData);

        const value = bitSet ? 1 << bit : ~(1 << bit);
        cpu.setR8Value(r8, value);

        cpu.step();

        return cpu;
    }

    for (let bit = 0; bit < 8; bit++) {
        for (const r8 of r8Registers) {
            describe(`BIT ${bit}, ${r8}`, () => {
                it(`sets zero flag if bit ${bit} of ${r8} is 0`, () => {
                    const cpu = setupBitTest(r8, bit, false);
                    expect(cpu.registers.zeroFlag).toBe(1);
                });

                it(`clears zero flag if bit ${bit} of ${r8} is 1`, () => {
                    const cpu = setupBitTest(r8, bit, true);
                    expect(cpu.registers.zeroFlag).toBe(0);
                });

                it(`always clears subtract flag when testing bit ${bit} of ${r8}`, () => {
                    const cpu = setupBitTest(r8, bit, true);
                    expect(cpu.registers.subtractFlag).toBe(0);
                });

                it(`always sets half-carry flag when testing bit ${bit} of ${r8}`, () => {
                    const cpu = setupBitTest(r8, bit, true);
                    expect(cpu.registers.halfCarryFlag).toBe(1);
                });
            });
        }
    }
});

describe('RES u3, %s', () => {
    const expectedResults = [
        0b11111110, 0b11111101, 0b11111011, 0b11110111, 0b11101111, 0b11011111,
        0b10111111, 0b01111111,
    ];

    function setupBitTest(r8: Register8, bit: number) {
        const opcode =
            PrefixedOpcode.RES0_B + (bit << 3) + r8Registers.indexOf(r8);
        const romData = new Uint8Array([0xcb, opcode]);
        const cpu = setupWithRom(romData);

        cpu.setR8Value(r8, 0b11111111);

        cpu.step();

        return cpu;
    }

    for (let bit = 0; bit < 8; bit++) {
        for (const r8 of r8Registers) {
            describe(`RES ${bit}, ${r8}`, () => {
                it(`sets bit ${bit} of ${r8} to 0`, () => {
                    const cpu = setupBitTest(r8, bit);
                    expect(cpu.getR8Value(r8)).toBe(expectedResults[bit]);
                });
            });
        }
    }
});

describe('SET u3, %s', () => {
    const expectedResults = [
        0b00000001, 0b00000010, 0b00000100, 0b00001000, 0b00010000, 0b00100000,
        0b01000000, 0b10000000,
    ];

    function setupBitTest(r8: Register8, bit: number) {
        const opcode =
            PrefixedOpcode.SET0_B + (bit << 3) + r8Registers.indexOf(r8);
        const romData = new Uint8Array([0xcb, opcode]);
        const cpu = setupWithRom(romData);

        cpu.setR8Value(r8, 0b00000000);

        cpu.step();

        return cpu;
    }

    for (let bit = 0; bit < 8; bit++) {
        for (const r8 of r8Registers) {
            describe(`SET ${bit}, ${r8}`, () => {
                it(`sets bit ${bit} of ${r8} to 1`, () => {
                    const cpu = setupBitTest(r8, bit);
                    expect(cpu.getR8Value(r8)).toBe(expectedResults[bit]);
                });
            });
        }
    }
});

describe('triggerInterrupt', () => {
    describe.for(interrupts)('when triggering interrupt %s', interrupt => {
        it('sets only the correct IE bit to 1', () => {
            const { cpu, interruptController } = setupWithRomData([]);

            interruptController.requestInterrupt(interrupt);

            expect(cpu.memoryBus.read(IE_REGISTER_ADDRESS)).toBe(
                1 << interrupt,
            );
        });

        it('sets only the correct IF bit to 1', () => {
            const { cpu, interruptController } = setupWithRomData([]);

            interruptController.requestInterrupt(interrupt);

            expect(cpu.memoryBus.read(IF_REGISTER_ADDRESS)).toBe(
                1 << interrupt,
            );
        });
    });

    it('leaves the other IE bits alone', () => {
        const { cpu, interruptController } = setupWithRomData([]);
        cpu.memoryBus.write(IE_REGISTER_ADDRESS, 0b01010101);

        interruptController.requestInterrupt(Interrupt.LCDStat);

        expect(cpu.memoryBus.read(IE_REGISTER_ADDRESS)).toBe(0b01010111);
    });

    it('leaves the other IF bits alone', () => {
        const { cpu, interruptController } = setupWithRomData([]);
        cpu.memoryBus.write(IF_REGISTER_ADDRESS, 0b01010101);

        interruptController.requestInterrupt(Interrupt.LCDStat);

        expect(cpu.memoryBus.read(IF_REGISTER_ADDRESS)).toBe(0b01010111);
    });
});

describe('after triggering an interrupt', () => {
    function setupWithInterruptTriggered(interrupt: Interrupt) {
        const { cpu, interruptController } = setupWithRomData([Opcode.NOP]);
        interruptController.requestInterrupt(interrupt);
        return cpu;
    }

    it('does not service interrupts when IME is false', () => {
        const cpu = setupWithInterruptTriggered(Interrupt.LCDStat);
        cpu.areInterruptsEnabled = false;

        cpu.step();

        expect(cpu.registers.pc).toBe(0x101);
    });

    describe('and IME is true', () => {
        function setupWithInterruptTriggeredAndImeTrue(interrupt: Interrupt) {
            const cpu = setupWithInterruptTriggered(interrupt);
            cpu.areInterruptsEnabled = true;
            return cpu;
        }

        for (const interrupt of interrupts) {
            it('disables IME', () => {
                const cpu = setupWithInterruptTriggeredAndImeTrue(interrupt);

                cpu.step();

                expect(cpu.areInterruptsEnabled).toBe(false);
            });

            it('pushes PC to the stack', () => {
                const cpu = setupWithInterruptTriggeredAndImeTrue(interrupt);

                cpu.step();

                expect(readWordFromStack(cpu)).toBe(0x100);
            });

            it('jumps to the correct handler', () => {
                const cpu = setupWithInterruptTriggeredAndImeTrue(interrupt);

                cpu.step();
                cpu.step();

                expect(cpu.registers.pc).toBe(interruptVectors[interrupt] + 1);
            });

            it('clears the corresponding bit from IF', () => {
                const cpu = setupWithInterruptTriggeredAndImeTrue(interrupt);

                cpu.step();

                const bitValue =
                    (cpu.memoryBus.read(IF_REGISTER_ADDRESS) >> interrupt) & 1;
                expect(bitValue).toBe(0);
            });
        }
    });
});

describe('when multiple interrupts are triggered', () => {
    it('handles one after another with the correct priority', () => {
        const { cpu, interruptController } = setupWithRomData([Opcode.NOP]);
        cpu.areInterruptsEnabled = true;

        // trigger interrupts and setup handlers that simply return
        for (const interrupt of interrupts) {
            const address = interruptVectors[interrupt];
            cpu.memoryBus.write(address, Opcode.NOP);
            cpu.memoryBus.write(address + 1, Opcode.RETI);
            interruptController.requestInterrupt(interrupt);
        }

        for (const interrupt of interrupts) {
            // step; should jump to the handler
            cpu.step();
            expect(cpu.registers.pc).toBe(interruptVectors[interrupt]);

            // step to return and enable IME
            cpu.step();
            cpu.step();
        }
    });
});

describe('HALT', () => {
    it('does not execute any instructions if halted', () => {
        const { cpu } = setupWithRomData([Opcode.HALT, Opcode.NOP, Opcode.NOP]);
        cpu.areInterruptsEnabled = true;

        cpu.step();
        cpu.step();
        cpu.step();

        expect(cpu.registers.pc).toBe(0x101);
    });

    describe('when IME flag is set', () => {
        it('enters low power mode', () => {
            const { cpu } = setupWithRomData([Opcode.HALT]);
            cpu.areInterruptsEnabled = true;

            cpu.step();

            expect(cpu.isHalted).toBe(true);
        });

        describe('and an interrupt is requested', () => {
            function setupWithTimerInterruptRequested() {
                const { cpu, interruptController } = setupWithRomData([
                    Opcode.HALT,
                    Opcode.NOP,
                    Opcode.NOP,
                ]);
                cpu.areInterruptsEnabled = true;

                cpu.step();
                interruptController.requestInterrupt(Interrupt.Timer);

                return cpu;
            }

            it('executes the interrupt handler', () => {
                const cpu = setupWithTimerInterruptRequested();

                cpu.step();

                expect(cpu.registers.pc).toBe(
                    interruptVectors[Interrupt.Timer],
                );
            });

            it('leaves low power mode when interrupt is about to be serviced', () => {
                const cpu = setupWithTimerInterruptRequested();

                cpu.step();

                expect(cpu.isHalted).toBe(false);
            });
        });
    });

    describe('when IME flag is not set', () => {
        describe('and no interrupts are pending', () => {
            it('enters low power mode', () => {
                const { cpu } = setupWithRomData([Opcode.HALT]);
                cpu.areInterruptsEnabled = false;

                cpu.step();

                expect(cpu.isHalted).toBe(true);
            });

            describe('and an interrupt becomes pending', () => {
                function setupWithTimerInterruptPending() {
                    const { cpu, interruptController } = setupWithRomData([
                        Opcode.HALT,
                        Opcode.NOP,
                        Opcode.NOP,
                    ]);
                    cpu.areInterruptsEnabled = false;

                    cpu.step();
                    interruptController.requestInterrupt(Interrupt.Timer);

                    return cpu;
                }

                it('leaves low power mode', () => {
                    const cpu = setupWithTimerInterruptPending();

                    cpu.step();

                    expect(cpu.isHalted).toBe(false);
                });

                it('does not execute the interrupt handler', () => {
                    const cpu = setupWithTimerInterruptPending();

                    cpu.step();

                    expect(cpu.registers.pc).toBe(0x102);
                });
            });
        });

        describe('and some interrupt is pending', () => {
            function setupWithTimerInterruptPending() {
                const { cpu, interruptController } = setupWithRomData([
                    Opcode.HALT,
                    Opcode.NOP,
                    Opcode.NOP,
                ]);
                cpu.areInterruptsEnabled = false;

                cpu.step();
                interruptController.requestInterrupt(Interrupt.Timer);

                return cpu;
            }

            it('reads the byte after HALT twice', () => {
                const cpu = setupWithTimerInterruptPending();

                cpu.step();

                // TODO how to test that?
            });
        });
    });
});
