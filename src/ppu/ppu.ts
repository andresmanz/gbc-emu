import { getBit, setBit } from '../byteUtil';
import { Ram } from '../memory/ram';
import { Oam } from './oam';

enum LcdControlBit {
    BgAndWindowEnable,
    ObjEnable,
    ObjSize,
    BgTileMap,
    BgAndWindowTileMap,
    WindowEnable,
    WindowTileMap,
    LcdPpuEnable,
}

enum LcdInterruptType {
    HBlank,
    VBlank,
    Oam,
    Lyc,
}

const lcdInterruptBitIndices = {
    [LcdInterruptType.HBlank]: 3,
    [LcdInterruptType.VBlank]: 4,
    [LcdInterruptType.Oam]: 5,
    [LcdInterruptType.Lyc]: 6,
};

enum LcdStatusBit {
    PpuModeBit0,
    PpuModeBit1,
    LycEqualsLy,
    Mode0Select,
    Mode1Select,
    Mode2Select,
    LycInterrupt,
}

export enum PpuMode {
    HBlank = 0,
    VBlank = 1,
    OamScan = 2,
    PixelTransfer = 3,
}

class LcdControl {
    public value = 0;

    public get isLcdAndPpuEnabled() {
        return getBit(this.value, LcdControlBit.LcdPpuEnable);
    }

    public set isLcdAndPpuEnabled(value: number) {
        setBit(this.value, LcdControlBit.LcdPpuEnable, value);
    }

    public get windowTileMap() {
        return getBit(this.value, LcdControlBit.WindowTileMap);
    }

    public set windowTileMap(value: number) {
        setBit(this.value, LcdControlBit.WindowTileMap, value);
    }

    public get isWindowEnabled() {
        return getBit(this.value, LcdControlBit.WindowEnable);
    }

    public set isWindowEnabled(value: number) {
        setBit(this.value, LcdControlBit.WindowEnable, value);
    }

    public get bgAndWindowTileMap() {
        return getBit(this.value, LcdControlBit.BgAndWindowTileMap);
    }

    public set bgAndWindowTileMap(value: number) {
        setBit(this.value, LcdControlBit.BgAndWindowTileMap, value);
    }

    public get bgTileMap() {
        return getBit(this.value, LcdControlBit.BgTileMap);
    }

    public set bgTileMap(value: number) {
        setBit(this.value, LcdControlBit.BgTileMap, value);
    }

    public get objSize() {
        return getBit(this.value, LcdControlBit.ObjSize);
    }

    public set objSize(value: number) {
        setBit(this.value, LcdControlBit.ObjSize, value);
    }

    public get isObjEnabled() {
        return getBit(this.value, LcdControlBit.ObjEnable);
    }

    public set isObjEnabled(value: number) {
        setBit(this.value, LcdControlBit.ObjEnable, value);
    }

    public get isBgAndWindowEnabled() {
        return getBit(this.value, LcdControlBit.BgAndWindowEnable);
    }

    public set isBgAndWindowEnabled(value: number) {
        setBit(this.value, LcdControlBit.BgAndWindowEnable, value);
    }
}

class LcdStatus {
    public value = 0;

    public get ppuMode() {
        return this.value & 0b11;
    }

    public set ppuMode(value: PpuMode) {
        this.value = (this.value & 0b11111100) | value;
    }

    public get lycEqualsLy() {
        return getBit(this.value, LcdStatusBit.LycEqualsLy);
    }

    public set lycEqualsLy(value: number) {
        this.value = setBit(this.value, LcdStatusBit.LycEqualsLy, value);
    }

    public isInterruptEnabled(interruptType: LcdInterruptType) {
        return getBit(this.value, lcdInterruptBitIndices[interruptType]) === 1;
    }
}

const OAM_SCAN_LINE_TICKS = 80;
const PIXEL_TRANSFER_LINE_TICKS = 172;
const TICKS_PER_LINE = 456;
const LINES_PER_FRAME = 154;
const RESOLUTION_HEIGHT = 144;
const RESOLUTION_WIDTH = 160;

export class Ppu {
    public readonly framebuffer = new Uint8ClampedArray(160 * 144 * 4);
    public readonly oam = new Oam();
    private lineTicks = 0;
    public readonly lcdControl = new LcdControl();
    public readonly stat = new LcdStatus();
    public _ly = 0;
    public lyc = 0;
    public scrollY = 0;
    public scrollX = 0;
    public bgPalette = 0xfc;
    public objPalette1 = 0xff;
    public objPalette2 = 0xff;

    onVBlank?: () => void;
    onStatInterrupt?: () => void;
    onFrameComplete?: (framebuffer: Uint8ClampedArray) => void;

    constructor(private videoRam: Ram) {
        this.reset();
    }

    tick(cycles: number) {
        if (!this.lcdControl.isLcdAndPpuEnabled) {
            return;
        }

        this.lineTicks += cycles;

        switch (this.stat.ppuMode) {
            case PpuMode.OamScan:
                this.tickOam();
                break;
            case PpuMode.PixelTransfer:
                this.tickTransfer();
                break;
            case PpuMode.HBlank:
                this.tickHBlank();
                break;
            case PpuMode.VBlank:
                this.tickVBlank();
                break;
        }
    }

    public get ly() {
        return this._ly;
    }

    private set ly(value: number) {
        this._ly = value;
        this.stat.lycEqualsLy = this.ly === this.lyc ? 1 : 0;

        if (this.stat.lycEqualsLy) {
            if (this.stat.isInterruptEnabled(LcdInterruptType.Lyc)) {
                this.onStatInterrupt?.();
            }
        }
    }

    private tickOam() {
        if (this.lineTicks >= OAM_SCAN_LINE_TICKS) {
            this.stat.ppuMode = PpuMode.PixelTransfer;
        }
    }

    private tickTransfer() {
        if (this.lineTicks >= OAM_SCAN_LINE_TICKS + PIXEL_TRANSFER_LINE_TICKS) {
            this.renderScanline();
            this.stat.ppuMode = PpuMode.HBlank;

            if (this.stat.isInterruptEnabled(LcdInterruptType.HBlank)) {
                this.onStatInterrupt?.();
            }
        }
    }

    private tickHBlank() {
        if (this.lineTicks >= TICKS_PER_LINE) {
            this.ly++;

            if (this.ly >= RESOLUTION_HEIGHT) {
                this.stat.ppuMode = PpuMode.VBlank;
                this.onVBlank?.();

                if (this.stat.isInterruptEnabled(LcdInterruptType.VBlank)) {
                    this.onStatInterrupt?.();
                }

                this.onFrameComplete?.(this.framebuffer);
            } else {
                this.stat.ppuMode = PpuMode.OamScan;
            }

            this.lineTicks = 0;
        }
    }

    private tickVBlank() {
        if (this.lineTicks >= TICKS_PER_LINE) {
            this.ly++;

            if (this.ly >= LINES_PER_FRAME) {
                this.ly = 0;
                this.stat.ppuMode = PpuMode.OamScan;
            }

            this.lineTicks = 0;
        }
    }

    private reset() {
        this.stat.ppuMode = PpuMode.OamScan;
        this.lineTicks = 0;
        this.framebuffer.fill(0);
    }

    public enableLcd() {
        this.reset();

        this.lcdControl.isLcdAndPpuEnabled = 1;
    }

    public disableLcd() {
        this.lcdControl.isLcdAndPpuEnabled = 0;
    }

    private renderScanline() {
        if (!this.lcdControl.isBgAndWindowEnabled) {
            return;
        }

        const bgTileMapAddr = this.lcdControl.bgTileMap ? 0x1c00 : 0x1800;
        const tileDataAddr = this.lcdControl.bgAndWindowTileMap
            ? 0x0000
            : 0x0800;

        for (let x = 0; x < RESOLUTION_WIDTH; x++) {
            const pixelX = (x + this.scrollX) & 0xff;
            const pixelY = (this.ly + this.scrollY) & 0xff;

            const tileCol = Math.floor(pixelX / 8);
            const tileRow = Math.floor(pixelY / 8);

            const tileMapIndex = tileRow * 32 + tileCol;
            const tileIndex = this.videoRam.read(bgTileMapAddr + tileMapIndex);

            let tileAddress;
            if (tileDataAddr === 0x0000) {
                tileAddress = tileDataAddr + tileIndex * 16;
            } else {
                // signed index for 0x8800 region
                const signedIndex = Int8Array.of(tileIndex)[0];
                tileAddress = 0x1000 + signedIndex * 16;
            }

            const tileY = pixelY % 8;
            const byte1 = this.videoRam.read(tileAddress + tileY * 2);
            const byte2 = this.videoRam.read(tileAddress + tileY * 2 + 1);

            const tileX = pixelX % 8;
            const bitIndex = 7 - tileX;
            const colorBit0 = (byte1 >> bitIndex) & 1;
            const colorBit1 = (byte2 >> bitIndex) & 1;
            const colorId = (colorBit1 << 1) | colorBit0;

            const color = (this.bgPalette >> (colorId * 2)) & 0x03;

            const index = (this.ly * 160 + x) * 4;

            let shade = 0;
            switch (color) {
                case 0:
                    shade = 255;
                    break;
                case 1:
                    shade = 170;
                    break;
                case 2:
                    shade = 85;
                    break;
                case 3:
                    shade = 0;
                    break;
            }

            this.framebuffer[index + 0] = shade; // r
            this.framebuffer[index + 1] = shade; // g
            this.framebuffer[index + 2] = shade; // b
            this.framebuffer[index + 3] = 255; // a
        }
    }
}
