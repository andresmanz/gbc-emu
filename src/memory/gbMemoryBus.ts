import { MemoryFunctionMap } from './memoryFunctionMap';
import { Ram } from './ram';
import { MemoryBus } from './memoryBus';
import { Timer } from '../timer';
import { Mbc } from './mbcs/mbc';
import { Ppu } from '../ppu/ppu';
import { Dma } from '../ppu/dma';

export const memoryLayout = {
    romStart: 0x0000,
    romEnd: 0x7fff,
    videoRamStart: 0x8000,
    videoRamEnd: 0x9fff,
    externalRamStart: 0xa000,
    externalRamEnd: 0xbfff,
    workRamStart: 0xc000,
    workRamEnd: 0xdfff,
    echoRamStart: 0xe000,
    echoRamEnd: 0xfdff,
    oamStart: 0xfe00,
    oamEnd: 0xfe9f,
    ioRegistersStart: 0xff00,
    ioRegistersEnd: 0xff7f,
    highRamStart: 0xff80,
    highRamEnd: 0xfffe,
    interruptEnableStart: 0xffff,
    interruptEnableEnd: 0xffff,
} as const;

export const SB_ADDRESS = 0xff01;
export const SC_ADDRESS = 0xff02;
export const IF_REGISTER_ADDRESS = 0xff0f;
export const IE_REGISTER_ADDRESS = 0xffff;
export const DIV_ADDRESS = 0xff04;
export const TIMA_ADDRESS = 0xff05;
export const TMA_ADDRESS = 0xff06;
export const TAC_ADDRESS = 0xff07;
export const LCD_CONTROL_ADDRESS = 0xff40;
export const STAT_ADDRESS = 0xff41;
export const SCY_ADDRESS = 0xff42;
export const SCX_ADDRESS = 0xff43;
export const LY_ADDRESS = 0xff44;
export const LYC_ADDRESS = 0xff45;
export const DMA_START_ADDRESS = 0xff46;
export const BG_PALETTE_ADDRESS = 0xff47;
export const OBJ_PALETTE_1_ADDRESS = 0xff48;
export const OBJ_PALETTE_2_ADDRESS = 0xff49;
export const WY_ADDRESS = 0xff4a;
export const WX_ADDRESS = 0xff4b;

/**
 * For now, this is a non-CGB memory bus implementation.
 */
export class GbMemoryBus implements MemoryBus {
    private mbc: Mbc | null = null;
    private workRam = new Ram(new Uint8Array(0x2000)); // 8KB of WRAM
    private highRam = new Ram(new Uint8Array(0x7f)); // 127 bytes of High RAM
    private functionMap: MemoryFunctionMap = new MemoryFunctionMap();
    private ieValue = 0;
    private ifValue = 0;
    public serialLog = '';

    // placeholder memory
    private joypadInput = 0;
    private ioFallback = new Ram(new Uint8Array(0xff));
    private unusedRam = new Ram(new Uint8Array(0x60));

    constructor(
        private timer: Timer,
        private ppu: Ppu,
        private videoRam: Ram,
        private dma: Dma,
    ) {
        // initialize the memory bus with default mappings
        this.functionMap.map({
            start: memoryLayout.romStart,
            end: memoryLayout.romEnd,
            read: (address: number) => {
                if (!this.mbc) {
                    throw new Error(`ROM not initialized`);
                }

                return this.mbc.readByte(address);
            },
            write: (address: number, value: number) => {
                if (!this.mbc) {
                    throw new Error(`ROM not initialized`);
                }

                this.mbc.writeByte(address, value);
            },
        });

        this.functionMap.map({
            start: memoryLayout.videoRamStart,
            end: memoryLayout.videoRamEnd,
            read: address => {
                return this.videoRam.read(address);
            },
            write: (address, value) => {
                this.videoRam.write(address, value);
            },
        });

        this.functionMap.map({
            start: memoryLayout.workRamStart,
            end: memoryLayout.workRamEnd,
            read: this.workRam.read,
            write: this.workRam.write,
        });

        this.functionMap.map({
            start: memoryLayout.echoRamStart,
            end: memoryLayout.echoRamEnd,
            read: this.workRam.read,
            write: this.workRam.write,
        });

        this.functionMap.map({
            start: memoryLayout.externalRamStart,
            end: memoryLayout.externalRamEnd,
            read: (address: number) => {
                if (!this.mbc) {
                    throw new Error(`ROM not initialized`);
                }

                return this.mbc.readByte(
                    // TODO improve address handling
                    memoryLayout.externalRamStart + address,
                );
            },
            write: (address: number, value: number) => {
                if (!this.mbc) {
                    throw new Error(`ROM not initialized`);
                }

                this.mbc.writeByte(
                    // TODO improve address handling
                    memoryLayout.externalRamStart + address,
                    value,
                );
            },
        });

        this.functionMap.map({
            start: memoryLayout.oamStart,
            end: memoryLayout.oamEnd,
            read: this.ppu.oam.read,
            write: (address, value) => {
                this.ppu.oam.write(address, value);
            },
        });

        this.functionMap.mapSingleAddress({
            address: DIV_ADDRESS,
            read: () => this.timer.div,
            write: () => this.timer.resetDiv(),
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

        this.functionMap.mapSingleAddress({
            address: LCD_CONTROL_ADDRESS,
            read: () => this.ppu.lcdControl.value,
            write: value => {
                this.ppu.lcdControl.value = value;
            },
        });

        this.functionMap.mapSingleAddress({
            address: STAT_ADDRESS,
            read: () => this.ppu.stat.value,
            write: value => {
                this.ppu.stat.value = value;
            },
        });

        this.functionMap.mapSingleAddress({
            address: SCY_ADDRESS,
            read: () => this.ppu.scrollY,
            write: value => {
                this.ppu.scrollY = value;
            },
        });

        this.functionMap.mapSingleAddress({
            address: SCX_ADDRESS,
            read: () => this.ppu.scrollX,
            write: value => {
                this.ppu.scrollX = value;
            },
        });

        this.functionMap.mapSingleAddress({
            address: LY_ADDRESS,
            read: () => this.ppu.ly,
            write: () => {},
        });

        this.functionMap.mapSingleAddress({
            address: LYC_ADDRESS,
            read: () => this.ppu.lyc,
            write: value => {
                this.ppu.lyc = value;
            },
        });

        this.functionMap.mapSingleAddress({
            address: DMA_START_ADDRESS,
            read: () => {
                return this.dma.value;
            },
            write: value => {
                this.dma.startTransfer(value);
            },
        });

        this.functionMap.mapSingleAddress({
            address: BG_PALETTE_ADDRESS,
            read: () => this.ppu.bgPalette,
            write: value => {
                this.ppu.bgPalette = value;
            },
        });

        this.functionMap.mapSingleAddress({
            address: OBJ_PALETTE_1_ADDRESS,
            read: () => this.ppu.objPalette0,
            write: value => {
                this.ppu.objPalette0 = value;
            },
        });

        this.functionMap.mapSingleAddress({
            address: OBJ_PALETTE_2_ADDRESS,
            read: () => this.ppu.objPalette1,
            write: value => {
                this.ppu.objPalette1 = value;
            },
        });

        this.functionMap.mapSingleAddress({
            address: SB_ADDRESS,
            read: () => 0,
            write: value => {
                this.serialLog += String.fromCharCode(value);
            },
        });

        this.functionMap.mapSingleAddress({
            address: SC_ADDRESS,
            read: () => 0,
            write: () => {
                //console.log('serial log: ' + this.serialLog);
            },
        });

        this.functionMap.mapSingleAddress({
            address: WY_ADDRESS,
            read: () => this.ppu.windowY,
            write: value => {
                this.ppu.windowY = value;
            },
        });

        this.functionMap.mapSingleAddress({
            address: WX_ADDRESS,
            read: () => this.ppu.windowX,
            write: value => {
                this.ppu.windowX = value;
            },
        });

        this.functionMap.map({
            start: memoryLayout.ioRegistersStart,
            end: memoryLayout.ioRegistersEnd,
            read: this.ioFallback.read,
            write: this.ioFallback.write,
        });

        this.functionMap.map({
            start: 0xfea0,
            end: 0xfeff,
            read: this.unusedRam.read,
            write: this.unusedRam.write,
        });
    }

    setRom(mbc: Mbc): void {
        this.mbc = mbc;
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
