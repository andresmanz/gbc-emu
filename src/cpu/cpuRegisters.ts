export class CpuRegisters {
    private _a: number;
    private _f: number;
    private _b: number;
    private _c: number;
    private _d: number;
    private _e: number;
    private _h: number;
    private _l: number;
    private _pc: number;
    private _sp: number;

    constructor() {
        this._a = 0;
        this._f = 0;
        this._b = 0;
        this._c = 0;
        this._d = 0;
        this._e = 0;
        this._h = 0;
        this._l = 0;
        this._pc = 0;
        this._sp = 0;
    }

    get a() {
        return this._a;
    }

    set a(value: number) {
        this._a = value & 0xff;
    }

    get f() {
        return this._f;
    }

    set f(value: number) {
        this._f = value & 0xf0;
    }

    get b() {
        return this._b;
    }

    set b(value: number) {
        this._b = value & 0xff;
    }

    get c() {
        return this._c;
    }

    set c(value: number) {
        this._c = value & 0xff;
    }

    get d() {
        return this._d;
    }

    set d(value: number) {
        this._d = value & 0xff;
    }

    get e() {
        return this._e;
    }

    set e(value: number) {
        this._e = value & 0xff;
    }

    get h() {
        return this._h;
    }

    set h(value: number) {
        this._h = value & 0xff;
    }

    get l() {
        return this._l;
    }

    set l(value: number) {
        this._l = value & 0xff;
    }

    get pc() {
        return this._pc;
    }

    set pc(value: number) {
        this._pc = value & 0xffff;
    }

    get sp() {
        return this._sp;
    }

    set sp(value: number) {
        this._sp = value & 0xffff;
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

    private setFlagBit(bit: number, value: number) {
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
