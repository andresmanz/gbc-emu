export class CanvasRenderer {
    private imageData: ImageData;

    constructor(private canvasContext: CanvasRenderingContext2D) {
        this.imageData = canvasContext.createImageData(160, 144);
    }

    render(framebuffer: Uint8ClampedArray) {
        this.imageData.data.set(framebuffer);
        this.canvasContext.putImageData(this.imageData, 0, 0);
    }
}
