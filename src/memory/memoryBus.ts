import { MemoryFunctionMap } from './memoryFunctionMap';
import { Rom } from './rom';
import { Ram } from './ram';

export const memoryLayout = {
    romStart: 0x0000,
    romEnd: 0x7fff,
    videoRamStart: 0x8000,
    videoRamEnd: 0x9fff,
    externalRamStart: 0xa000,
    externalRamEnd: 0xbfff,
    workRamStart: 0xc000,
    workRamEnd: 0xdfff,
    oamStart: 0xfe00,
    oamEnd: 0xfe9f,
    ioRegistersStart: 0xff00,
    ioRegistersEnd: 0xff7f,
    highRamStart: 0xff80,
    highRamEnd: 0xfffe,
    interruptEnableStart: 0xffff,
    interruptEnableEnd: 0xffff,
} as const;

/**
 * For now, this is a non-CGB memory bus implementation.
 */
export class MemoryBus {
    private rom: Rom | null = null;
    private videoRam: Ram = new Ram(new Uint8Array(0x2000)); // 8KB of VRAM
    private workRam: Ram = new Ram(new Uint8Array(0x2000)); // 8KB of WRAM
    private functionMap: MemoryFunctionMap = new MemoryFunctionMap();

    constructor() {
        // Initialize the memory bus with default mappings
        this.functionMap.map({
            start: memoryLayout.romStart,
            end: memoryLayout.romEnd,
            read: (address: number) => {
                if (!this.rom) {
                    throw new Error(`ROM not initialized`);
                }

                return this.rom.read(address);
            },
        });

        this.functionMap.map({
            start: memoryLayout.videoRamStart,
            end: memoryLayout.videoRamEnd,
            read: this.videoRam.read,
            write: this.videoRam.write,
        });

        this.functionMap.map({
            start: memoryLayout.workRamStart,
            end: memoryLayout.workRamEnd,
            read: this.workRam.read,
            write: this.workRam.write,
        });
    }

    setRom(rom: Rom): void {
        this.rom = rom;
    }

    read(address: number): number {
        const mapping = this.functionMap.findMapping(address);
        // read with local address
        return mapping.read(address - mapping.start);
    }

    write(address: number, value: number): void {
        const mapping = this.functionMap.findMapping(address);

        if (mapping.write) {
            // write with local address
            mapping.write(address - mapping.start, value);
        } else {
            throw new Error(
                `Write operation not supported at address ${address}`,
            );
        }
    }
}
