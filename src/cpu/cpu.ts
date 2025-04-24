import {
    Interrupt,
    InterruptController,
    interruptVectors,
} from '../interrupts';
import { memoryLayout } from '../memory/gbMemoryBus';
import { MemoryBus } from '../memory/memoryBus';
import { CpuRegisters } from './cpuRegisters';
import {
    getCyclesFor,
    Opcode,
    PrefixedOpcode,
    prefixedOpcodeCycles,
    rstOpcodes,
} from './opcodes';
import { Word16 } from './word16';

export const r8Registers = ['b', 'c', 'd', 'e', 'h', 'l', '[hl]', 'a'] as const;
export type R8Register = (typeof r8Registers)[number];

export const r16Registers = ['bc', 'de', 'hl', 'sp'] as const;
export const r16StackRegisters = ['bc', 'de', 'hl', 'af'] as const;
export const conditions = ['NZ', 'Z', 'NC', 'C'] as const;

export class Cpu {
    public memoryBus: MemoryBus;
    public registers = new CpuRegisters();
    private opcodeTable = new Map<Opcode, (cpu: Cpu) => number>();
    private ime = false;
    private enableImeAfter = 0;

    constructor(
        memoryBus: MemoryBus,
        private interruptController: InterruptController,
    ) {
        this.memoryBus = memoryBus;
        this.reset();
        this.opcodeTable = generateOpcodeTable();
    }

    reset() {
        this.registers.pc = 0x0100;
        this.registers.sp = 0xfffe;
    }

    /**
     * Services the next pending interrupt or executes the next instruction if there are
     * no interrupts to serve. Returns the number of cycles it took.
     */
    step() {
        if (this.ime && this.interruptController.hasPendingInterrupts()) {
            this.serviceInterrupts();

            // servicing interrupt takes 20 T-cycles
            return 20;
        }

        const opcode = this.readNextByte();
        const operation = this.opcodeTable.get(opcode);

        if (!operation) {
            throw new Error(`Unknown opcode: ${opcode.toString(16)}`);
        }

        // execute operation and get number of cycles (T-states)
        const cycles = operation(this);

        // check if we need to enable interrupts
        if (this.enableImeAfter > 0) {
            this.enableImeAfter--;

            if (this.enableImeAfter === 0) {
                this.ime = true;
            }
        }

        return cycles;
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

    set areInterruptsEnabled(value: boolean) {
        this.ime = value;
        this.enableImeAfter = 0;
    }

    requestImeEnable() {
        this.enableImeAfter = 2;
    }

    private serviceInterrupts() {
        const pendingInterrupt = this.interruptController.getNextInterrupt();

        if (pendingInterrupt !== null) {
            this.serviceInterrupt(pendingInterrupt);
        }
    }

    private serviceInterrupt(interrupt: Interrupt) {
        // disable further interrupts
        this.ime = false;

        // push PC to stack and jump to handler address
        this.pushWordToStack(new Word16(this.registers.pc));
        this.registers.pc = interruptVectors[interrupt];

        this.interruptController.clearInterrupt(interrupt);
    }

    pushWordToStack(word: Word16) {
        this.memoryBus.write(--this.registers.sp, word.high);
        this.memoryBus.write(--this.registers.sp, word.low);
    }

    popWordFromStack() {
        const low = this.memoryBus.read(this.registers.sp++);
        const high = this.memoryBus.read(this.registers.sp++);
        return new Word16((high << 8) | low);
    }
}

function generateOpcodeTable() {
    const table = new Map<Opcode, (cpu: Cpu) => number>();
    const prefixedOpcodeTable = generatePrefixedOpcodeTable();

    // NOP
    table.set(Opcode.NOP, () => getCyclesFor(Opcode.NOP));

    // generate LD r16, imm16 handlers
    const r16Registers = ['bc', 'de', 'hl', 'sp'] as const;

    for (let i = 0; i < r16Registers.length; i++) {
        const opcode = Opcode.LD_BC_d16 + i * 0x10;
        table.set(opcode, cpu => {
            const value = cpu.readNextWord();
            cpu.registers[r16Registers[i]] = value;

            return getCyclesFor(opcode);
        });
    }

    // add LD [r16mem], a handlers
    table.set(Opcode.LD_pBC_A, cpu => {
        cpu.memoryBus.write(cpu.registers.bc, cpu.registers.a);
        return getCyclesFor(Opcode.LD_pBC_A);
    });

    table.set(Opcode.LD_pDE_A, cpu => {
        cpu.memoryBus.write(cpu.registers.de, cpu.registers.a);
        return getCyclesFor(Opcode.LD_pDE_A);
    });

    table.set(Opcode.LD_pHLI_A, cpu => {
        cpu.memoryBus.write(cpu.registers.hl, cpu.registers.a);
        cpu.registers.hl++;
        return getCyclesFor(Opcode.LD_pHLI_A);
    });

    table.set(Opcode.LD_pHLD_A, cpu => {
        cpu.memoryBus.write(cpu.registers.hl, cpu.registers.a);
        cpu.registers.hl--;
        return getCyclesFor(Opcode.LD_pHLD_A);
    });

    // generate LD A, [r16mem] handlers
    table.set(Opcode.LD_A_pBC, cpu => {
        cpu.registers.a = cpu.memoryBus.read(cpu.registers.bc);
        return getCyclesFor(Opcode.LD_A_pBC);
    });

    table.set(Opcode.LD_A_pDE, cpu => {
        cpu.registers.a = cpu.memoryBus.read(cpu.registers.de);
        return getCyclesFor(Opcode.LD_A_pDE);
    });

    table.set(Opcode.LD_A_pHLI, cpu => {
        cpu.registers.a = cpu.memoryBus.read(cpu.registers.hl);
        cpu.registers.hl++;

        return getCyclesFor(Opcode.LD_A_pHLI);
    });

    table.set(Opcode.LD_A_pHLD, cpu => {
        cpu.registers.a = cpu.memoryBus.read(cpu.registers.hl);
        cpu.registers.hl--;

        return getCyclesFor(Opcode.LD_A_pHLD);
    });

    // handle LD [imm16], sp
    table.set(Opcode.LD_imm16_SP, cpu => {
        const address = cpu.readNextWord();
        const sp = cpu.registers.sp;
        cpu.memoryBus.write(address, sp & 0xff);
        cpu.memoryBus.write(address + 1, (sp >> 8) & 0xff);

        return getCyclesFor(Opcode.LD_imm16_SP);
    });

    // generate INC r16 handlers
    for (let i = 0; i < r16Registers.length; i++) {
        const opcode = Opcode.INC_BC + i * 0x10;

        table.set(opcode, cpu => {
            cpu.registers[r16Registers[i]]++;

            return getCyclesFor(opcode);
        });
    }

    // generate DEC r16 handlers
    for (let i = 0; i < r16Registers.length; i++) {
        const opcode = Opcode.DEC_BC + i * 0x10;

        table.set(opcode, cpu => {
            cpu.registers[r16Registers[i]]--;

            return getCyclesFor(opcode);
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

            return getCyclesFor(opcode);
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

            return getCyclesFor(opcode);
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

            return getCyclesFor(opcode);
        });
    }

    // generate LD r8, imm8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        const opcode = Opcode.LD_B_d8 + (i << 3);

        table.set(opcode, cpu => {
            const value = cpu.readNextByte();
            cpu.setR8Value(r8Registers[i], value);

            return getCyclesFor(opcode);
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

        return getCyclesFor(Opcode.RLCA);
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

        return getCyclesFor(Opcode.RRCA);
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

        return getCyclesFor(Opcode.RLA);
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

        return getCyclesFor(Opcode.RRA);
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

        return getCyclesFor(Opcode.DAA);
    });

    // handle CPL
    table.set(Opcode.CPL, cpu => {
        cpu.registers.a = ~cpu.registers.a & 0xff;
        cpu.registers.subtractFlag = 1;
        cpu.registers.halfCarryFlag = 1;

        return getCyclesFor(Opcode.CPL);
    });

    // handle SCF
    table.set(Opcode.SCF, cpu => {
        cpu.registers.subtractFlag = 0;
        cpu.registers.halfCarryFlag = 0;
        cpu.registers.carryFlag = 1;

        return getCyclesFor(Opcode.SCF);
    });

    // handle CCF
    table.set(Opcode.CCF, cpu => {
        cpu.registers.subtractFlag = 0;
        cpu.registers.halfCarryFlag = 0;
        cpu.registers.carryFlag = cpu.registers.carryFlag ? 0 : 1;

        return getCyclesFor(Opcode.CCF);
    });

    // handle JR imm8
    table.set(Opcode.JR_imm8, cpu => {
        const offset = cpu.readNextSignedByte();
        cpu.registers.pc += offset;

        return getCyclesFor(Opcode.JR_imm8);
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

            // TODO specify branch
            return getCyclesFor(opcode);
        });
    }

    // generate LD r8, r8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        for (let j = 0; j < r8Registers.length; j++) {
            const opcode = Opcode.LD_B_B + (i << 3) + j;

            table.set(opcode, cpu => {
                const value = cpu.getR8Value(r8Registers[j]);
                cpu.setR8Value(r8Registers[i], value);

                return getCyclesFor(opcode);
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

            return getCyclesFor(opcode);
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

            return getCyclesFor(opcode);
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

            return getCyclesFor(opcode);
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

            return getCyclesFor(opcode);
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

            return getCyclesFor(opcode);
        });
    }

    // generate XOR A, r8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        const opcode = Opcode.XOR_A_B + i;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(r8Registers[i]);
            cpu.registers.a ^= value;

            // update flags
            cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = 0;
            cpu.registers.carryFlag = 0;

            return getCyclesFor(opcode);
        });
    }

    // generate OR A, r8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        const opcode = Opcode.OR_A_B + i;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(r8Registers[i]);
            cpu.registers.a |= value;

            // update flags
            cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = 0;
            cpu.registers.carryFlag = 0;

            return getCyclesFor(opcode);
        });
    }

    // generate CP A, r8 handlers
    for (let i = 0; i < r8Registers.length; i++) {
        const opcode = Opcode.CP_A_B + i;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(r8Registers[i]);
            const newHalfCarryFlag =
                (cpu.registers.a & 0xf) - (value & 0xf) < 0 ? 1 : 0;
            const diff = cpu.registers.a - value;

            // update flags
            cpu.registers.zeroFlag = diff === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 1;
            cpu.registers.halfCarryFlag = newHalfCarryFlag;
            cpu.registers.carryFlag = diff < 0 ? 1 : 0;

            return getCyclesFor(opcode);
        });
    }

    // handle ADD A, imm8
    table.set(Opcode.ADD_A_imm8, cpu => {
        const value = cpu.readNextByte();
        const newHalfCarryFlag =
            (cpu.registers.a & 0xf) + (value & 0xf) > 0xf ? 1 : 0;
        const sum = cpu.registers.a + value;
        cpu.registers.a = sum & 0xff;

        // update flags
        cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
        cpu.registers.subtractFlag = 0;
        cpu.registers.halfCarryFlag = newHalfCarryFlag;
        cpu.registers.carryFlag = sum > 0xff ? 1 : 0;

        return getCyclesFor(Opcode.ADD_A_imm8);
    });

    // handle ADC A, imm8
    table.set(Opcode.ADC_A_imm8, cpu => {
        const value = cpu.readNextByte();
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

        return getCyclesFor(Opcode.ADC_A_imm8);
    });

    // handle SUB A, imm8
    table.set(Opcode.SUB_A_imm8, cpu => {
        const value = cpu.readNextByte();
        const newHalfCarryFlag =
            (cpu.registers.a & 0xf) - (value & 0xf) < 0 ? 1 : 0;
        const diff = cpu.registers.a - value;
        cpu.registers.a = diff & 0xff;

        // update flags
        cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
        cpu.registers.subtractFlag = 1;
        cpu.registers.halfCarryFlag = newHalfCarryFlag;
        cpu.registers.carryFlag = diff < 0 ? 1 : 0;

        return getCyclesFor(Opcode.SUB_A_imm8);
    });

    // handle SBC A, imm8
    table.set(Opcode.SBC_A_imm8, cpu => {
        const value = cpu.readNextByte();
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

        return getCyclesFor(Opcode.SBC_A_imm8);
    });

    // handle AND A, imm8
    table.set(Opcode.AND_A_imm8, cpu => {
        const value = cpu.readNextByte();
        cpu.registers.a &= value;

        // update flags
        cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
        cpu.registers.subtractFlag = 0;
        cpu.registers.halfCarryFlag = 1;
        cpu.registers.carryFlag = 0;

        return getCyclesFor(Opcode.AND_A_imm8);
    });

    // handle XOR A, imm8
    table.set(Opcode.XOR_A_imm8, cpu => {
        const value = cpu.readNextByte();
        cpu.registers.a ^= value;

        // update flags
        cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
        cpu.registers.subtractFlag = 0;
        cpu.registers.halfCarryFlag = 0;
        cpu.registers.carryFlag = 0;

        return getCyclesFor(Opcode.XOR_A_imm8);
    });

    // handle OR A, imm8
    table.set(Opcode.OR_A_imm8, cpu => {
        const value = cpu.readNextByte();
        cpu.registers.a |= value;

        // update flags
        cpu.registers.zeroFlag = cpu.registers.a === 0 ? 1 : 0;
        cpu.registers.subtractFlag = 0;
        cpu.registers.halfCarryFlag = 0;
        cpu.registers.carryFlag = 0;

        return getCyclesFor(Opcode.OR_A_imm8);
    });

    // handle CP A, imm8
    table.set(Opcode.CP_A_imm8, cpu => {
        const value = cpu.readNextByte();
        const newHalfCarryFlag =
            (cpu.registers.a & 0xf) - (value & 0xf) < 0 ? 1 : 0;
        const diff = cpu.registers.a - value;

        // update flags
        cpu.registers.zeroFlag = diff === 0 ? 1 : 0;
        cpu.registers.subtractFlag = 1;
        cpu.registers.halfCarryFlag = newHalfCarryFlag;
        cpu.registers.carryFlag = diff < 0 ? 1 : 0;

        return getCyclesFor(Opcode.CP_A_imm8);
    });

    // handle CALL imm16
    table.set(Opcode.CALL_imm16, cpu => {
        const targetAddressLow = cpu.readNextByte();
        const targetAddressHigh = cpu.readNextByte();

        // store PC address on stack and jump to call address
        cpu.pushWordToStack(new Word16(cpu.registers.pc));
        cpu.registers.pc = (targetAddressHigh << 8) | targetAddressLow;

        return getCyclesFor(Opcode.CALL_imm16);
    });

    // handle CALL cond, imm16
    for (const condition of conditions) {
        const opcode = Opcode[`CALL_${condition}_imm16`];

        table.set(opcode, cpu => {
            const targetAddressLow = cpu.readNextByte();
            const targetAddressHigh = cpu.readNextByte();

            if (conditionChecks[condition](cpu)) {
                // store PC address on stack and jump to call address
                cpu.pushWordToStack(new Word16(cpu.registers.pc));
                cpu.registers.pc = (targetAddressHigh << 8) | targetAddressLow;
            }

            return getCyclesFor(opcode);
        });
    }

    // handle RET
    const executeReturn = (cpu: Cpu) => {
        cpu.registers.pc = cpu.popWordFromStack().value;
    };

    table.set(Opcode.RET, cpu => {
        executeReturn(cpu);
        return getCyclesFor(Opcode.RET);
    });

    // handle RETI
    table.set(Opcode.RETI, cpu => {
        executeReturn(cpu);
        cpu.areInterruptsEnabled = true;

        return getCyclesFor(Opcode.RETI);
    });

    // handle RET cond
    for (const condition of conditions) {
        const opcode = Opcode[`RET_${condition}`];

        table.set(opcode, cpu => {
            if (conditionChecks[condition](cpu)) {
                executeReturn(cpu);
                return getCyclesFor(opcode, 0);
            }

            return getCyclesFor(opcode, 1);
        });
    }

    // handle RST vec
    for (const opcode of rstOpcodes) {
        table.set(opcode, cpu => {
            cpu.pushWordToStack(new Word16(cpu.registers.pc));
            cpu.registers.pc = opcode & 0x38;

            return getCyclesFor(opcode);
        });
    }

    // handle JP imm16
    table.set(Opcode.JP_imm16, cpu => {
        const address = new Word16();
        address.low = cpu.readNextByte();
        address.high = cpu.readNextByte();
        cpu.registers.pc = address.value;

        return getCyclesFor(Opcode.JP_imm16);
    });

    // handle JP cond, imm16
    for (const condition of conditions) {
        const opcode = Opcode[`JP_${condition}_imm16`];

        table.set(opcode, cpu => {
            const address = new Word16();
            address.low = cpu.readNextByte();
            address.high = cpu.readNextByte();

            if (conditionChecks[condition](cpu)) {
                cpu.registers.pc = address.value;

                return getCyclesFor(opcode, 0);
            }

            return getCyclesFor(opcode, 1);
        });
    }

    // handle JP HL
    table.set(Opcode.JP_HL, cpu => {
        cpu.registers.pc = cpu.registers.hl;
        return getCyclesFor(Opcode.JP_HL);
    });

    // handle PUSH r16
    for (const register of r16StackRegisters) {
        // TODO refactor
        const regKey = register.toUpperCase() as 'BC' | 'DE' | 'HL' | 'AF';
        const opcode = Opcode[`PUSH_${regKey}`];

        table.set(opcode, cpu => {
            cpu.pushWordToStack(new Word16(cpu.registers[register]));
            return getCyclesFor(opcode);
        });
    }

    // handle POP r16
    for (const register of r16StackRegisters) {
        // TODO refactor
        const regKey = register.toUpperCase() as 'BC' | 'DE' | 'HL' | 'AF';
        const opcode = Opcode[`POP_${regKey}`];

        table.set(opcode, cpu => {
            cpu.registers[register] = cpu.popWordFromStack().value;
            return getCyclesFor(opcode);
        });
    }

    // handle LDH [imm16], A
    table.set(Opcode.LDH_pa8_A, cpu => {
        const offset = cpu.readNextByte();

        cpu.memoryBus.write(
            memoryLayout.ioRegistersStart + offset,
            cpu.registers.a,
        );

        return getCyclesFor(Opcode.LDH_pa8_A);
    });

    // handle LDH [C], A
    table.set(Opcode.LDH_pC_A, cpu => {
        const address = 0xff00 + cpu.registers.c;
        cpu.memoryBus.write(address, cpu.registers.a);

        return getCyclesFor(Opcode.LDH_pC_A);
    });

    // handle LDH A, [imm16]
    table.set(Opcode.LDH_A_pa8, cpu => {
        const offset = cpu.readNextByte();
        cpu.registers.a = cpu.memoryBus.read(
            memoryLayout.ioRegistersStart + offset,
        );

        return getCyclesFor(Opcode.LDH_A_pa8);
    });

    // handle LDH A, [C]
    table.set(Opcode.LDH_A_pC, cpu => {
        const address = 0xff00 + cpu.registers.c;
        cpu.registers.a = cpu.memoryBus.read(address);

        return getCyclesFor(Opcode.LDH_A_pC);
    });

    // handle LD [imm16], A
    table.set(Opcode.LD_p16_A, cpu => {
        const address = cpu.readNextWord();
        cpu.memoryBus.write(address, cpu.registers.a);

        return getCyclesFor(Opcode.LD_p16_A);
    });

    // handle LD A, [imm16]
    table.set(Opcode.LD_A_p16, cpu => {
        const address = cpu.readNextWord();
        cpu.registers.a = cpu.memoryBus.read(address);

        return getCyclesFor(Opcode.LD_A_p16);
    });

    // handle ADD SP, imm8
    const executeAddSpImm8 = (cpu: Cpu) => {
        const signedValue = (cpu.readNextByte() << 24) >> 24;
        const sum = cpu.registers.sp + signedValue;

        cpu.registers.halfCarryFlag =
            (cpu.registers.sp & 0xff) + signedValue > 0xff ? 1 : 0;
        cpu.registers.sp = sum & 0xffff;
        cpu.registers.carryFlag = sum > 0xffff ? 1 : 0;
        cpu.registers.zeroFlag = cpu.registers.sp === 0 ? 1 : 0;
        cpu.registers.subtractFlag = 0;
    };

    // handle ADD SP, imm8
    table.set(Opcode.ADD_SP_imm8, cpu => {
        executeAddSpImm8(cpu);
        return getCyclesFor(Opcode.ADD_SP_imm8);
    });

    // handle LD HL, SP+imm8
    table.set(Opcode.LD_HL_SP_imm8, cpu => {
        executeAddSpImm8(cpu);
        cpu.registers.hl = cpu.registers.sp;

        return getCyclesFor(Opcode.LD_HL_SP_imm8);
    });

    // handle LD SP, HL
    table.set(Opcode.LD_SP_HL, cpu => {
        cpu.registers.sp = cpu.registers.hl;

        return getCyclesFor(Opcode.LD_SP_HL);
    });

    // handle EI
    table.set(Opcode.EI, cpu => {
        cpu.requestImeEnable();

        return getCyclesFor(Opcode.EI);
    });

    // handle DI
    table.set(Opcode.DI, cpu => {
        cpu.areInterruptsEnabled = false;

        return getCyclesFor(Opcode.DI);
    });

    // handle prefixed instructions
    table.set(Opcode.PREFIX_CB, cpu => {
        const opcode = cpu.readNextByte();
        const operation = prefixedOpcodeTable.get(opcode);

        if (!operation) {
            throw new Error(`Unknown prefixed opcode: ${opcode.toString(16)}`);
        }

        return operation(cpu);
    });

    // TODO: handle HALT

    // TODO: handle STOP

    return table;
}

function generatePrefixedOpcodeTable() {
    const table = new Map<PrefixedOpcode, (cpu: Cpu) => number>();

    // handle RLC r8
    r8Registers.forEach((register, i) => {
        const opcode = (PrefixedOpcode.RLC_B + i) as PrefixedOpcode;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(register);
            const result = ((value << 1) | (value >> 7)) & 0xff;

            cpu.setR8Value(register, result);
            cpu.registers.zeroFlag = result === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = 0;
            cpu.registers.carryFlag = (value >> 7) & 1;

            return prefixedOpcodeCycles[opcode];
        });
    });

    // handle RRC r8
    r8Registers.forEach((register, i) => {
        const opcode = (PrefixedOpcode.RRC_B + i) as PrefixedOpcode;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(register);
            const result = ((value >> 1) | (value << 7)) & 0xff;

            cpu.setR8Value(register, result);
            cpu.registers.zeroFlag = result === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = 0;
            cpu.registers.carryFlag = value & 1;

            return prefixedOpcodeCycles[opcode];
        });
    });

    // handle RL r8
    r8Registers.forEach((register, i) => {
        const opcode = (PrefixedOpcode.RL_B + i) as PrefixedOpcode;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(register);
            const result =
                (((value << 1) | (value >> 7)) & 0xff) |
                cpu.registers.carryFlag;

            cpu.setR8Value(register, result);
            cpu.registers.zeroFlag = result === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = 0;
            cpu.registers.carryFlag = (value >> 7) & 1;

            return prefixedOpcodeCycles[opcode];
        });
    });

    // handle RR r8
    r8Registers.forEach((register, i) => {
        const opcode = (PrefixedOpcode.RR_B + i) as PrefixedOpcode;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(register);
            const result =
                (((value >> 1) | (value << 7)) & 0xff) |
                (cpu.registers.carryFlag << 7);

            cpu.setR8Value(register, result);
            cpu.registers.zeroFlag = result === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = 0;
            cpu.registers.carryFlag = value & 1;

            return prefixedOpcodeCycles[opcode];
        });
    });

    // handle SLA r8
    r8Registers.forEach((register, i) => {
        const opcode = (PrefixedOpcode.SLA_B + i) as PrefixedOpcode;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(register);
            const result = (value << 1) & 0xff;

            cpu.setR8Value(register, result);
            cpu.registers.zeroFlag = result === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = 0;
            cpu.registers.carryFlag = (value >> 7) & 1;

            return prefixedOpcodeCycles[opcode];
        });
    });

    // handle SRA r8
    r8Registers.forEach((register, i) => {
        const opcode = (PrefixedOpcode.SRA_B + i) as PrefixedOpcode;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(register);
            const result = ((value & 0b10000000) | (value >> 1)) & 0xff;

            cpu.setR8Value(register, result);
            cpu.registers.zeroFlag = result === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = 0;
            cpu.registers.carryFlag = value & 1;

            return prefixedOpcodeCycles[opcode];
        });
    });

    // handle SWAP r8
    r8Registers.forEach((register, i) => {
        const opcode = (PrefixedOpcode.SWAP_B + i) as PrefixedOpcode;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(register);
            const low = value & 0xf;
            const high = value >> 4;
            const result = ((low << 4) | high) & 0xff;

            cpu.setR8Value(register, result);
            cpu.registers.zeroFlag = result === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = 0;
            cpu.registers.carryFlag = 0;

            return prefixedOpcodeCycles[opcode];
        });
    });

    // handle SRL r8
    r8Registers.forEach((register, i) => {
        const opcode = (PrefixedOpcode.SRL_B + i) as PrefixedOpcode;

        table.set(opcode, cpu => {
            const value = cpu.getR8Value(register);
            const result = (value >> 1) & 0xff;

            cpu.setR8Value(register, result);
            cpu.registers.zeroFlag = result === 0 ? 1 : 0;
            cpu.registers.subtractFlag = 0;
            cpu.registers.halfCarryFlag = 0;
            cpu.registers.carryFlag = value & 1;

            return prefixedOpcodeCycles[opcode];
        });
    });

    // handle BIT u3, r8
    for (let bit = 0; bit < 8; ++bit) {
        r8Registers.forEach((register, i) => {
            const opcode = (PrefixedOpcode.BIT0_B +
                (bit << 3) +
                i) as PrefixedOpcode;

            table.set(opcode, cpu => {
                const value = cpu.getR8Value(register);
                const result = (value >> bit) & 1;

                cpu.registers.zeroFlag = result ^ 1;
                cpu.registers.subtractFlag = 0;
                cpu.registers.halfCarryFlag = 1;

                return prefixedOpcodeCycles[opcode];
            });
        });
    }

    // handle RES u3, r8
    for (let bit = 0; bit < 8; ++bit) {
        r8Registers.forEach((register, i) => {
            const opcode = (PrefixedOpcode.RES0_B +
                (bit << 3) +
                i) as PrefixedOpcode;

            table.set(opcode, cpu => {
                const value = cpu.getR8Value(register);
                const mask = ~(1 << bit);
                const result = value & mask & 0xff;
                cpu.setR8Value(register, result);

                return prefixedOpcodeCycles[opcode];
            });
        });
    }

    // handle SET u3, r8
    for (let bit = 0; bit < 8; ++bit) {
        r8Registers.forEach((register, i) => {
            const opcode = (PrefixedOpcode.SET0_B +
                (bit << 3) +
                i) as PrefixedOpcode;

            table.set(opcode, cpu => {
                const value = cpu.getR8Value(register);
                const mask = 1 << bit;
                const result = (value | mask) & 0xff;
                cpu.setR8Value(register, result);

                return prefixedOpcodeCycles[opcode];
            });
        });
    }

    // handle HALT

    return table;
}
