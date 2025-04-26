import { Mbc } from './mbc';

enum BankingMode {
    rom = 0,
    ram = 1,
}

export class Mbc1 implements Mbc {
    private readonly rom: Uint8Array;
    private readonly ram: Uint8Array;

    private romBank = 1;
    private ramBank = 0;
    private ramEnabled = false;
    private bankingMode = BankingMode.rom;

    constructor(rom: Uint8Array) {
        this.rom = rom;
        this.ram = new Uint8Array(0x8000); // Typical size: 32 KB RAM max
    }

    readByte(addr: number) {
        if (addr < 0x4000) {
            // Bank 0 (fixed)
            return this.rom[addr];
        } else if (addr >= 0x4000 && addr < 0x8000) {
            // Switchable ROM bank
            const bankOffset = this.romBank * 0x4000;
            return this.rom[bankOffset + (addr - 0x4000)];
        } else if (addr >= 0xa000 && addr < 0xc000) {
            if (!this.ramEnabled) return 0xff;
            const ramOffset = this.getRamAddress(addr);
            return this.ram[ramOffset];
        }
        return 0xff;
    }

    writeByte(addr: number, value: number) {
        if (addr < 0x2000) {
            // RAM Enable
            this.ramEnabled = (value & 0x0f) === 0x0a;
        } else if (addr >= 0x2000 && addr < 0x4000) {
            // ROM Bank Number (lower 5 bits)
            this.romBank = (this.romBank & 0b11100000) | (value & 0b00011111);
            if ((this.romBank & 0b00011111) === 0) {
                this.romBank |= 0b00000001; // Bank 0 is forbidden for the switchable area
            }
        } else if (addr >= 0x4000 && addr < 0x6000) {
            // RAM Bank Number or Upper ROM Bank bits
            if (this.bankingMode === 0) {
                this.romBank =
                    (this.romBank & 0b00011111) | ((value & 0b11) << 5);
            } else {
                this.ramBank = value & 0b11;
            }
        } else if (addr >= 0x6000 && addr < 0x8000) {
            // Banking Mode Select
            this.bankingMode = value & 0x01;
        } else if (addr >= 0xa000 && addr < 0xc000) {
            if (!this.ramEnabled) return;
            const ramOffset = this.getRamAddress(addr);
            this.ram[ramOffset] = value;
        }
    }

    private getRamAddress(addr: number): number {
        const baseAddr = this.ramBank * 0x2000 + (addr - 0xa000);
        return baseAddr % this.ram.length; // Handle small RAM sizes
    }
}
