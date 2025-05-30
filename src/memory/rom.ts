import { Memory } from './memory';

export class Rom implements Memory {
    private data: Uint8Array;

    constructor(data: Uint8Array) {
        this.data = data;
    }

    read(address: number): number {
        if (address < 0 || address >= this.data.length) {
            throw new Error(`Invalid read address ${address}`);
        }

        return this.data[address];
    }

    write(address: number, _value: number): void {
        throw new Error(`Cannot write to ROM at address ${address}`);
    }
}
