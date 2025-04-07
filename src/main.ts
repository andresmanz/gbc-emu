import './style.css';

const appContainer = document.querySelector<HTMLDivElement>('#app');

if (appContainer) {
    appContainer.innerHTML = `
        <div>
            This is the emulator.
        </div>
    `;
}
