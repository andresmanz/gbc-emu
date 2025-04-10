import { MemoryBus } from '../memory/memoryBus';
import { CpuRegisters } from './cpuRegisters';

export const r8Registers = ['b', 'c', 'd', 'e', 'h', 'l', '[hl]', 'a'] as const;
export type R8Register = (typeof r8Registers)[number];

export class Cpu {
    public memoryBus: MemoryBus;
    public registers = new CpuRegisters();
    private opcodeTable = new Map<number, (cpu: Cpu) => void>();

    constructor(memoryBus: MemoryBus) {
        this.memoryBus = memoryBus;
        this.reset();
        this.opcodeTable = generateOpcodeTable();
    }

    reset() {
        this.registers.pc = 0x0100;
        this.registers.sp = 0xfffe;
    }

    step() {
        const opcode = this.readNextByte();
        const operation = this.opcodeTable.get(opcode);

        if (!operation) {
            throw new Error(`Unknown opcode: ${opcode.toString(16)}`);
        }

        operation(this);
    }

    readNextByte() {
        return this.memoryBus.read(this.registers.pc++);
    }

    getR8Value(reg: R8Register): number {
        if (reg === '[hl]') {
            return this.memoryBus.read(this.registers.hl);
        }

        return this.registers[reg];
    }

    setR8Value(reg: R8Register, value: number) {
        if (reg === '[hl]') {
            this.memoryBus.write(this.registers.hl, value);
        } else {
            this.registers[reg] = value;
        }
    }
}

function generateOpcodeTable() {
    const table = new Map<number, (cpu: Cpu) => void>();

    // NOP
    table.set(0x00, () => {});

    // generate ADD A, r8 handlers
    for (let i = 0; i < 8; i++) {
        const opcode = 0x80 + i;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(r8Registers[i]);
            const sum = cpu.registers.a + value;
            cpu.registers.a = sum & 0xff;

            // update flags
            cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag =
                (cpu.registers.a & 0xf) + (value & 0xf) > 0xf ? 1 : 0;
            cpu.registers.carryFlag = sum > 0xff ? 1 : 0;
        });
    }

    return table;
}
