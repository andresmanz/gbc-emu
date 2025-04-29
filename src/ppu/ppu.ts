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

export enum PpuMode {
    HBlank = 0,
    VBlank = 1,
    OamScan = 2,
    PixelTransfer = 3,
}

const modeCycles = {
    [PpuMode.HBlank]: 204,
    [PpuMode.VBlank]: 456,
    [PpuMode.OamScan]: 80,
    [PpuMode.PixelTransfer]: 172,
};

export class Ppu {
    private framebuffer = new Uint8ClampedArray(160 * 144 * 4);
    private mode = PpuMode.OamScan;
    private modeClock = 0;
    public lcdc = 0;
    public stat = 0;
    public ly = 0;
    public scrollY = 0;
    public scrollX = 0;
    public palette = 0;

    onVBlank?: () => void;
    onFrameComplete?: (framebuffer: Uint8ClampedArray) => void;

    constructor(private videoRam: Ram) {
        this.reset();
    }

    tick(cycles: number) {
        if (!this.isLcdEnabled) {
            return;
        }

        this.modeClock += cycles;

        switch (this.mode) {
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

    private tickOam() {
        const targetCycles = modeCycles[PpuMode.OamScan];

        if (this.modeClock >= targetCycles) {
            this.modeClock -= targetCycles;

            this.activeMode = PpuMode.PixelTransfer;
        }
    }

    private tickTransfer() {
        const targetCycles = modeCycles[PpuMode.PixelTransfer];

        if (this.modeClock >= targetCycles) {
            this.modeClock -= targetCycles;

            this.renderScanline();
            this.activeMode = PpuMode.HBlank;
        }
    }

    private tickHBlank() {
        const targetCycles = modeCycles[PpuMode.HBlank];

        if (this.modeClock >= targetCycles) {
            this.modeClock -= targetCycles;

            this.ly++;

            if (this.ly === 144) {
                this.activeMode = PpuMode.VBlank;
                this.onVBlank?.();
                this.onFrameComplete?.(this.framebuffer); // trigger screen update
            } else {
                this.activeMode = PpuMode.OamScan;
            }
        }
    }

    private tickVBlank() {
        const targetCycles = modeCycles[PpuMode.VBlank];

        if (this.modeClock >= targetCycles) {
            this.modeClock -= targetCycles;

            this.ly++;

            if (this.ly > 153) {
                this.ly = 0;
                this.activeMode = PpuMode.OamScan;
            }
        }
    }

    private reset() {
        this.activeMode = PpuMode.OamScan;
        this.modeClock = 0;
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

    get activeMode() {
        return this.mode;
    }

    private set activeMode(newMode: PpuMode) {
        this.mode = newMode;
        this.stat = (this.stat & 0xfc) | newMode;
    }

    private renderScanline() {
        const bgEnabled = (this.lcdc & 0x01) !== 0;
        if (!bgEnabled) return;

        const y = this.ly; // LY

        const bgTileMapAddr = this.lcdc & 0x08 ? 0x1c00 : 0x1800;
        const tileDataAddr = this.lcdc & 0x10 ? 0x0000 : 0x0800;

        for (let x = 0; x < 160; x++) {
            const pixelX = (x + this.scrollX) & 0xff;
            const pixelY = (y + this.scrollY) & 0xff;

            const tileCol = Math.floor(pixelX / 8);
            const tileRow = Math.floor(pixelY / 8);

            const tileMapIndex = tileRow * 32 + tileCol;
            //const tileIndex = this.memoryBus.read(bgTileMapAddr + tileMapIndex);
            const tileIndex = this.videoRam.read(bgTileMapAddr + tileMapIndex);

            let tileAddress;
            //if (tileDataAddr === 0x8000) {
            if (tileDataAddr === 0x0000) {
                tileAddress = tileDataAddr + tileIndex * 16;
            } else {
                // signed index for 0x8800 region
                const signedIndex = Int8Array.of(tileIndex)[0];
                //tileAddress = 0x9000 + signedIndex * 16;
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

            const index = (y * 160 + x) * 4;

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

            this.framebuffer[index + 0] = shade; // Red
            this.framebuffer[index + 1] = shade; // Green
            this.framebuffer[index + 2] = shade; // Blue
            this.framebuffer[index + 3] = 255; // Alpha (opaque)
        }
    }
}
