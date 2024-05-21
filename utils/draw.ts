import { DetectedObject } from "@tensorflow-models/coco-ssd";

// mirrored, predictions, canvasRef.current?.getContext('2d')
export function drawOnCanvas(
  mirrored: boolean,
  predictions: DetectedObject[],
  ctx: CanvasRenderingContext2D | null | undefined
) {
  if (!ctx) return;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear previous drawings

  predictions.forEach((detectedObject: DetectedObject) => {
    const { class: name, bbox } = detectedObject;
    const [x, y, width, height] = bbox;

    ctx.beginPath();

    // Styling
    ctx.fillStyle = name === "person" ? "#FF0F0F" : "#00B612";
    ctx.globalAlpha = 0.4;

    if (mirrored) {
      ctx.roundRect(ctx.canvas.width - x - width, y, width, height, 8);
    } else {
      ctx.roundRect(x, y, width, height, 8);
    }

    ctx.fill();

    // Text styling
    ctx.font = "12px Courier New";
    ctx.fillStyle = 'black';
    ctx.globalAlpha = 1;
    ctx.fillText(name, mirrored ? ctx.canvas.width - x - width + 10 : x + 10, y + 20);
  });
}