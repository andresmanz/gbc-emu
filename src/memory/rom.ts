export class Rom {
    #bytes: Uint8Array;

    constructor(size: number, bytes: Uint8Array) {
        if (size > bytes.length) {
            throw new Error('Size mismatch');
        }

        this.#bytes = bytes;
    }

    read(address: number): number {
        if (address < 0 || address >= this.#bytes.length) {
            throw new Error('Invalid address');
        }

        return this.#bytes[address];
    }
}
