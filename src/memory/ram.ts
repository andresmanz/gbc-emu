import { Memory } from './memory';

export class Ram implements Memory {
    constructor(private data: Uint8Array) {}

    read = (address: number) => {
        if (address < 0 || address >= this.data.length) {
            throw new Error(`Invalid read address ${address}`);
        }

        return this.data[address];
    };

    write = (address: number, value: number) => {
        if (address < 0 || address >= this.data.length) {
            throw new Error(`Invalid write address ${address}`);
        }

        this.data[address] = value;
    };
}
