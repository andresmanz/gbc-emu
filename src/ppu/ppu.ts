import { LCD_CONTROLS_ADDRESS } from '../memory/gbMemoryBus';
import { MemoryBus } from '../memory/memoryBus';

enum LcdControlBit {
    BgAndWindowEnable,
    ObjEnable,
    ObjSize,
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

    onFrameComplete?: (framebuffer: Uint8ClampedArray) => void;

    constructor(private memoryBus: MemoryBus) {
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

        this.onFrameComplete?.(this.framebuffer);
    }

    private tickOam() {
        if (this.modeClock >= modeCycles[PpuMode.OamScan]) {
            this.activeMode = PpuMode.PixelTransfer;
        }
    }

    private tickTransfer() {
        if (this.modeClock >= modeCycles[PpuMode.PixelTransfer]) {
            this.activeMode = PpuMode.HBlank;
        }
    }

    private tickHBlank() {
        if (this.modeClock >= modeCycles[PpuMode.HBlank]) {
            this.activeMode = PpuMode.VBlank;
        }
    }

    private tickVBlank() {
        if (this.modeClock >= modeCycles[PpuMode.VBlank]) {
            this.activeMode = PpuMode.OamScan;
        }
    }

    private reset() {
        this.mode = PpuMode.OamScan;
        this.modeClock = 0;
        this.framebuffer.fill(0);
    }

    private get isLcdEnabled() {
        return (
            (this.memoryBus.read(LCD_CONTROLS_ADDRESS) &
                (1 << LcdControlBit.LcdPpuEnable)) !==
            0
        );
    }

    public enableLcd() {
        const currentValue = this.memoryBus.read(LCD_CONTROLS_ADDRESS);
        const mask = 1 << LcdControlBit.LcdPpuEnable;
        this.memoryBus.write(LCD_CONTROLS_ADDRESS, currentValue | mask);
    }

    public disableLcd() {
        const currentValue = this.memoryBus.read(LCD_CONTROLS_ADDRESS);
        const mask = ~(1 << LcdControlBit.LcdPpuEnable);
        this.memoryBus.write(LCD_CONTROLS_ADDRESS, currentValue & mask);
    }

    get activeMode() {
        return this.mode;
    }

    private set activeMode(newMode: PpuMode) {
        this.modeClock -= modeCycles[this.mode];
        this.mode = newMode;
    }
}
