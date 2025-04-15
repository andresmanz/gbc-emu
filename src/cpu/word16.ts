export class Word16 {
    private _value = 0;

    constructor(value = 0) {
        this.value = value;
    }

    get value(): number {
        return this._value & 0xffff;
    }

    set value(v: number) {
        this._value = v & 0xffff;
    }

    get high(): number {
        return (this._value >> 8) & 0xff;
    }

    set high(v: number) {
        this._value = ((v & 0xff) << 8) | (this._value & 0x00ff);
    }

    get low(): number {
        return this._value & 0xff;
    }

    set low(v: number) {
        this._value = (this._value & 0xff00) | (v & 0xff);
    }
}
