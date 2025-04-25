import { MemoryFunctionMap } from './memoryFunctionMap';
import { Rom } from './rom';
import { Ram } from './ram';
import { MemoryBus } from './memoryBus';
import { Timer } from '../timer';

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

export const IF_REGISTER_ADDRESS = 0xff0f;
export const IE_REGISTER_ADDRESS = 0xffff;
export const DIV_ADDRESS = 0xff04;
export const TIMA_ADDRESS = 0xff05;
export const TMA_ADDRESS = 0xff06;
export const TAC_ADDRESS = 0xff07;
export const LCD_CONTROLS_ADDRESS = 0xff40;

/**
 * For now, this is a non-CGB memory bus implementation.
 */
export class GbMemoryBus implements MemoryBus {
    private rom: Rom | null = null;
    private videoRam = new Ram(new Uint8Array(0x2000)); // 8KB of VRAM
    private workRam = new Ram(new Uint8Array(0x2000)); // 8KB of WRAM
    private highRam = new Ram(new Uint8Array(0x7e)); // 127 bytes of High RAM
    private functionMap: MemoryFunctionMap = new MemoryFunctionMap();
    private ieValue = 0;
    private ifValue = 0;

    // placeholder memory
    private joypadInput = 0;
    private serial = new Ram(new Uint8Array(2));
    private audio = new Ram(new Uint8Array(0x16));
    private wavePattern = new Ram(new Uint8Array(0xf));
    private lcdData = new Ram(new Uint8Array(0xb));
    private disableBootRom = 0;

    constructor(private timer: Timer) {
        // initialize the memory bus with default mappings
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

        this.functionMap.map({
            start: DIV_ADDRESS,
            end: DIV_ADDRESS,
            read: () => this.timer.div,
            write: this.timer.resetDiv,
        });

        this.functionMap.mapSingleAddress({
            address: TIMA_ADDRESS,
            read: () => this.timer.tima,
            write: value => (this.timer.tima = value),
        });

        this.functionMap.mapSingleAddress({
            address: TMA_ADDRESS,
            read: () => this.timer.tma,
            write: value => (this.timer.tma = value),
        });

        this.functionMap.mapSingleAddress({
            address: TAC_ADDRESS,
            read: () => this.timer.tac,
            write: value => (this.timer.tac = value),
        });

        this.functionMap.mapSingleAddress({
            address: IE_REGISTER_ADDRESS,
            read: () => this.ieValue,
            write: value => (this.ieValue = value),
        });

        this.functionMap.mapSingleAddress({
            address: IF_REGISTER_ADDRESS,
            read: () => this.ifValue,
            write: value => (this.ifValue = value),
        });

        this.functionMap.map({
            start: memoryLayout.highRamStart,
            end: memoryLayout.highRamEnd,
            read: this.highRam.read,
            write: this.highRam.write,
        });

        // placeholders
        this.functionMap.mapSingleAddress({
            address: 0xff00,
            read: () => this.joypadInput,
            write: value => (this.joypadInput = value),
        });

        this.functionMap.map({
            start: 0xff01,
            end: 0xff02,
            read: this.serial.read,
            write: this.serial.write,
        });

        this.functionMap.map({
            start: 0xff10,
            end: 0xff26,
            read: this.audio.read,
            write: this.audio.write,
        });

        this.functionMap.map({
            start: 0xff30,
            end: 0xff3f,
            read: this.wavePattern.read,
            write: this.wavePattern.write,
        });

        this.functionMap.map({
            start: 0xff40,
            end: 0xff4b,
            read: this.lcdData.read,
            write: this.lcdData.write,
        });

        this.functionMap.mapSingleAddress({
            address: 0xff50,
            read: () => this.disableBootRom,
            write: value => (this.disableBootRom = value),
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
