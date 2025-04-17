export class Timer {
    private divCounter = 0;

    div = 0;

    update(cycles: number) {
        this.updateDiv(cycles);
    }

    private updateDiv(cycles: number) {
        this.divCounter = (this.divCounter + cycles) & 0xffff;
        this.div = this.divCounter >> 8;
    }

    resetDiv() {
        this.div = 0;
        this.divCounter = 0;
    }
}
