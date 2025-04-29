import { CanvasRenderer } from './canvasRenderer';
import { Emulator } from './emulator';
import { MemoryBus } from './memory/memoryBus';
import './style.css';

const TILE_SIZE = 8;
const TILES_X = 16; // 16 tiles per row in debug canvas
const NUM_TILES = 384;
const TILE_BYTES = 16;
const vramBase = 0x8000;

let isPaused = false;

function decodeTiles(memoryBus: MemoryBus): number[][] {
    const tiles: number[][] = [];

    for (let tileIndex = 0; tileIndex < NUM_TILES; tileIndex++) {
        const tile: number[] = [];

        for (let y = 0; y < TILE_SIZE; y++) {
            const byte1 = memoryBus.read(
                vramBase + tileIndex * TILE_BYTES + y * 2,
            );
            const byte2 = memoryBus.read(
                vramBase + tileIndex * TILE_BYTES + y * 2 + 1,
            );

            for (let x = 0; x < TILE_SIZE; x++) {
                const bitIndex = 7 - x;
                const lowBit = (byte1 >> bitIndex) & 0x01;
                const highBit = (byte2 >> bitIndex) & 0x01;
                const colorId = (highBit << 1) | lowBit;
                tile.push(colorId);
            }
        }

        tiles.push(tile);
    }

    return tiles;
}

function renderTiles(ctx: CanvasRenderingContext2D, tiles: number[][]) {
    const pixelSize = 2; // size of each pixel for visibility

    tiles.forEach((tile, index) => {
        const tileX = (index % TILES_X) * (TILE_SIZE * pixelSize);
        const tileY = Math.floor(index / TILES_X) * (TILE_SIZE * pixelSize);

        for (let y = 0; y < TILE_SIZE; y++) {
            for (let x = 0; x < TILE_SIZE; x++) {
                const color = getColor(tile[y * TILE_SIZE + x]);
                ctx.fillStyle = color;
                ctx.fillRect(
                    tileX + x * pixelSize,
                    tileY + y * pixelSize,
                    pixelSize,
                    pixelSize,
                );
            }
        }
    });
}

function getColor(colorId: number): string {
    const colors = ['#FFFFFF', '#AAAAAA', '#555555', '#000000'];
    return colors[colorId];
}

const emulator = new Emulator();
const romInput = document.querySelector<HTMLInputElement>('#romInput');
const screenCanvas = document.querySelector<HTMLCanvasElement>('#screenCanvas');
const tileCanvas = document.querySelector<HTMLCanvasElement>('#tileCanvas');
const tileCtx = tileCanvas?.getContext('2d');
const logContainer = document.querySelector<HTMLDivElement>('#logs');

function updateLog() {
    if (logContainer) {
        //logContainer.innerHTML = emulator.logger.lines.slice(-20).join('<br>');
    }
}

const CLOCK_HZ = 4194304; // Game Boy CPU speed
let lastTime = performance.now();
let leftoverCycles = 0;

function emuLoop(now: number) {
    if (isPaused) {
        requestAnimationFrame(emuLoop);
        return;
    }

    const deltaTimeMs = now - lastTime;
    lastTime = now;

    // Total cycles to simulate based on real time passed
    const targetCycles = (deltaTimeMs / 1000) * CLOCK_HZ + leftoverCycles;
    const cyclesToRun = Math.floor(targetCycles);
    leftoverCycles = targetCycles - cyclesToRun;

    // run CPU until target cycles for this frame are simulated
    emulator.step(cyclesToRun);

    // render (just draws the last written framebuffer)
    if (tileCtx) {
        const tiles = decodeTiles(emulator.memoryBus);
        renderTiles(tileCtx, tiles);
    }

    requestAnimationFrame(emuLoop);
}

if (romInput && screenCanvas) {
    const ctx = screenCanvas.getContext('2d');

    if (ctx) {
        const renderer = new CanvasRenderer(ctx);
        emulator.ppu.onFrameComplete = framebuffer =>
            renderer.render(framebuffer);

        romInput.addEventListener('change', event => {
            const target = event.target as HTMLInputElement;
            const files = target.files;

            if (files && files.length > 0) {
                const file = files[0];
                const reader = new FileReader();

                reader.onload = e => {
                    const arrayBuffer = e.target?.result as ArrayBuffer;
                    const data = new Uint8Array(arrayBuffer);
                    emulator.loadRom(data);

                    requestAnimationFrame(emuLoop);
                };

                reader.readAsArrayBuffer(file);
            }
        });

        const stepButton =
            document.querySelector<HTMLButtonElement>('#stepButton');

        if (stepButton) {
            stepButton.addEventListener('click', () => {
                emulator.step(1);
                updateLog();
            });
        }

        const readAddressButton =
            document.querySelector<HTMLButtonElement>('#readAddressButton');

        readAddressButton?.addEventListener('click', () => {
            const addressInput =
                document.querySelector<HTMLInputElement>('#addressInput');

            if (addressInput) {
                const address = parseInt(addressInput.value, 16);
                console.log(emulator.memoryBus.read(address));
            }
        });

        const pauseButton =
            document.querySelector<HTMLButtonElement>('#pauseButton');

        pauseButton?.addEventListener('click', () => {
            isPaused = !isPaused;

            if (!isPaused) {
                requestAnimationFrame(emuLoop);
                pauseButton.innerHTML = 'Pause';
            } else {
                pauseButton.innerHTML = 'Resume';
            }
        });
    }
}
