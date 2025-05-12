import { getBit } from '../byteUtil';
import { Memory } from '../memory/memory';

const byteIndices = ['y', 'x', 'tileIndex', 'flags'] as const;

const BIT_INDEX_PRIORITY = 7;
const BIT_INDEX_Y_FLIP = 6;
const BIT_INDEX_X_FLIP = 5;
const BIT_INDEX_DMG_PALETTE = 4;
const BIT_INDEX_BANK = 3;

export class OamEntry {
    public y = 0;
    public x = 0;
    public tileIndex = 0;
    public flags = 0;

    public get priority() {
        return getBit(this.flags, BIT_INDEX_PRIORITY);
    }

    public get yFlip() {
        return getBit(this.flags, BIT_INDEX_Y_FLIP);
    }

    public get xFlip() {
        return getBit(this.flags, BIT_INDEX_X_FLIP);
    }

    public get dmgPalette() {
        return getBit(this.flags, BIT_INDEX_DMG_PALETTE);
    }

    public get bank() {
        return getBit(this.flags, BIT_INDEX_BANK);
    }

    public get cgbPalette() {
        return this.flags & 0b111;
    }
}

export class Oam implements Memory {
    public readonly entries = Array.from({ length: 40 }, () => new OamEntry());

    read = (address: number) => {
        const { entryIndex, propertyName } =
            Oam.mapAddressToEntryIndexAndPropertyName(address);
        return this.entries[entryIndex][propertyName];
    };

    write = (address: number, value: number) => {
        const { entryIndex, propertyName } =
            Oam.mapAddressToEntryIndexAndPropertyName(address);
        this.entries[entryIndex][propertyName] = value;
    };

    private static mapAddressToEntryIndexAndPropertyName(address: number) {
        return {
            entryIndex: Math.floor(address / 4),
            // basically map a byte index to the object's property
            propertyName: byteIndices[address % 4],
        };
    }
}
