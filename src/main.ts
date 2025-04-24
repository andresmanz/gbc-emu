import { Emulator } from './emulator';
import './style.css';

const emulator = new Emulator();
const romInput = document.querySelector<HTMLInputElement>('#romInput');

if (romInput) {
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
            };

            reader.readAsArrayBuffer(file);
        }
    });
}

const stepButton = document.querySelector<HTMLButtonElement>('#stepButton');

if (stepButton) {
    stepButton.addEventListener('click', () => {
        // run 70224 cycles for one full frame (Game Boy runs at ~59.7 FPS)
        emulator.step(70224);
    });
}

const appContainer = document.querySelector<HTMLDivElement>('#emulator');

if (appContainer) {
    appContainer.innerHTML = `
        <div>
            This is the emulator.
        </div>
    `;
}
