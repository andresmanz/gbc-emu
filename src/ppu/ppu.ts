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

enum ObjectSizeMode {
    Small = 0,
    Large = 1,
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

    public get objSizeMode() {
        return getBit(this.value, LcdControlBit.ObjSize);
    }

    public set objSizeMode(value: number) {
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
const FULL_OBJECT_HEIGHT = 16;

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
    public mapX = 0;
    public currentFetchX = 0;
    public objectFetchX = 0;
    public state = FetcherState.GetTile;
    public readonly bgPixelFifo = new Array<PixelFifoEntry>();
    public readonly objPixelFifo = new Array<PixelFifoEntry>();
    public pushedPixels = 0;
    public objectsOnScanline = new Array<OamEntry>();

    public reset() {
        this.tileAddress = 0;
        this.tileData.value = 0;
        this.lineX = 0;
        this.mapX = 0;
        this.currentFetchX = 0;
        this.objectFetchX = 0;
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
                this.tickOamScan();
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

    private tickOamScan() {
        if (this.lineTicks >= OAM_SCAN_LINE_TICKS) {
            this.fetcherData.reset();
            this.updateObjectsOnScanline();
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
        this.fetcherData.mapX = this.fetcherData.currentFetchX + this.scrollX;

        // each of these actions take 2 dots...
        if (this.lineTicks % 2 === 1) {
            this.processPixelFetching();
        }

        // ... and fetch object pixel and push on each dot
        this.fetchObjectPixel(this.fetcherData.objectFetchX);
        this.pushPixelToFramebuffer();

        ++this.fetcherData.objectFetchX;
    }

    private processPixelFetching() {
        switch (this.fetcherData.state) {
            case FetcherState.GetTile:
                // TODO this is where scroll should be read

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

    private fetchObjectPixel(x: number) {
        const objHeight =
            this.lcdControl.objSizeMode === ObjectSizeMode.Large ? 16 : 8;

        const objectsOnPosition = this.fetcherData.objectsOnScanline.filter(
            obj => {
                const objX = obj.x - OBJECT_WIDTH + (this.scrollX % 8);
                return x >= objX && x < objX + OBJECT_WIDTH;
            },
        );

        let renderedObject: OamEntry | null = null;

        if (objectsOnPosition.length > 0) {
            for (const obj of objectsOnPosition) {
                const objX = obj.x - OBJECT_WIDTH + (this.scrollX % 8);
                let localY = this.ly + FULL_OBJECT_HEIGHT - obj.y;
                let localX = (x - objX) % OBJECT_WIDTH;

                if (obj.yFlip) {
                    localY = objHeight - localY - 1;
                }

                let relativeTileIndex = obj.tileIndex;

                if (this.lcdControl.objSizeMode === ObjectSizeMode.Large) {
                    const isInTopTile = localY < 8;

                    // TODO is this necessary or can we just add 1 if it's the bottom tile?
                    if (isInTopTile) {
                        relativeTileIndex = obj.tileIndex & 0xfe;
                    } else {
                        localY -= 8;
                        relativeTileIndex = obj.tileIndex | 0x01;
                    }
                }

                if (obj.xFlip) {
                    localX = 8 - localX - 1;
                }

                const xOffset = localX;
                const yOffset = localY * 2; // 2 bytes per row

                const localTileAddress = relativeTileIndex * 16 + yOffset;

                const tileData = new Word16();
                tileData.low = this.videoRam.read(localTileAddress);
                tileData.high = this.videoRam.read(localTileAddress + 1);

                const bitIndex = 7 - xOffset;
                const bit0 = (tileData.low >> bitIndex) & 1;
                const bit1 = (tileData.high >> bitIndex) & 1;
                const colorIndex = (bit1 << 1) | bit0;

                const newPixelData = {
                    colorIndex,
                    palette: obj.dmgPalette,
                    bgPriority: obj.priority,
                };

                if (!renderedObject) {
                    this.fetcherData.objPixelFifo.push(newPixelData);
                    renderedObject = obj;
                } else {
                    if (obj.x < renderedObject.x) {
                        this.fetcherData.objPixelFifo[
                            this.fetcherData.objPixelFifo.length - 1
                        ] = newPixelData;

                        renderedObject = obj;
                    }
                }
            }
        } else {
            this.fetcherData.objPixelFifo.push({
                colorIndex: 0,
                palette: 0,
                bgPriority: 1,
            });
        }
    }

    private updateObjectsOnScanline() {
        this.fetcherData.objectsOnScanline.splice(0);

        for (const obj of this.oam.entries) {
            if (
                obj.x !== 0 &&
                this.ly + FULL_OBJECT_HEIGHT >= obj.y &&
                this.ly + FULL_OBJECT_HEIGHT < obj.y + this.objectHeight
            ) {
                this.fetcherData.objectsOnScanline.push(obj);
            }

            // max of 10 objects per scanline
            if (this.fetcherData.objectsOnScanline.length >= 10) {
                return;
            }
        }
    }

    private get objectHeight() {
        return this.lcdControl.objSizeMode === ObjectSizeMode.Large ? 16 : 8;
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
        /*
        const fetcherX = isPixelInsideWindow
            ? this.windowX
            : (Math.floor(this.scrollX / 8) +
                  this.fetcherData.currentFetchX / 8) &
              0x1f;
              */
        const fetcherX = Math.floor(this.fetcherData.mapX / 8) & 0x1f;

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
            const signedIndex = (tileIndex << 24) >> 24;
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

                if (objPixelData && this.lcdControl.isObjEnabled) {
                    const objHasPriority =
                        objPixelData.bgPriority === 0 || colorIndex === 0;
                    const isObjPixelVisible =
                        objPixelData.colorIndex !== 0 && objHasPriority;

                    if (isObjPixelVisible) {
                        colorIndex = objPixelData.colorIndex;
                        palette =
                            objPixelData.palette === 1
                                ? this.objPalette1
                                : this.objPalette0;
                    }
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
