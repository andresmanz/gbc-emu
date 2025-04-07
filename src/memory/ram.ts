export class Ram {
    #bytes: Uint8Array;

    constructor(size: number) {
        this.#bytes = new Uint8Array(size);
    }

    read(address: number): number {
        if (address < 0 || address >= this.#bytes.length) {
            throw new Error('Invalid address');
        }

        return this.#bytes[address];
    }

    write(address: number, value: number): void {
        if (address < 0 || address >= this.#bytes.length) {
            throw new Error('Invalid address');
        }

        this.#bytes[address] = value;
    }
}
