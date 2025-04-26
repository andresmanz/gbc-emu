import { Mbc } from './memory/mbcs/mbc';
import { Mbc1 } from './memory/mbcs/mbc1';

export class Cartridge {
    rom: Uint8Array;
    mbc: Mbc;

    constructor(romData: Uint8Array) {
        this.rom = romData;
        const cartridgeType = this.rom[0x0147];

        switch (cartridgeType) {
            case 0x00:
                // 0x00 = ROM ONLY (no banking)
                this.mbc = new Mbc1(this.rom); // Could use a simple ROMOnly class
                break;
            case 0x01:
            case 0x02:
            case 0x03:
                // 0x01 = MBC1
                // 0x02 = MBC1 + RAM
                // 0x03 = MBC1 + RAM + Battery
                this.mbc = new Mbc1(this.rom);
                break;
            default:
                throw new Error(
                    `Unsupported cartridge type: 0x${cartridgeType.toString(16)}`,
                );
        }
    }
}
