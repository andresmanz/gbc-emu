const BANK_SIZE = 0x1000;

/**
 * This is a Game Boy Color (GBC) Work RAM (WRAM) implementation.
 * The GBC has 8 banks of WRAM, each with a size of 4KB (0x1000 bytes).
 * The first bank (bank 0) is used for the main WRAM, while the other banks are used for
 * additional memory when the GBC is in GBC mode.
 */
export class GcbWorkRam {
    private banks = Array.from({ length: 8 }, () => new Uint8Array(BANK_SIZE));

    read(address: number, bank: number): number {
        const bankIndex = address < BANK_SIZE ? 0 : bank;
        return this.banks[bankIndex][address];
    }

    write(address: number, bank: number, value: number): void {
        const bankIndex = address < BANK_SIZE ? 0 : bank;
        this.banks[bankIndex][address] = value;
    }
}
