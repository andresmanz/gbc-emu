import { getBit, setBit } from '../byteUtil';
import { Ram } from '../memory/ram';

enum LcdControlBit {
    BgAndWindowEnable,
    ObjEnable,
    ObjSize,
    BgTileMap,
    BgAndWindowTiles,
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
        return getBit(this.value, lcdInterruptBitIndices[interruptType]);
    }

    public setInterruptEnabled(interruptType: LcdInterruptType) {
        this.value = setBit(
            this.value,
            LcdStatusBit.LycInterrupt,
            lcdInterruptBitIndices[interruptType],
        );
    }
}

const OAM_SCAN_LINE_TICKS = 80;
const PIXEL_TRANSFER_LINE_TICKS = 172;
const TICKS_PER_LINE = 456;
const LINES_PER_FRAME = 154;
const RESOLUTION_HEIGHT = 144;

export class Ppu {
    public readonly framebuffer = new Uint8ClampedArray(160 * 144 * 4);
    private lineTicks = 0;
    public lcdc = 0;
    public stat = new LcdStatus();
    public _ly = 0;
    public lyc = 0;
    public scrollY = 0;
    public scrollX = 0;
    public palette = 0;

    onVBlank?: () => void;
    onStatInterrupt?: () => void;
    onFrameComplete?: (framebuffer: Uint8ClampedArray) => void;

    constructor(private videoRam: Ram) {
        this.reset();
    }

    tick(cycles: number) {
        if (!this.isLcdEnabled) {
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

        if (this.stat.isInterruptEnabled(LcdInterruptType.Lyc)) {
            this.onStatInterrupt?.();
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

    private get isLcdEnabled() {
        return (this.lcdc & (1 << LcdControlBit.LcdPpuEnable)) !== 0;
    }

    public enableLcd() {
        this.reset();

        const mask = 1 << LcdControlBit.LcdPpuEnable;
        this.lcdc |= mask;
    }

    public disableLcd() {
        const mask = ~(1 << LcdControlBit.LcdPpuEnable);
        this.lcdc &= mask;
    }

    private renderScanline() {
        const bgEnabled = (this.lcdc & 0x01) !== 0;

        if (!bgEnabled) {
            return;
        }

        const bgTileMapAddr = this.lcdc & 0x08 ? 0x1c00 : 0x1800;
        const tileDataAddr = this.lcdc & 0x10 ? 0x0000 : 0x0800;

        for (let x = 0; x < 160; x++) {
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

            const color = (this.palette >> (colorId * 2)) & 0x03;

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
