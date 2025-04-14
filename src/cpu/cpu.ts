import { MemoryBus } from '../memory/memoryBus';
import { CpuRegisters } from './cpuRegisters';
import { Opcode } from './opcodes';

export const r8Registers = ['b', 'c', 'd', 'e', 'h', 'l', '[hl]', 'a'] as const;
export type R8Register = (typeof r8Registers)[number];

export const r16Registers = ['bc', 'de', 'hl', 'sp'] as const;
export const conditions = ['NZ', 'Z', 'NC', 'C'] as const;

export class Cpu {
    public memoryBus: MemoryBus;
    public registers = new CpuRegisters();
    private opcodeTable = new Map<number, (cpu: Cpu) => void>();
    private ime = false;
    private enableImeAfter = 0;

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

        // check if we need to enable interrupts
        if (this.enableImeAfter > 0) {
            this.enableImeAfter--;

            if (this.enableImeAfter === 0) {
                this.ime = true;
            }
        }
    }

    readNextByte() {
        return this.memoryBus.read(this.registers.pc++);
    }

    readNextSignedByte() {
        const byte = this.readNextByte();
        return byte > 0x7f ? byte - 0x100 : byte;
    }

    readNextWord() {
        const lowByte = this.readNextByte();
        const highByte = this.readNextByte();
        return (highByte << 8) | lowByte;
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

    get areInterruptsEnabled() {
        return this.ime;
    }

    requestImeEnable() {
        this.enableImeAfter = 2;
    }

    disableIme() {
        this.ime = false;
        this.enableImeAfter = 0;
    }
}

function generateOpcodeTable() {
    const table = new Map<number, (cpu: Cpu) => void>();

    // NOP
    table.set(Opcode.NOP, () => {});

    // generate LD r16, imm16 handlers
    const r16Registers = ['bc', 'de', 'hl', 'sp'] as const;

    for (let i = 0; i < r16Registers.length; i++) {
        const opcode = Opcode.LD_BC_d16 + i * 0x10;
        table.set(opcode, cpu => {
            const value = cpu.readNextWord();
            cpu.registers[r16Registers[i]] = value;
        });
    }

    // add LD [r16mem], a handlers
    table.set(Opcode.LD_pBC_A, cpu =>
        cpu.memoryBus.write(cpu.registers.bc, cpu.registers.a),
    );

    table.set(Opcode.LD_pDE_A, cpu =>
        cpu.memoryBus.write(cpu.registers.de, cpu.registers.a),
    );

    table.set(Opcode.LD_pHLI_A, cpu => {
        cpu.memoryBus.write(cpu.registers.hl, cpu.registers.a);
        cpu.registers.hl++;
    });

    table.set(Opcode.LD_pHLD_A, cpu => {
        cpu.memoryBus.write(cpu.registers.hl, cpu.registers.a);
        cpu.registers.hl--;
    });

    // generate LD A, [r16mem] handlers
    table.set(Opcode.LD_A_pBC, cpu => {
        cpu.registers.a = cpu.memoryBus.read(cpu.registers.bc);
    });

    table.set(Opcode.LD_A_pDE, cpu => {
        cpu.registers.a = cpu.memoryBus.read(cpu.registers.de);
    });

    table.set(Opcode.LD_A_pHLI, cpu => {
        cpu.registers.a = cpu.memoryBus.read(cpu.registers.hl);
        cpu.registers.hl++;
    });

    table.set(Opcode.LD_A_pHLD, cpu => {
        cpu.registers.a = cpu.memoryBus.read(cpu.registers.hl);
        cpu.registers.hl--;
    });

    // handle LD [imm16], sp
    table.set(Opcode.LD_a16_SP, cpu => {
        const address = cpu.readNextWord();
        const sp = cpu.registers.sp;
        cpu.memoryBus.write(address, sp & 0xff);
        cpu.memoryBus.write(address + 1, (sp >> 8) & 0xff);
    });

    // generate INC r16 handlers
    for (let i = 0; i < r16Registers.length; i++) {
        const opcode = Opcode.INC_BC + i * 0x10;

        table.set(opcode, cpu => {
            cpu.registers[r16Registers[i]]++;
        });
    }

    // generate DEC r16 handlers
    for (let i = 0; i < r16Registers.length; i++) {
        const opcode = Opcode.DEC_BC + i * 0x10;

        table.set(opcode, cpu => {
            cpu.registers[r16Registers[i]]--;
        });
    }

    // generate ADD HL, r16 handlers
    for (let i = 0; i < r16Registers.length; i++) {
        const opcode = Opcode.ADD_HL_BC + i * 0x10;
        table.set(opcode, cpu => {
            const hl = cpu.registers.hl;
            const value = cpu.registers[r16Registers[i]];
            const sum = hl + value;
            cpu.registers.hl = sum & 0xffff;
            // update flags
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag =
                (hl & 0x0fff) + (value & 0x0fff) > 0x0fff ? 1 : 0;
            cpu.registers.carryFlag = sum > 0xffff ? 1 : 0;
        });
    }

    // generate INC r8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        const opcode = Opcode.INC_B + (i << 3);

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(r8Registers[i]);
            const incrementedValue = value + 1;
            cpu.setR8Value(r8Registers[i], incrementedValue);

            // update flags
            cpu.registers.zeroFlag = incrementedValue === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = (value & 0xf) + 1 > 0xf ? 1 : 0;
        });
    }

    // generate DEC r8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        const opcode = Opcode.DEC_B + (i << 3);

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(r8Registers[i]);
            const decrementedValue = value - 1;
            cpu.setR8Value(r8Registers[i], decrementedValue);

            // update flags
            cpu.registers.zeroFlag = decrementedValue === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 1;
            cpu.registers.halfCarryFlag = (value & 0xf) - 1 < 0 ? 1 : 0;
        });
    }

    // generate LD r8, imm8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        const opcode = Opcode.LD_B_d8 + (i << 3);

        table.set(opcode, cpu => {
            const value = cpu.readNextByte();
            cpu.setR8Value(r8Registers[i], value);
        });
    }

    // handle RLCA
    table.set(Opcode.RLCA, cpu => {
        const a = cpu.registers.a;
        const carry = (a & 0x80) >> 7;

        cpu.registers.a = ((a << 1) | carry) & 0xff;
        cpu.registers.zeroFlag = 0;
        cpu.registers.subtractFlag = 0;
        cpu.registers.halfCarryFlag = 0;
        cpu.registers.carryFlag = carry;
    });

    // handle RRCA
    table.set(Opcode.RRCA, cpu => {
        const a = cpu.registers.a;
        const carry = a & 0x01;

        cpu.registers.a = ((a >> 1) | (carry << 7)) & 0xff;
        cpu.registers.zeroFlag = 0;
        cpu.registers.subtractFlag = 0;
        cpu.registers.halfCarryFlag = 0;
        cpu.registers.carryFlag = carry;
    });

    // handle RLA
    table.set(Opcode.RLA, cpu => {
        const a = cpu.registers.a;
        const carry = cpu.registers.carryFlag;

        cpu.registers.carryFlag = (a & 0x80) >> 7;
        cpu.registers.a = ((a << 1) | carry) & 0xff;
        cpu.registers.zeroFlag = 0;
        cpu.registers.subtractFlag = 0;
        cpu.registers.halfCarryFlag = 0;
    });

    // handle RRA
    table.set(Opcode.RRA, cpu => {
        const a = cpu.registers.a;
        const carry = cpu.registers.carryFlag;

        cpu.registers.carryFlag = a & 0x01;
        cpu.registers.a = ((a >> 1) | (carry << 7)) & 0xff;
        cpu.registers.zeroFlag = 0;
        cpu.registers.subtractFlag = 0;
        cpu.registers.halfCarryFlag = 0;
    });

    // handle DAA - info: https://blog.ollien.com/posts/gb-daa/
    table.set(Opcode.DAA, cpu => {
        let a = cpu.registers.a;
        let carry = 0;

        if (cpu.registers.subtractFlag) {
            let adjustment = 0;

            if (cpu.registers.halfCarryFlag) {
                adjustment = 0x06;
            }

            if (cpu.registers.carryFlag) {
                adjustment |= 0x60;
            }

            a -= adjustment;
        } else {
            let adjustment = 0;

            if (cpu.registers.halfCarryFlag || (a & 0xf) > 0x09) {
                adjustment = 0x06;
            }

            if (cpu.registers.carryFlag || a > 0x99) {
                adjustment |= 0x60;
                carry = 1;
            }

            a += adjustment;
        }

        cpu.registers.a = a & 0xff;
        cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
        cpu.registers.halfCarryFlag = 0;
        cpu.registers.carryFlag = carry;
    });

    // handle CPL
    table.set(Opcode.CPL, cpu => {
        cpu.registers.a = ~cpu.registers.a & 0xff;
        cpu.registers.subtractFlag = 1;
        cpu.registers.halfCarryFlag = 1;
    });

    // handle SCF
    table.set(Opcode.SCF, cpu => {
        cpu.registers.subtractFlag = 0;
        cpu.registers.halfCarryFlag = 0;
        cpu.registers.carryFlag = 1;
    });

    // handle CCF
    table.set(Opcode.CCF, cpu => {
        cpu.registers.subtractFlag = 0;
        cpu.registers.halfCarryFlag = 0;
        cpu.registers.carryFlag = cpu.registers.carryFlag ? 0 : 1;
    });

    // handle JR imm8
    table.set(Opcode.JR_imm8, cpu => {
        const offset = cpu.readNextSignedByte();
        cpu.registers.pc += offset;
    });

    // generate JR cond, imm8 handlers
    const conditionChecks = {
        Z: (cpu: Cpu) => cpu.registers.zeroFlag === 1,
        NZ: (cpu: Cpu) => cpu.registers.zeroFlag === 0,
        C: (cpu: Cpu) => cpu.registers.carryFlag === 1,
        NC: (cpu: Cpu) => cpu.registers.carryFlag === 0,
    };

    for (const condition of conditions) {
        const opcode = Opcode[`JR_${condition}_imm8`];

        table.set(opcode, cpu => {
            const offset = cpu.readNextSignedByte();

            if (conditionChecks[condition](cpu)) {
                cpu.registers.pc += offset;
            }
        });
    }

    // generate LD r8, r8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        for (let j = 0; j < r8Registers.length; j++) {
            const opcode = Opcode.LD_B_B + (i << 3) + j;

            table.set(opcode, cpu => {
                const value = cpu.getR8Value(r8Registers[j]);
                cpu.setR8Value(r8Registers[i], value);
            });
        }
    }

    // generate ADD A, r8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        const opcode = Opcode.ADD_A_B + i;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(r8Registers[i]);
            const newHalfCarryFlag =
                (cpu.registers.a & 0xf) + (value & 0xf) > 0xf ? 1 : 0;
            const sum = cpu.registers.a + value;
            cpu.registers.a = sum & 0xff;

            // update flags
            cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = newHalfCarryFlag;
            cpu.registers.carryFlag = sum > 0xff ? 1 : 0;
        });
    }

    // generate ADC A, r8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        const opcode = Opcode.ADC_A_B + i;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(r8Registers[i]);
            const carry = cpu.registers.carryFlag;
            const newHalfCarryFlag =
                (cpu.registers.a & 0xf) + (value & 0xf) + carry > 0xf ? 1 : 0;
            const sum = cpu.registers.a + value + carry;
            cpu.registers.a = sum & 0xff;

            // update flags
            cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = newHalfCarryFlag;
            cpu.registers.carryFlag = sum > 0xff ? 1 : 0;
        });
    }

    // generate SUB A, r8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        const opcode = Opcode.SUB_A_B + i;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(r8Registers[i]);
            const newHalfCarryFlag =
                (cpu.registers.a & 0xf) - (value & 0xf) < 0 ? 1 : 0;
            const diff = cpu.registers.a - value;
            cpu.registers.a = diff & 0xff;

            // update flags
            cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 1;
            cpu.registers.halfCarryFlag = newHalfCarryFlag;
            cpu.registers.carryFlag = diff < 0 ? 1 : 0;
        });
    }

    // generate SUB A, r8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        const opcode = Opcode.SBC_A_B + i;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(r8Registers[i]);
            const carry = cpu.registers.carryFlag;
            const newHalfCarryFlag =
                (cpu.registers.a & 0xf) - (value & 0xf) - carry < 0 ? 1 : 0;
            const diff = cpu.registers.a - value - carry;
            cpu.registers.a = diff & 0xff;

            // update flags
            cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 1;
            cpu.registers.halfCarryFlag = newHalfCarryFlag;
            cpu.registers.carryFlag = diff < 0 ? 1 : 0;
        });
    }

    // generate AND A, r8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        const opcode = Opcode.AND_A_B + i;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(r8Registers[i]);
            cpu.registers.a &= value;

            // update flags
            cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = 1;
            cpu.registers.carryFlag = 0;
        });
    }

    // handle EI
    table.set(Opcode.EI, cpu => {
        cpu.requestImeEnable();
    });

    // handle DI
    table.set(Opcode.DI, cpu => {
        cpu.disableIme();
    });

    return table;
}
