export class CpuRegisters {
    a: number;
    f: number;
    b: number;
    c: number;
    d: number;
    e: number;
    h: number;
    l: number;
    pc: number;
    sp: number;

    constructor() {
        this.a = 0;
        this.f = 0;
        this.b = 0;
        this.c = 0;
        this.d = 0;
        this.e = 0;
        this.h = 0;
        this.l = 0;
        this.pc = 0;
        this.sp = 0;
    }

    get af(): number {
        return (this.a << 8) | this.f;
    }

    set af(value: number) {
        this.a = (value >> 8) & 0xff;
        this.f = value & 0xff;
    }

    get bc(): number {
        return (this.b << 8) | this.c;
    }

    set bc(value: number) {
        this.b = (value >> 8) & 0xff;
        this.c = value & 0xff;
    }

    get de(): number {
        return (this.d << 8) | this.e;
    }

    set de(value: number) {
        this.d = (value >> 8) & 0xff;
        this.e = value & 0xff;
    }

    get hl(): number {
        return (this.h << 8) | this.l;
    }

    set hl(value: number) {
        this.h = (value >> 8) & 0xff;
        this.l = value & 0xff;
    }

    private getFlagBit(bit: number): number {
        return (this.f >> bit) & 1;
    }

    private setFlagBit(bit: number, value: number): void {
        if (value) {
            this.f |= 1 << bit;
        } else {
            this.f &= ~(1 << bit);
        }
    }

    get zeroFlag(): number {
        return this.getFlagBit(7);
    }

    set zeroFlag(value: number) {
        this.setFlagBit(7, value);
    }

    get subtractFlag(): number {
        return this.getFlagBit(6);
    }

    set subtractFlag(value: number) {
        this.setFlagBit(6, value);
    }

    get halfCarryFlag(): number {
        return this.getFlagBit(5);
    }

    set halfCarryFlag(value: number) {
        this.setFlagBit(5, value);
    }

    get carryFlag(): number {
        return this.getFlagBit(4);
    }

    set carryFlag(value: number) {
        this.setFlagBit(4, value);
    }

    incrementSp(): void {
        // Increment the stack pointer (SP) by 1. We need to ensure that
        // the stack pointer wraps around correctly, so we use bitwise AND
        // with 0xffff to keep it within the 16-bit range.
        this.sp = (this.sp + 1) & 0xffff;
    }

    decrementSp(): void {
        // Decrement the stack pointer (SP) by 1. We need to ensure that
        // the stack pointer wraps around correctly, so we use bitwise AND
        // with 0xffff to keep it within the 16-bit range.
        this.sp = (this.sp - 1) & 0xffff;
    }
}
