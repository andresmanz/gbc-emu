import { MemoryBus } from '../memory/memoryBus';
import { CpuRegisters } from './cpuRegisters';

export class Cpu {
    public memoryBus: MemoryBus;
    public registers = new CpuRegisters();

    constructor(memoryBus: MemoryBus) {
        this.memoryBus = memoryBus;
        this.reset();
    }

    reset() {
        this.registers.pc = 0x0100;
        this.registers.sp = 0xfffe;
    }

    step() {
        const opcode = this.readNextByte();
        console.log(
            `Executing opcode: ${opcode.toString(16).padStart(2, '0')}`,
        );
    }

    readNextByte() {
        return this.memoryBus.read(this.registers.pc++);
    }
}
