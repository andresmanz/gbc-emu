import { getBit, setBit } from '../byteUtil';
import { Word16 } from '../cpu/word16';
import { Ram } from '../memory/ram';
import { Oam, OamEntry } from './oam';

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
const TICKS_PER_LINE = 456;
const LINES_PER_FRAME = 154;
const RESOLUTION_HEIGHT = 144;
const RESOLUTION_WIDTH = 160;
const OBJECT_WIDTH = 8;

interface PixelFifoEntry {
    colorIndex: number;
    palette: number;
    bgPriority: number;
}

enum FetcherState {
    GetTile,
    GetTileDataLow,
    GetTileDataHigh,
    Sleep,
    Push,
}

class FetcherData {
    public tileAddress = 0;
    public tileData = new Word16();
    public lineX = 0;
    public currentFetchX = 0;
    public state = FetcherState.GetTile;
    public readonly bgPixelFifo = new Array<PixelFifoEntry>();
    public readonly objPixelFifo = new Array<PixelFifoEntry>();
    public pushedPixels = 0;
    public objectsOnScanline = new Array<OamEntry>();

    public reset() {
        this.tileAddress = 0;
        this.tileData.value = 0;
        this.lineX = 0;
        this.currentFetchX = 0;
        this.state = FetcherState.GetTile;
        this.bgPixelFifo.splice(0);
        this.objPixelFifo.splice(0);
        this.pushedPixels = 0;
        this.objectsOnScanline.splice(0);
    }
}

export class Ppu {
    public readonly framebuffer = new Uint8ClampedArray(
        RESOLUTION_WIDTH * RESOLUTION_HEIGHT * 4, // * 4 for RGBA
    );
    public readonly oam = new Oam();
    private lineTicks = 0;
    public readonly lcdControl = new LcdControl();
    public readonly stat = new LcdStatus();
    public _ly = 0;
    public lyc = 0;
    public scrollY = 0;
    public scrollX = 0;
    public windowY = 0;
    public windowX = 0;
    public bgPalette = 0xfc;
    public objPalette0 = 0xff;
    public objPalette1 = 0xff;
    private fetcherData = new FetcherData();

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
            this.fetcherData.reset();
            this.stat.ppuMode = PpuMode.PixelTransfer;
        }
    }

    private tickTransfer() {
        this.tickFetcher();

        if (this.fetcherData.pushedPixels >= RESOLUTION_WIDTH) {
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

    private tickFetcher() {
        // each of these actions take 2 dots...
        if (this.lineTicks % 2 === 1) {
            this.processPixelFetching();
        }

        // ... and push is executed on each dot
        this.pushPixelToFramebuffer();
    }

    private processPixelFetching() {
        if (this.fetcherData.state === FetcherState.GetTile) {
            this.updateObjectsOnScanline();
        }

        this.fetchObjectPixel();

        switch (this.fetcherData.state) {
            case FetcherState.GetTile:
                if (this.lcdControl.isBgAndWindowEnabled) {
                    this.getTile();
                }

                this.fetcherData.currentFetchX += 8;
                this.fetcherData.state = FetcherState.GetTileDataLow;

                break;
            case FetcherState.GetTileDataLow:
                this.fetcherData.tileData.low = this.videoRam.read(
                    this.fetcherData.tileAddress,
                );
                this.fetcherData.state = FetcherState.GetTileDataHigh;

                break;
            case FetcherState.GetTileDataHigh:
                this.fetcherData.tileData.high = this.videoRam.read(
                    this.fetcherData.tileAddress + 1,
                );
                this.fetcherData.state = FetcherState.Sleep;

                break;
            case FetcherState.Sleep:
                this.fetcherData.state = FetcherState.Push;

                break;
            case FetcherState.Push:
                if (this.pushPixelToFifo()) {
                    this.fetcherData.state = FetcherState.GetTile;
                }

                break;
        }
    }

    private fetchObjectPixel() {
        const x = this.fetcherData.currentFetchX;

        const objectsOnPosition = this.fetcherData.objectsOnScanline.filter(
            obj => x >= obj.x && x <= obj.x + OBJECT_WIDTH,
        );

        if (objectsOnPosition.length > 0) {
            for (const obj of objectsOnPosition) {
                const localTileAddress = obj.tileIndex * 2;
                const tileData = new Word16();
                tileData.low = this.videoRam.read(localTileAddress);
                tileData.high = this.videoRam.read(localTileAddress + 1);

                const pixelIndex = (x - obj.x) % OBJECT_WIDTH;
                const bitIndex = 7 - pixelIndex;
                const bit0 = (this.fetcherData.tileData.low >> bitIndex) & 1;
                const bit1 = (this.fetcherData.tileData.high >> bitIndex) & 1;
                const colorIndex = (bit1 << 1) | bit0;

                this.fetcherData.bgPixelFifo.push({
                    colorIndex,
                    palette: obj.dmgPalette,
                    bgPriority: obj.priority,
                });

                // TODO replace pixel in FIFO instead
                return;
            }
        } else if (this.fetcherData.objPixelFifo.length < 8) {
            // push transparent pixel with lowest priority until we have at least 8 pixels
            this.fetcherData.objPixelFifo.push({
                colorIndex: 0,
                bgPriority: 0,
                palette: 0,
            });
        }
    }

    private updateObjectsOnScanline() {
        const objHeight = this.lcdControl.objSize === 1 ? 16 : 8;
        let counter = 0;

        for (const obj of this.oam.entries) {
            if (obj.x === 0) {
                continue;
            }

            //if (this.ly >= obj.y - objHeight && this.ly <= obj.y) {
            if (obj.y <= this.ly + 16 && obj.y + objHeight > this.ly + 16) {
                this.fetcherData.objectsOnScanline.push(obj);
                ++counter;

                // TODO insert sorted by x position
            }

            // max of 10 objects per scanline
            if (counter >= 10) {
                return;
            }
        }
    }

    private getTile() {
        let tilemapAddress = 0x9800;

        // WX is the window X + 7
        /*
        const isXInsideWindow =
            this.fetcherData.currentFetchX >= this.windowX - 7;
        const isPixelInsideWindow = false;
        */
        const isXInsideWindow = false;
        const isPixelInsideWindow = false;

        if (
            (this.lcdControl.bgTileMap && !isXInsideWindow) ||
            (this.lcdControl.windowTileMap && isXInsideWindow)
        ) {
            tilemapAddress = 0x9c00;
        }

        // TODO "If the current tile is a window tile, the X coordinate for the window tile is used"
        const fetcherX = isPixelInsideWindow
            ? this.windowX
            : (Math.floor(this.scrollX / 8) +
                  this.fetcherData.currentFetchX / 8) &
              0x1f;

        // TODO "If the current tile is a window tile, the Y coordinate for the window tile is used"
        const fetcherY = isPixelInsideWindow
            ? this.windowY
            : (this.ly + this.scrollY) & 0xff;

        const tileCol = Math.floor(fetcherX);
        const tileRow = Math.floor(fetcherY / 8);

        const localTileIndex = tileRow * 32 + tileCol;
        const localTilemapAddress = tilemapAddress - 0x8000;

        const tileIndex = this.videoRam.read(
            localTilemapAddress + localTileIndex,
        );

        if (this.lcdControl.bgAndWindowTileMap === 1) {
            this.fetcherData.tileAddress = 0x8000 + tileIndex * 16;
        } else {
            //const signedIndex = (tileIndex << 24) >> 24;
            const signedIndex = Int8Array.of(tileIndex)[0];
            this.fetcherData.tileAddress = 0x9000 + signedIndex * 16;
        }

        // TODO clean up the local/global address mess
        this.fetcherData.tileAddress += 2 * (fetcherY % 8);
        this.fetcherData.tileAddress -= 0x8000;
    }

    private pushPixelToFifo() {
        if (this.fetcherData.bgPixelFifo.length > 8) {
            // fifo is full
            return false;
        }

        for (let i = 0; i < 8; ++i) {
            const bitIndex = 7 - i;
            const bit0 = (this.fetcherData.tileData.low >> bitIndex) & 1;
            const bit1 = (this.fetcherData.tileData.high >> bitIndex) & 1;
            const colorIndex = (bit1 << 1) | bit0;

            this.fetcherData.bgPixelFifo.push({
                colorIndex,
                palette: 0,
                bgPriority: 0,
            });
        }

        return true;
    }

    private pushPixelToFramebuffer() {
        if (this.fetcherData.bgPixelFifo.length > 8) {
            const bgPixelData = this.fetcherData.bgPixelFifo.shift();
            const objPixelData = this.fetcherData.objPixelFifo.shift();

            if (bgPixelData && this.fetcherData.lineX >= this.scrollX % 8) {
                let colorIndex = bgPixelData.colorIndex;
                let palette = this.bgPalette;
                const isObjPixelVisible =
                    objPixelData && objPixelData.colorIndex !== 0;

                if (isObjPixelVisible) {
                    colorIndex = objPixelData.colorIndex;
                    palette =
                        objPixelData.palette === 1
                            ? this.objPalette1
                            : this.objPalette0;
                }

                const color = (palette >> (colorIndex * 2)) & 0b11;

                this.setFramebufferPixel(
                    this.fetcherData.pushedPixels,
                    this.ly,
                    color,
                );

                ++this.fetcherData.pushedPixels;
            }

            ++this.fetcherData.lineX;
        }
    }

    private setFramebufferPixel(x: number, y: number, color: number) {
        const shades = [255, 170, 85, 0];
        const shade = shades[color];

        const fbPixelIndex = (y * RESOLUTION_WIDTH + x) * 4;

        this.framebuffer[fbPixelIndex + 0] = shade; // r
        this.framebuffer[fbPixelIndex + 1] = shade; // g
        this.framebuffer[fbPixelIndex + 2] = shade; // b
        this.framebuffer[fbPixelIndex + 3] = 255; // a
    }
}
